//! FEAT-03c (3.0.0) — same-Wi-Fi Meet Room without internet.
//!
//! A tiny WebSocket RELAY written with the standard library only (no new crates). The device that hosts a room starts it; other
//! devices on the same network connect to `ws://<host-ip>:<port>` and every text message one member sends is passed on to the
//! others. It carries the same small control messages as the online room (which song, play/pause, queue) — never audio.
//!
//! Safety rules: members must send the room code as their first message; at most 16 members; messages are capped at 64 KB; a
//! broken or silent member is dropped without affecting the others; the server does nothing until the host starts a room and
//! stops completely when the host stops it (or the app closes).

use serde::Serialize;
use serde_json::Value;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const GUID: &str = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_MEMBERS: usize = 16;
const MAX_MESSAGE: usize = 64 * 1024;

struct Member {
    id: u64,
    out: Mutex<TcpStream>,
}

struct Room {
    stop: Arc<AtomicBool>,
    members: Arc<Mutex<Vec<Arc<Member>>>>,
}

static ROOM: Mutex<Option<Room>> = Mutex::new(None);
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Serialize)]
pub struct LanInfo {
    pub ip: String,
    pub port: u16,
}

// ----------------------------------------------------------------------------------------------------- SHA-1 + Base64 (std only)
fn sha1(data: &[u8]) -> [u8; 20] {
    let mut h: [u32; 5] = [0x6745_2301, 0xEFCD_AB89, 0x98BA_DCFE, 0x1032_5476, 0xC3D2_E1F0];
    let mut msg = data.to_vec();
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&((data.len() as u64) * 8).to_be_bytes());
    for chunk in msg.chunks(64) {
        let mut w = [0u32; 80];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([chunk[4 * i], chunk[4 * i + 1], chunk[4 * i + 2], chunk[4 * i + 3]]);
        }
        for i in 16..80 {
            w[i] = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]).rotate_left(1);
        }
        let (mut a, mut b, mut c, mut d, mut e) = (h[0], h[1], h[2], h[3], h[4]);
        for (i, wi) in w.iter().enumerate() {
            let (f, k) = match i {
                0..=19 => ((b & c) | ((!b) & d), 0x5A82_7999u32),
                20..=39 => (b ^ c ^ d, 0x6ED9_EBA1),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8F1B_BCDC),
                _ => (b ^ c ^ d, 0xCA62_C1D6),
            };
            let t = a.rotate_left(5).wrapping_add(f).wrapping_add(e).wrapping_add(k).wrapping_add(*wi);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = t;
        }
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
    }
    let mut out = [0u8; 20];
    for (i, v) in h.iter().enumerate() {
        out[4 * i..4 * i + 4].copy_from_slice(&v.to_be_bytes());
    }
    out
}

fn base64(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::new();
    for c in data.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        s.push(T[(n >> 18) as usize & 63] as char);
        s.push(T[(n >> 12) as usize & 63] as char);
        s.push(if c.len() > 1 { T[(n >> 6) as usize & 63] as char } else { '=' });
        s.push(if c.len() > 2 { T[n as usize & 63] as char } else { '=' });
    }
    s
}

fn accept_key(client_key: &str) -> String {
    base64(&sha1(format!("{client_key}{GUID}").as_bytes()))
}

// -------------------------------------------------------------------------------------------------------------- WebSocket frames
fn frame(opcode: u8, payload: &[u8]) -> Vec<u8> {
    let mut f = vec![0x80 | opcode];
    match payload.len() {
        n if n < 126 => f.push(n as u8),
        n if n <= 0xFFFF => {
            f.push(126);
            f.extend_from_slice(&(n as u16).to_be_bytes());
        }
        n => {
            f.push(127);
            f.extend_from_slice(&(n as u64).to_be_bytes());
        }
    }
    f.extend_from_slice(payload);
    f
}

enum Incoming {
    Text(String),
    Ping(Vec<u8>),
    Close,
}

/// Reads one client frame. Returns None on any protocol problem or a closed socket (the caller then drops the member).
fn read_frame(s: &mut TcpStream) -> Option<Incoming> {
    let mut head = [0u8; 2];
    s.read_exact(&mut head).ok()?;
    let fin = head[0] & 0x80 != 0;
    let opcode = head[0] & 0x0F;
    let masked = head[1] & 0x80 != 0;
    let mut len = (head[1] & 0x7F) as usize;
    if len == 126 {
        let mut b = [0u8; 2];
        s.read_exact(&mut b).ok()?;
        len = u16::from_be_bytes(b) as usize;
    } else if len == 127 {
        let mut b = [0u8; 8];
        s.read_exact(&mut b).ok()?;
        len = usize::try_from(u64::from_be_bytes(b)).ok()?;
    }
    if !masked || len > MAX_MESSAGE || !fin {
        return None; // clients must mask; oversized or fragmented messages are not accepted
    }
    let mut mask = [0u8; 4];
    s.read_exact(&mut mask).ok()?;
    let mut payload = vec![0u8; len];
    s.read_exact(&mut payload).ok()?;
    for (i, b) in payload.iter_mut().enumerate() {
        *b ^= mask[i % 4];
    }
    match opcode {
        0x1 => String::from_utf8(payload).ok().map(Incoming::Text),
        0x8 => Some(Incoming::Close),
        0x9 => Some(Incoming::Ping(payload)),
        0xA => Some(Incoming::Ping(Vec::new())), // unsolicited pong: ignore by treating as a no-op ping
        _ => None,
    }
}

fn read_http_request(s: &mut TcpStream) -> Option<String> {
    let mut buf = Vec::new();
    let mut byte = [0u8; 1];
    while buf.len() < 8192 {
        s.read_exact(&mut byte).ok()?;
        buf.push(byte[0]);
        if buf.ends_with(b"\r\n\r\n") {
            return String::from_utf8(buf).ok();
        }
    }
    None
}

fn header<'a>(req: &'a str, name: &str) -> Option<&'a str> {
    req.lines().find_map(|l| {
        let (k, v) = l.split_once(':')?;
        k.trim().eq_ignore_ascii_case(name).then(|| v.trim())
    })
}

fn handle_client(mut stream: TcpStream, code: String, stop: Arc<AtomicBool>, members: Arc<Mutex<Vec<Arc<Member>>>>) {
    let _ = stream.set_nodelay(true);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(15))); // a client that never finishes the handshake is dropped
    let Some(req) = read_http_request(&mut stream) else { return };
    let upgrade = header(&req, "Upgrade").map(|v| v.eq_ignore_ascii_case("websocket")).unwrap_or(false);
    let Some(key) = header(&req, "Sec-WebSocket-Key").filter(|_| upgrade) else {
        let _ = stream.write_all(b"HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
        return;
    };
    let resp = format!("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {}\r\n\r\n", accept_key(key));
    if stream.write_all(resp.as_bytes()).is_err() {
        return;
    }

    // The first message must be {"code":"<room code>"}; anything else and the member is dropped.
    let authed = matches!(read_frame(&mut stream), Some(Incoming::Text(t)) if serde_json::from_str::<Value>(&t).ok().and_then(|v| v.get("code").and_then(|c| c.as_str().map(|s| s == code))).unwrap_or(false));
    if !authed {
        let _ = stream.write_all(&frame(0x8, &[0x03, 0xE8]));
        return;
    }
    let Ok(write_half) = stream.try_clone() else { return };
    let me = Arc::new(Member { id: NEXT_ID.fetch_add(1, Ordering::Relaxed), out: Mutex::new(write_half) });
    {
        let mut list = members.lock().unwrap();
        if list.len() >= MAX_MEMBERS {
            drop(list);
            let _ = me.out.lock().unwrap().write_all(&frame(0x8, &[0x03, 0xF3]));
            return;
        }
        list.push(me.clone());
    }
    let _ = me.out.lock().unwrap().write_all(&frame(0x1, br#"{"t":"lan-ready"}"#));
    let _ = stream.set_read_timeout(None); // idle members just wait; stopping the room shuts every socket, which ends the read

    while !stop.load(Ordering::Relaxed) {
        match read_frame(&mut stream) {
            Some(Incoming::Text(t)) => {
                let out = frame(0x1, t.as_bytes());
                let others: Vec<Arc<Member>> = members.lock().unwrap().iter().filter(|m| m.id != me.id).cloned().collect();
                for m in others {
                    if m.out.lock().unwrap().write_all(&out).is_err() {
                        let _ = m.out.lock().unwrap().shutdown(Shutdown::Both); // its own thread then notices and removes it
                    }
                }
            }
            Some(Incoming::Ping(p)) => {
                if !p.is_empty() {
                    let _ = me.out.lock().unwrap().write_all(&frame(0xA, &p));
                }
            }
            Some(Incoming::Close) => break,
            None => break, // closed, malformed, oversized or fragmented: this member ends (the others are unaffected)
        }
    }
    members.lock().unwrap().retain(|m| m.id != me.id);
    let _ = me.out.lock().unwrap().write_all(&frame(0x8, &[0x03, 0xE8]));
    let _ = stream.shutdown(Shutdown::Both);
}

/// The address other devices on this network can reach. Opening a UDP socket "towards" a public address sends nothing; it only
/// makes the OS pick the network interface, whose address we then read.
fn local_ip() -> Option<String> {
    let s = UdpSocket::bind("0.0.0.0:0").ok()?;
    s.connect("192.0.2.1:9").ok()?;
    Some(s.local_addr().ok()?.ip().to_string())
}

#[tauri::command]
pub fn lan_room_start(code: String) -> Result<LanInfo, String> {
    if code.len() < 4 || code.len() > 12 || !code.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("Invalid room code.".into());
    }
    let mut room = ROOM.lock().map_err(|_| "Room state is unavailable.".to_string())?;
    if room.is_some() {
        return Err("A room is already running. Stop it first.".into());
    }
    let ip = local_ip().ok_or("Couldn't find this device's Wi-Fi address. Connect to a network first.")?;
    let listener = TcpListener::bind(("0.0.0.0", 0)).map_err(|e| format!("Couldn't open a room on this network: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;

    let stop = Arc::new(AtomicBool::new(false));
    let members: Arc<Mutex<Vec<Arc<Member>>>> = Arc::new(Mutex::new(Vec::new()));
    {
        let (stop, members) = (stop.clone(), members.clone());
        thread::spawn(move || {
            while !stop.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((s, _)) => {
                        let _ = s.set_nonblocking(false);
                        let (code, stop, members) = (code.clone(), stop.clone(), members.clone());
                        thread::spawn(move || handle_client(s, code, stop, members));
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(100)),
                    Err(_) => thread::sleep(Duration::from_millis(250)),
                }
            }
        });
    }
    *room = Some(Room { stop, members });
    Ok(LanInfo { ip, port })
}

#[tauri::command]
pub fn lan_room_stop() {
    if let Ok(mut room) = ROOM.lock() {
        if let Some(r) = room.take() {
            r.stop.store(true, Ordering::Relaxed);
            for m in r.members.lock().unwrap().iter() {
                let _ = m.out.lock().unwrap().shutdown(Shutdown::Both);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc6455_handshake_example() {
        // The worked example from RFC 6455 section 1.3.
        assert_eq!(accept_key("dGhlIHNhbXBsZSBub25jZQ=="), "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
    }

    #[test]
    fn sha1_known_vector() {
        let h = sha1(b"abc");
        let hex: String = h.iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(hex, "a9993e364706816aba3e25717850c26c9cd0d89d");
    }

    #[test]
    fn frame_lengths() {
        assert_eq!(frame(0x1, b"hi"), vec![0x81, 2, b'h', b'i']);
        assert_eq!(frame(0x1, &vec![0u8; 300])[1], 126);
    }
}
