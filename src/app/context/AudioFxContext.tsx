import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePlayback } from "./PlaybackContext";
import { useLibrary } from "./LibraryContext";
import { usePersistentState } from "@/lib/usePersistentState";
import { getPreference, setPreference } from "@/lib/preferencesStore";
import { isTauri } from "@/lib/platform";
import { serviceFetch } from "@/lib/services/serviceFetch";
import { applyEffects, canRouteThroughGraph, ensureRunning, initPitchWorklet, isRouted, readSpectrum, routeThroughGraph, resumeContext, type FilterId } from "@/lib/audio/audioEngine";

/**
 * 2.2.0 — everything that shapes or reacts to the sound lives here, so Playground panels, the screensaver and the
 * stage effects share one set of settings and ONE animation loop:
 *   real-time filters · pitch shifter · volume normalizer · auto volume · deep-sleep fader · focus zones ·
 *   radio simulation · sound mood lighting (Philips Hue) · live track insights (BPM / key / energy / danceability)
 */
export interface FocusZone { id: string; start: number; end: number; label: string }
export interface Marker { id: string; at: number; label: string }
export interface HueConfig { bridgeIp: string; appKey: string; lights: string }
export interface Insights { bpm: number | null; key: string | null; energy: number; danceability: number; reactive: boolean }

interface AudioFxValue {
  filters: Record<FilterId, boolean>;
  toggleFilter: (id: FilterId) => void;
  pitch: number;
  setPitch: (semitones: number) => void;
  normalizer: boolean;
  setNormalizer: (on: boolean) => void;
  normalizerStatus: string;
  fxAvailable: boolean;
  /** Set when an effect couldn't be applied (e.g. a streamed source, or the audio engine paused by the system). Null when fine. */
  fxError: string | null;

  autoVolume: boolean;
  setAutoVolume: (on: boolean) => void;

  deepSleep: boolean;
  setDeepSleep: (on: boolean) => void;
  deepSleepStart: number;
  setDeepSleepStart: (hour: number) => void;

  zones: FocusZone[];
  addZone: (zone: Omit<FocusZone, "id">) => void;
  removeZone: (id: string) => void;
  activeZoneId: string | null;
  setActiveZoneId: (id: string | null) => void;

  markers: Marker[];
  addMarker: (label: string, at: number) => void;
  removeMarker: (id: string) => void;

  radio: boolean;
  setRadio: (on: boolean) => void;

  hue: HueConfig;
  setHue: (cfg: HueConfig) => void;
  hueSync: boolean;
  setHueSync: (on: boolean) => void;

  insights: Insights;
}

const Ctx = createContext<AudioFxValue | null>(null);
const DEFAULT_FILTERS: Record<FilterId, boolean> = { reverb: false, echo: false, distortion: false, bitcrush: false };

const DJ_NAMES = ["DJ Velvet Static", "Mike “Midnight” Moreau", "Lola Lightwave", "Big Ted Tapedeck"];
const AD_LINES = [
  "This hour is brought to you by Zap-O-Matic batteries — now with 40 percent more zap.",
  "Mondo Burger! Two patties, zero regrets. Mondo Burger — it's what's for later.",
  "Call 555-0199 for Rocket Rental Cars. Ask about our moon-to-moon rates.",
  "Neon Noodle Palace. Slurp responsibly.",
];

export function AudioFxProvider({ children }: { children: ReactNode }) {
  const { audioElement, currentTrack, isPlaying, position, duration, seek, setGainMultiplier, volume } = usePlayback();
  const { tracks: library } = useLibrary();

  const [filters, setFilters] = usePersistentState<Record<FilterId, boolean>>("fx.filters", DEFAULT_FILTERS);
  const [pitch, setPitch] = usePersistentState<number>("fx.pitch", 0);
  const [normalizer, setNormalizer] = usePersistentState<boolean>("fx.normalizer", false);
  const [autoVolume, setAutoVolume] = usePersistentState<boolean>("fx.autoVolume", false);
  const [deepSleep, setDeepSleep] = usePersistentState<boolean>("fx.deepSleep", false);
  const [deepSleepStart, setDeepSleepStart] = usePersistentState<number>("fx.deepSleepStart", 23);
  const [zones, setZones] = usePersistentState<Record<string, FocusZone[]>>("fx.zones", {});
  const [markersByTrack, setMarkersByTrack] = usePersistentState<Record<string, Marker[]>>("fx.markers", {});
  const [radio, setRadio] = usePersistentState<boolean>("fx.radio", false);
  const [hue, setHue] = usePersistentState<HueConfig>("fx.hue", { bridgeIp: "", appKey: "", lights: "1" });
  const [hueSync, setHueSync] = usePersistentState<boolean>("fx.hueSync", false);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [normalizerStatus, setNormalizerStatus] = useState("Off");
  const [fxError, setFxError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insights>({ bpm: null, key: null, energy: 0, danceability: 0, reactive: false });

  const trackId = currentTrack?.id ?? "";
  const fxAvailable = isTauri() && typeof AudioContext !== "undefined";

  // Multipliers from the different volume features are composed, never fighting over one value.
  const mult = useRef({ auto: 1, sleep: 1, duck: 1, normalizeGain: 1 });
  const pushGain = useCallback(() => setGainMultiplier(mult.current.auto * mult.current.sleep * mult.current.duck), [setGainMultiplier]);

  // ---- effect chain + normalizer ------------------------------------------------------------------------
  const anyFx = Object.values(filters).some(Boolean) || pitch !== 0 || normalizer;
  const normalizeGainRef = useRef(1);

  // 2.2.0 root cause of "undo is delayed / effects stay on": the old code returned early when NO effect was left on, so switching
  // off the LAST effect never rebuilt the graph and the previous chain stayed wired in until something else triggered a rebuild.
  // Now a rebuild always runs when the element is routed — "nothing on" rebuilds to a clean bypass.
  const rebuildSeq = useRef(0);
  const rebuild = useCallback(async () => {
    if (!audioElement || !fxAvailable) return;
    if (!anyFx && !isRouted()) return; // nothing was ever routed → nothing to undo
    const seq = ++rebuildSeq.current;
    const settings = { filters, normalizeGain: normalizer ? normalizeGainRef.current : 1, pitchSemitones: pitch };
    if (!isRouted()) {
      if (!canRouteThroughGraph(audioElement)) {
        setFxError("Effects only work on tracks from your library — streamed sources can't be processed.");
        return;
      }
      // Never route into a suspended AudioContext (that is silence). Resume first; if the system refuses, say so and stay un-routed.
      if (!(await ensureRunning())) {
        setFxError("The audio engine is paused by the system. Press play, then toggle the effect again.");
        return;
      }
      if (!routeThroughGraph(audioElement)) {
        setFxError("Couldn't attach the effects engine to this track.");
        return;
      }
    } else {
      resumeContext();
    }
    if (pitch !== 0) await initPitchWorklet();
    if (seq !== rebuildSeq.current) return; // a newer toggle superseded this one — apply only the latest state
    const result = applyEffects(settings);
    setFxError(result.ok ? null : (result.error ?? "An effect couldn't be applied."));
  }, [audioElement, anyFx, filters, pitch, normalizer, fxAvailable]);

  useEffect(() => {
    void rebuild();
  }, [rebuild]);

  // Playing is a user-initiated moment: retry effects that were refused earlier because the audio engine was suspended.
  useEffect(() => {
    if (isPlaying && anyFx && !isRouted()) void rebuild();
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!normalizer) { normalizeGainRef.current = 1; setNormalizerStatus("Off"); return; }
    const track = currentTrack;
    if (!track?.path) { normalizeGainRef.current = 1; setNormalizerStatus("Only local files are normalized"); void rebuild(); return; }
    let cancelled = false;
    setNormalizerStatus("Analyzing loudness…");
    (async () => {
      const key = `blackmusic:loudness:${track.path}:${track.size ?? 0}`;
      const cached = await getPreference<number | null>(key, null);
      let g: number;
      if (cached === null) {
        const { invoke } = await import("@tauri-apps/api/core");
        const r = await invoke<{ gain: number; rmsDb: number }>("analyze_loudness", { path: track.path, targetDb: -16 });
        g = r.gain;
        await setPreference(key, g);
      } else {
        g = cached;
      }
      if (cancelled) return;
      normalizeGainRef.current = g;
      setNormalizerStatus(`Gain ×${g.toFixed(2)} (${g >= 1 ? "+" : ""}${(20 * Math.log10(g)).toFixed(1)} dB)`);
      void rebuild();
    })().catch((e) => !cancelled && setNormalizerStatus(`Couldn't analyze: ${e instanceof Error ? e.message : String(e)}`));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizer, trackId]);

  // ---- focus zones (loop a custom in-song section) --------------------------------------------------------
  const trackZones = zones[trackId] ?? [];
  useEffect(() => {
    if (!activeZoneId) return;
    const z = trackZones.find((x) => x.id === activeZoneId);
    if (!z) { setActiveZoneId(null); return; }
    if (position >= z.end || position < z.start - 0.5) seek(z.start);
  }, [position, activeZoneId, trackZones, seek]);
  useEffect(() => setActiveZoneId(null), [trackId]);

  // ---- one shared analysis loop: auto volume, deep-sleep, insights, hue --------------------------------------
  const fade = useRef({ silentFor: 0, sleepStarted: 0 });
  const insightState = useRef({ flux: [] as number[], prev: new Float32Array(128), beats: [] as number[], chroma: new Float32Array(12), energyAvg: 0, last: 0 });
  const hueLast = useRef(0);

  useEffect(() => {
    let raf = 0;
    let lastTs = performance.now();
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const dt = (ts - lastTs) / 1000;
      if (ts - lastTs < 50) return; // ~20 Hz is plenty for control logic
      lastTs = ts;
      const wantSpectrum = autoVolume || hueSync || isPlaying;
      if (!wantSpectrum || !audioElement) return;
      const sp = readSpectrum(audioElement, isPlaying);

      // Auto Volume Adjust — dip during silent passages, restore on sound ("Netflix-style")
      if (autoVolume && sp.reactive) {
        fade.current.silentFor = sp.level < 0.015 ? fade.current.silentFor + dt : 0;
        const target = fade.current.silentFor > 1.2 ? 0.35 : 1;
        mult.current.auto += (target - mult.current.auto) * Math.min(1, dt * 1.5);
        pushGain();
      } else if (mult.current.auto !== 1) {
        mult.current.auto = 1;
        pushGain();
      }

      // Insights (only when real audio data flows)
      const st = insightState.current;
      const bins = 128;
      let flux = 0;
      for (let i = 0; i < bins; i++) {
        const v = sp.freq[i] / 255;
        flux += Math.max(0, v - st.prev[i]);
        st.prev[i] = v;
      }
      const now = ts / 1000;
      if (sp.reactive) {
        st.energyAvg = st.energyAvg * 0.97 + sp.level * 0.03;
        st.flux.push(flux);
        if (st.flux.length > 40) st.flux.shift();
        const mean = st.flux.reduce((a, b) => a + b, 0) / st.flux.length;
        if (flux > mean * 1.6 + 0.6 && now - (st.beats[st.beats.length - 1] ?? 0) > 0.28) {
          st.beats.push(now);
          if (st.beats.length > 24) st.beats.shift();
        }
        // chroma from the low-mid spectrum (bin ≈ 43 Hz at fftSize 1024 / 44.1k)
        for (let i = 2; i < 120; i++) {
          const hz = i * 43.07;
          const midi = 69 + 12 * Math.log2(hz / 440);
          st.chroma[((Math.round(midi) % 12) + 12) % 12] += sp.freq[i] / 255;
        }
        if (now - st.last > 1) {
          st.last = now;
          const intervals = st.beats.slice(1).map((b, i) => b - st.beats[i]);
          let bpm: number | null = null;
          let regular = 0;
          if (intervals.length >= 6) {
            const sorted = [...intervals].sort((a, b) => a - b);
            const med = sorted[Math.floor(sorted.length / 2)];
            bpm = 60 / med;
            while (bpm < 70) bpm *= 2;
            while (bpm > 180) bpm /= 2;
            const dev = intervals.reduce((a, b) => a + Math.abs(b - med), 0) / intervals.length;
            regular = Math.max(0, 1 - dev / med * 2.5);
          }
          const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
          const major = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
          const minor = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
          let best = { s: -Infinity, k: "" };
          const total = st.chroma.reduce((a, b) => a + b, 0) || 1;
          for (let r = 0; r < 12; r++) {
            for (const [profile, label] of [[major, "major"], [minor, "minor"]] as [number[], string][]) {
              let s = 0;
              for (let i = 0; i < 12; i++) s += (st.chroma[(i + r) % 12] / total) * profile[i];
              if (s > best.s) best = { s, k: `${names[r]} ${label}` };
            }
          }
          setInsights({
            bpm: bpm ? Math.round(bpm) : null,
            key: best.k || null,
            energy: Math.min(1, st.energyAvg * 3.2),
            danceability: Math.min(1, regular * 0.65 + Math.min(1, sp.bass * 1.6) * 0.35),
            reactive: true,
          });
        }
      } else {
        setInsights((p) => (p.reactive ? { bpm: null, key: null, energy: 0, danceability: 0, reactive: false } : p));
      }

      // Sound mood lighting → Philips Hue (throttled; local bridge over HTTP)
      if (hueSync && hue.bridgeIp && hue.appKey && ts - hueLast.current > 450) {
        hueLast.current = ts;
        const bass = sp.bass;
        const h = Math.floor(((ts / 60) % 360) * 182);
        const bri = Math.min(254, Math.floor(40 + sp.level * 600 + bass * 120));
        for (const id of hue.lights.split(",").map((s) => s.trim()).filter(Boolean)) {
          void serviceFetch(`http://${hue.bridgeIp}/api/${hue.appKey}/lights/${id}/state`, {
            method: "PUT",
            body: JSON.stringify({ on: true, hue: h % 65535, sat: 220, bri, transitiontime: bass > 0.6 ? 0 : 3 }),
          }).catch(() => undefined);
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [audioElement, autoVolume, hueSync, hue, isPlaying, pushGain]);

  useEffect(() => {
    insightState.current.beats = [];
    insightState.current.chroma.fill(0);
    insightState.current.flux = [];
  }, [trackId]);

  // ---- Deep Sleep Auto-Fader: after the chosen hour, with no interaction, fade out over 60 s and stop ----------
  const lastInput = useRef(Date.now());
  useEffect(() => {
    const bump = () => { lastInput.current = Date.now(); if (mult.current.sleep !== 1) { mult.current.sleep = 1; fade.current.sleepStarted = 0; pushGain(); } };
    for (const e of ["pointerdown", "keydown", "wheel"] as const) window.addEventListener(e, bump, { passive: true });
    return () => { for (const e of ["pointerdown", "keydown", "wheel"] as const) window.removeEventListener(e, bump); };
  }, [pushGain]);
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;
  const { togglePlay } = usePlayback();
  useEffect(() => {
    if (!deepSleep) { mult.current.sleep = 1; pushGain(); return; }
    const timer = window.setInterval(() => {
      if (!playingRef.current) return;
      const hour = new Date().getHours();
      const inWindow = deepSleepStart > 12 ? hour >= deepSleepStart || hour < 6 : hour >= deepSleepStart && hour < 6;
      const idleMs = Date.now() - lastInput.current;
      if (!inWindow || idleMs < 10 * 60 * 1000) return;
      if (!fade.current.sleepStarted) fade.current.sleepStarted = Date.now();
      const t = (Date.now() - fade.current.sleepStarted) / 60000;
      mult.current.sleep = Math.max(0, 1 - t);
      pushGain();
      if (t >= 1) { togglePlay(); fade.current.sleepStarted = 0; mult.current.sleep = 1; pushGain(); }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [deepSleep, deepSleepStart, pushGain, togglePlay]);

  // ---- Customizable Radio Simulation: fictional DJs, ads and dedications between songs (offline speech synthesis) --
  const radioCount = useRef(0);
  const lastRadioTrack = useRef("");
  useEffect(() => {
    if (!radio || !currentTrack || !isPlaying || lastRadioTrack.current === currentTrack.id) return;
    lastRadioTrack.current = currentTrack.id;
    if (!("speechSynthesis" in window)) return;
    radioCount.current += 1;
    const dj = DJ_NAMES[radioCount.current % DJ_NAMES.length];
    const names = [...new Set(library.map((t) => t.artist).filter((a) => a && a !== "Unknown artist"))];
    const friend = ["Jamie", "Sam", "Alex", "Robin", "Casey"][radioCount.current % 5];
    const lines = [
      `You're listening to BlackMusic FM, nineteen ninety-something. I'm ${dj}. Up next, ${currentTrack.title} by ${currentTrack.artist}.`,
      `That one goes out to ${friend} — you know who you are. Here's ${currentTrack.title}.`,
      names.length ? `If you like ${names[radioCount.current % names.length]}, stay right here. This is ${currentTrack.artist} with ${currentTrack.title}.` : `Stay tuned, this is ${currentTrack.artist}.`,
    ];
    const text = radioCount.current % 4 === 0 ? AD_LINES[Math.floor(radioCount.current / 4) % AD_LINES.length] : lines[radioCount.current % lines.length];
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 0.9 + (radioCount.current % 3) * 0.12;
    u.volume = Math.min(1, volume + 0.2);
    mult.current.duck = 0.3; pushGain();
    u.onend = () => { mult.current.duck = 1; pushGain(); };
    u.onerror = u.onend;
    window.speechSynthesis.speak(u);
    return () => undefined;
  }, [radio, currentTrack?.id, isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<AudioFxValue>(
    () => ({
      filters, toggleFilter: (id) => setFilters((f) => ({ ...f, [id]: !f[id] })),
      pitch, setPitch, normalizer, setNormalizer, normalizerStatus, fxAvailable, fxError,
      autoVolume, setAutoVolume, deepSleep, setDeepSleep, deepSleepStart, setDeepSleepStart,
      zones: trackZones,
      addZone: (z) => setZones((all) => ({ ...all, [trackId]: [...(all[trackId] ?? []), { ...z, id: `z${Date.now()}` }] })),
      removeZone: (id) => setZones((all) => ({ ...all, [trackId]: (all[trackId] ?? []).filter((z) => z.id !== id) })),
      activeZoneId, setActiveZoneId,
      markers: markersByTrack[trackId] ?? [],
      addMarker: (label, at) => setMarkersByTrack((all) => ({ ...all, [trackId]: [...(all[trackId] ?? []), { id: `m${Date.now()}`, at, label }].sort((a, b) => a.at - b.at) })),
      removeMarker: (id) => setMarkersByTrack((all) => ({ ...all, [trackId]: (all[trackId] ?? []).filter((m) => m.id !== id) })),
      radio, setRadio, hue, setHue, hueSync, setHueSync, insights,
    }),
    [filters, pitch, normalizer, normalizerStatus, fxAvailable, fxError, autoVolume, deepSleep, deepSleepStart, trackZones, trackId, activeZoneId, markersByTrack, radio, hue, hueSync, insights, setFilters, setPitch, setNormalizer, setAutoVolume, setDeepSleep, setDeepSleepStart, setZones, setMarkersByTrack, setRadio, setHue, setHueSync],
  );
  void duration;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudioFx(): AudioFxValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAudioFx must be used within an AudioFxProvider");
  return ctx;
}
