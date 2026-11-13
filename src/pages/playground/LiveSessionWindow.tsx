import { useState } from "react";
import { FloatingWindow } from "@/app/components/FloatingWindow";
import { useLiveSession, type SessionKind } from "@/app/context/LiveSessionContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useLibrary } from "@/app/context/LibraryContext";
import { useAuth } from "@/app/context/AuthContext";
import { isMobileOs } from "@/lib/useIsMobile";
import { isTauri } from "@/lib/platform";
import "./LiveSessionWindow.css";

/** FEAT-03c Meet Room and FEAT-03d Session Share, in one floating window. */
export function LiveSessionWindow({ onClose }: { onClose: () => void }) {
  const live = useLiveSession();
  const { user } = useAuth();
  const { currentTrack } = usePlayback();
  const { tracks } = useLibrary();
  const [kind, setKind] = useState<SessionKind>(live.active?.kind ?? "room");
  const [name, setName] = useState(user?.fullName?.split(" ")[0] ?? "");
  const [code, setCode] = useState("");
  const [wifi, setWifi] = useState(false); // same-Wi-Fi (no internet) room
  const [addr, setAddr] = useState("");
  const canHost = isTauri() && !isMobileOs();
  const [q, setQ] = useState("");
  const hits = q.trim() ? tracks.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];

  return (
    <FloatingWindow title={live.active ? (live.active.kind === "room" ? "Meet Room" : "Session Share") : "Listen together"} onClose={onClose} width={400} height={520}>
      <div className="live">
        {!live.active ? (
          <>
            <div className="live__tabs" role="tablist">
              <button type="button" role="tab" aria-selected={kind === "room"} data-active={kind === "room"} onClick={() => setKind("room")}>Meet Room</button>
              <button type="button" role="tab" aria-selected={kind === "share"} data-active={kind === "share"} onClick={() => setKind("share")}>Session Share</button>
            </div>
            <p className="live__hint">
              {kind === "room"
                ? "A shared party queue. Everyone adds songs and plays them together. Each person plays their own copy of the song."
                : "Share what you're playing with a friend. When either of you plays, pauses or skips, the other follows."}
            </p>
            {kind === "room" && (
              <div className="live__tabs" role="tablist" aria-label="Connection">
                <button type="button" role="tab" aria-selected={!wifi} data-active={!wifi} onClick={() => setWifi(false)}>Online</button>
                <button type="button" role="tab" aria-selected={wifi} data-active={wifi} onClick={() => setWifi(true)}>Same Wi-Fi · no internet</button>
              </div>
            )}
            <label>Your name<input value={name} maxLength={30} placeholder="Shown to others" onChange={(e) => setName(e.target.value)} /></label>
            {kind === "room" && wifi ? (
              <>
                {canHost
                  ? <button type="button" className="live__primary" disabled={live.busy} onClick={() => void live.startLan(name)}>{live.busy ? "Starting…" : "Host a room on this computer"}</button>
                  : <p className="live__hint">Rooms on Wi-Fi are hosted from a computer. Join one with its address and code.</p>}
                <div className="live__or">or join a room on this Wi-Fi</div>
                <input value={addr} placeholder="Address, e.g. 192.168.1.20:41781" aria-label="Room address" onChange={(e) => setAddr(e.target.value)} spellCheck={false} />
                <div className="live__row">
                  <input value={code} maxLength={12} placeholder="CODE" aria-label="Room code" onChange={(e) => setCode(e.target.value.toUpperCase())} />
                  <button type="button" disabled={live.busy || code.length < 4 || !addr.trim()} onClick={() => void live.joinLan(addr, code, name)}>Join</button>
                </div>
              </>
            ) : (
              <>
                <button type="button" className="live__primary" disabled={live.busy} onClick={() => void live.start(kind, name)}>{live.busy ? "Connecting…" : kind === "room" ? "Start a room" : "Start sharing"}</button>
                <div className="live__or">or join with a code</div>
                <div className="live__row">
                  <input value={code} maxLength={12} placeholder="CODE" aria-label="Session code" onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && code && void live.join(kind, code, name)} />
                  <button type="button" disabled={live.busy || code.length < 4} onClick={() => void live.join(kind, code, name)}>Join</button>
                </div>
              </>
            )}
            {live.error && <p className="live__error" role="alert">{live.error}</p>}
            <p className="live__fine">{kind === "room" && wifi ? "Works with no internet at all — everyone just needs to be on the same Wi-Fi." : "Online sessions need an internet connection."} Only song names and play state are shared — never audio files.</p>
          </>
        ) : (
          <>
            <div className="live__code">
              <small>Share this code</small>
              <strong>{live.active.code}</strong>
              {live.active.lan && <small>{live.active.lan.address}</small>}
              <button type="button" onClick={() => void navigator.clipboard?.writeText(live.active!.lan ? `${live.active!.lan.address}  ${live.active!.code}` : live.active!.code)}>Copy</button>
            </div>
            <p className="live__hint">{live.members.length} here: {live.members.map((m) => m.name).join(", ")}</p>
            {live.active.kind === "room" && (
              <>
                <div className="live__row">
                  <input value={q} placeholder="Search your library to add…" onChange={(e) => setQ(e.target.value)} aria-label="Add a song to the room" />
                  <button type="button" disabled={!currentTrack} onClick={() => currentTrack && live.addToRoom(currentTrack)} title="Add the song that's playing">+ Playing</button>
                </div>
                {hits.map((t) => (
                  <button key={t.id} type="button" className="live__hit" onClick={() => { live.addToRoom(t); setQ(""); }}><strong>{t.title}</strong><small>{t.artist}</small><em>+ add</em></button>
                ))}
                <ol className="live__queue">
                  {live.roomQueue.length === 0 && <li className="live__empty">The room queue is empty. Add the first song.</li>}
                  {live.roomQueue.map((s) => (
                    <li key={s.fp} data-missing={!s.available}><strong>{s.title}</strong><small>{s.artist}{s.available ? "" : " · not on this device"}</small></li>
                  ))}
                </ol>
              </>
            )}
            <button type="button" className="live__leave" onClick={() => void live.leave()}>Leave</button>
          </>
        )}
      </div>
    </FloatingWindow>
  );
}
