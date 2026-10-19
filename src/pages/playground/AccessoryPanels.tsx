import { useState } from "react";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useAudioFx } from "@/app/context/AudioFxContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { formatDuration } from "@/lib/formatDuration";
import { VIZ_MODES, type VizMode } from "@/lib/audio/visualizers";
import type { FilterId } from "@/lib/audio/audioEngine";
import { parseTimeInput } from "./SeekBar";

/** Contents of the Playground's secondary-row popovers added in 2.2.0. */

export function CutterPanel() {
  const { currentTrack, duration, position, seek } = usePlayback();
  const { push } = useNotifications();
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [fade, setFade] = useState(15);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const hi = end || duration;

  const setNum = (setter: (n: number) => void) => (raw: string) => {
    const t = parseTimeInput(raw, duration);
    if (t !== null) setter(t);
  };

  const save = async () => {
    if (!currentTrack?.path) return push("Can't cut this track", "The cutter works on local files in your library.");
    setBusy(true);
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const dest = await save({ defaultPath: `${currentTrack.title} (cut).wav`, filters: [{ name: "WAV audio", extensions: ["wav"] }] });
      if (!dest) return;
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("export_trim", { src: currentTrack.path, start, end: hi, dest, fadeMs: fade });
      push("Clip saved", `${formatDuration(hi - start)} exported to ${dest}`);
    } catch (e) {
      push("Couldn't save the clip", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pg-panel">
      <p className="playground__panel-note">Trim a section of the current song and save it as a WAV (ringtones, samples). Your original file is never changed.</p>
      <div className="pg-panel__row">
        <label>Start <input defaultValue={formatDuration(start)} key={`s${start}`} onBlur={(e) => setNum(setStart)(e.target.value)} /></label>
        <label>End <input defaultValue={formatDuration(hi)} key={`e${hi}`} onBlur={(e) => setNum(setEnd)(e.target.value)} /></label>
        <label>Fade {fade} ms <input type="range" min={0} max={200} value={fade} onChange={(e) => setFade(Number(e.target.value))} /></label>
      </div>
      <div className="pg-panel__row">
        <button type="button" onClick={() => setStart(position)} disabled={!currentTrack}>Start = now</button>
        <button type="button" onClick={() => setEnd(position)} disabled={!currentTrack}>End = now</button>
        <button type="button" onClick={() => { seek(start); setPreview(true); }} disabled={!currentTrack}>Preview from start</button>
      </div>
      {preview && <p className="playground__panel-note">Previewing — it keeps playing past the end; the saved clip stops at {formatDuration(hi)}.</p>}
      <button type="button" className="playground__download-btn" onClick={save} disabled={busy || !currentTrack || hi <= start}>{busy ? "Exporting…" : "Save clip as WAV"}</button>
    </div>
  );
}

export function NormalizerPanel() {
  const fx = useAudioFx();
  return (
    <div className="pg-panel">
      <p className="playground__panel-note">Keeps loud and quiet songs at a similar level. Each local track is analysed once and a gain is applied during playback — your files are not modified.</p>
      <label className="pg-panel__check"><input type="checkbox" checked={fx.normalizer} disabled={!fx.fxAvailable} onChange={(e) => fx.setNormalizer(e.target.checked)} /> Normalize volume</label>
      <p className="playground__panel-note">{fx.normalizerStatus}</p>
    </div>
  );
}

export function ZonesPanel() {
  const { currentTrack, position, duration } = usePlayback();
  const fx = useAudioFx();
  const [from, setFrom] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  return (
    <div className="pg-panel">
      <p className="playground__panel-note">Mark a part of this song (a solo, a verse) and loop only that part while you practise or focus.</p>
      <div className="pg-panel__row">
        <button type="button" disabled={!currentTrack} onClick={() => setFrom(position)}>{from === null ? "Zone starts here" : `Starts ${formatDuration(from)}`}</button>
        <input placeholder="Label (e.g. Guitar solo)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="button" disabled={from === null || position <= from} onClick={() => { fx.addZone({ start: from!, end: Math.min(position, duration), label: label.trim() || "Focus zone" }); setFrom(null); setLabel(""); }}>Zone ends here</button>
      </div>
      {fx.zones.length === 0 && <p className="playground__panel-note">No focus zones for this track yet.</p>}
      {fx.zones.map((z) => (
        <div key={z.id} className="playground__loop-row">
          <span>{z.label} · {formatDuration(z.start)}–{formatDuration(z.end)}</span>
          <span>
            <button type="button" onClick={() => fx.setActiveZoneId(fx.activeZoneId === z.id ? null : z.id)}>{fx.activeZoneId === z.id ? "Stop looping" : "Loop it"}</button>{" "}
            <button type="button" onClick={() => fx.removeZone(z.id)}>Remove</button>
          </span>
        </div>
      ))}
    </div>
  );
}

export function RadioPanel() {
  const fx = useAudioFx();
  return (
    <div className="pg-panel">
      <p className="playground__panel-note">Turns your library into a retro radio station: made-up DJs introduce songs, read dedications and drop silly fictional ads between tracks — spoken offline by your system voice.</p>
      <label className="pg-panel__check"><input type="checkbox" checked={fx.radio} onChange={(e) => fx.setRadio(e.target.checked)} /> Radio simulation</label>
    </div>
  );
}

export function DeepSleepPanel() {
  const fx = useAudioFx();
  return (
    <div className="pg-panel">
      <p className="playground__panel-note">If you stop interacting at night, the music fades out over a minute and stops — and wakes up instantly when you touch the app.</p>
      <label className="pg-panel__check"><input type="checkbox" checked={fx.deepSleep} onChange={(e) => fx.setDeepSleep(e.target.checked)} /> Deep Sleep Auto-Fader</label>
      <label>Active from {String(fx.deepSleepStart).padStart(2, "0")}:00 until 06:00
        <input type="range" min={18} max={26} value={fx.deepSleepStart < 18 ? fx.deepSleepStart + 24 : fx.deepSleepStart} onChange={(e) => fx.setDeepSleepStart(Number(e.target.value) % 24)} />
      </label>
    </div>
  );
}

export function PitchPanel() {
  const fx = useAudioFx();
  return (
    <div className="pg-panel">
      <p className="playground__panel-note">Shift the key without changing the speed (sing-along, karaoke). Works on local files.</p>
      <label>Pitch {fx.pitch > 0 ? "+" : ""}{fx.pitch} semitones
        <input type="range" min={-12} max={12} step={1} value={fx.pitch} disabled={!fx.fxAvailable} onChange={(e) => fx.setPitch(Number(e.target.value))} />
      </label>
      <button type="button" onClick={() => fx.setPitch(0)}>Reset</button>
    </div>
  );
}

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "reverb", label: "Reverb (stadium)" },
  { id: "echo", label: "Echo" },
  { id: "distortion", label: "Distortion" },
  { id: "bitcrush", label: "8-bit retro" },
];
export function FiltersPanel() {
  const fx = useAudioFx();
  return (
    <div className="pg-panel">
      <p className="playground__panel-note">Real-time effects for local files. Combine as many as you like.</p>
      {FILTERS.map((f) => (
        <label key={f.id} className="pg-panel__check"><input type="checkbox" checked={fx.filters[f.id]} disabled={!fx.fxAvailable} onChange={() => fx.toggleFilter(f.id)} /> {f.label}</label>
      ))}
      {fx.fxError && <p className="playground__panel-note" role="alert" style={{ color: "var(--color-danger, #ff6b6b)" }}>{fx.fxError}</p>}
    </div>
  );
}

export function MoodPanel() {
  const fx = useAudioFx();
  return (
    <div className="pg-panel">
      <p className="playground__panel-note">Sync Philips Hue lights to the music. Needs a bridge on your network and an app key (press the bridge button, then create a user via <code>http://&lt;bridge-ip&gt;/api</code>).</p>
      <div className="pg-panel__row">
        <input placeholder="Bridge IP (192.168.1.20)" value={fx.hue.bridgeIp} onChange={(e) => fx.setHue({ ...fx.hue, bridgeIp: e.target.value })} />
        <input placeholder="App key" value={fx.hue.appKey} onChange={(e) => fx.setHue({ ...fx.hue, appKey: e.target.value })} />
        <input placeholder="Light ids, e.g. 1,2" value={fx.hue.lights} onChange={(e) => fx.setHue({ ...fx.hue, lights: e.target.value })} />
      </div>
      <label className="pg-panel__check"><input type="checkbox" checked={fx.hueSync} onChange={(e) => fx.setHueSync(e.target.checked)} /> Sync lights to the music</label>
      <p className="playground__panel-note">Uses the Hue bridge's local API (v1). Other smart-light brands aren't supported yet.</p>
    </div>
  );
}

export function InsightsPanel() {
  const { insights } = useAudioFx();
  const bar = (v: number) => <span className="pg-meter"><span style={{ width: `${Math.round(v * 100)}%` }} /></span>;
  if (!insights.reactive) return <p className="playground__panel-note">Live analysis needs a playing local track (streamed sources don't expose audio data). Press play on a file from your library.</p>;
  return (
    <div className="pg-panel pg-insights">
      <div><small>Tempo</small><strong>{insights.bpm ? `${insights.bpm} BPM` : "Listening…"}</strong></div>
      <div><small>Key</small><strong>{insights.key ?? "Listening…"}</strong></div>
      <div><small>Energy</small>{bar(insights.energy)}</div>
      <div><small>Danceability</small>{bar(insights.danceability)}</div>
      <p className="playground__panel-note">Estimated live from the audio while it plays — it settles after 10–20 seconds.</p>
    </div>
  );
}

export function VisualizerPanel({ mode, setMode, on, setOn }: { mode: VizMode; setMode: (m: VizMode) => void; on: boolean; setOn: (v: boolean) => void }) {
  return (
    <div className="pg-panel">
      <label className="pg-panel__check"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Show on the stage</label>
      <div className="playground__speed">
        {VIZ_MODES.map((m) => <button key={m.id} type="button" data-active={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>)}
      </div>
      <p className="playground__panel-note">Uses live audio for local files; streamed sources get a gentler simulated pulse.</p>
    </div>
  );
}
