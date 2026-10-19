/**
 * 2.2.0 — shared Web Audio tap on the app's single <audio> element.
 *
 * Why captureStream() for analysis: `createMediaElementSource()` re-routes the element's sound through the graph
 * PERMANENTLY, and for cross-origin streams without CORS headers (YouTube/Deezer previews) it outputs SILENCE — that
 * would mute half the catalog. `captureStream()` taps a copy without touching playback; cross-origin sources simply
 * yield a silent copy, in which case the analyser reports `reactive=false` and visuals fall back to a gentle
 * synthetic pulse driven by the playback clock.
 *
 * Effects that must change the audible sound (filters, pitch, EQ) DO need the element routed through the graph, so
 * they call `routeThroughGraph()` — which is only done on demand, for local (blob:) sources, and is reverted by
 * clearing the effect chain (the element stays routed, with the chain bypassed).
 */
const makeBytes = (n: number) => new Uint8Array(n); // keeps the ArrayBuffer-backed type that AnalyserNode wants
type Bytes = ReturnType<typeof makeBytes>;
type Taps = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  freq: Bytes;
  wave: Bytes;
};

let taps: Taps | null = null;
let boundElement: HTMLAudioElement | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let boundSrc = "";
let lastCaptureTry = 0;

function ensureContext(): Taps {
  if (!taps) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;
    taps = { ctx, analyser, freq: makeBytes(analyser.frequencyBinCount), wave: makeBytes(analyser.fftSize) };
  }
  return taps;
}

/** Attach (or re-attach after a source change) the analyser to the element. Returns null if unsupported. */
export function attachAnalyser(audio: HTMLAudioElement): Taps | null {
  try {
    const t = ensureContext();
    if (t.ctx.state === "suspended") void t.ctx.resume();
    // Once the element is routed through the effect graph the analyser listens to the graph's OUTPUT (what you actually hear,
    // effects included) — no captureStream copy needed.
    if (routed) {
      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
      }
      return t;
    }
    const capture = (audio as HTMLAudioElement & { captureStream?: () => MediaStream }).captureStream?.bind(audio);
    if (!capture) return null;
    // 2.2.0 fix: this used to call captureStream() on EVERY animation frame and rebind a new MediaStreamSource whenever the
    // (always new) track ids differed — a steady graph leak. Now it binds once per source and only retries (throttled) while the
    // element has no audio track yet.
    if (boundElement === audio && boundSrc === audio.currentSrc && sourceNode) return t;
    const now = performance.now();
    if (boundElement === audio && boundSrc === audio.currentSrc && !sourceNode && now - lastCaptureTry < 500) return t;
    lastCaptureTry = now;
    const stream = capture();
    sourceNode?.disconnect();
    sourceNode = null;
    boundElement = audio;
    if (stream.getAudioTracks().length === 0) {
      boundSrc = ""; // not ready yet — retry soon
      return t;
    }
    boundSrc = audio.currentSrc;
    sourceNode = t.ctx.createMediaStreamSource(stream);
    sourceNode.connect(t.analyser); // analyser is NOT connected to destination → no double playback
    return t;
  } catch {
    return null;
  }
}

export interface Spectrum {
  freq: Bytes;
  wave: Bytes;
  /** 0–1 overall energy */
  level: number;
  /** 0–1 low-frequency (kick/bass) energy */
  bass: number;
  /** true when real audio data is flowing; false → synthetic fallback */
  reactive: boolean;
}

const synth = { freq: makeBytes(512), wave: makeBytes(1024) };

export function readSpectrum(audio: HTMLAudioElement | null, playing: boolean): Spectrum {
  const t = audio ? attachAnalyser(audio) : null;
  if (t && (sourceNode || routed) && playing) {
    t.analyser.getByteFrequencyData(t.freq);
    t.analyser.getByteTimeDomainData(t.wave);
    let sum = 0;
    for (let i = 0; i < t.freq.length; i++) sum += t.freq[i];
    let bass = 0;
    for (let i = 0; i < 8; i++) bass += t.freq[i];
    const level = sum / (t.freq.length * 255);
    if (level > 0.002) return { freq: t.freq, wave: t.wave, level, bass: bass / (8 * 255), reactive: true };
  }
  // Synthetic fallback so the visuals still move with the music clock (never claims to be real data).
  const now = performance.now() / 1000;
  for (let i = 0; i < synth.freq.length; i++) {
    const v = playing ? (Math.sin(now * 2 + i * 0.13) * 0.5 + 0.5) * (1 - i / synth.freq.length) * 200 * (0.6 + 0.4 * Math.sin(now * 3.1)) : 0;
    synth.freq[i] = v;
  }
  for (let i = 0; i < synth.wave.length; i++) synth.wave[i] = 128 + (playing ? Math.sin(now * 6 + i * 0.05) * 40 * Math.sin(now * 1.3) : 0);
  const bassSynth = playing ? (Math.sin(now * 4) * 0.5 + 0.5) * 0.7 : 0;
  return { freq: synth.freq, wave: synth.wave, level: playing ? 0.35 : 0, bass: bassSynth, reactive: false };
}

// ---------------------------------------------------------------------------------- effect chain (filters, pitch, EQ)
export type FilterId = "reverb" | "echo" | "distortion" | "bitcrush";

let routed = false;
let effectIn: GainNode | null = null;
let effectOut: GainNode | null = null;
let chainNodes: AudioNode[] = [];
let mediaSource: MediaElementAudioSourceNode | null = null;
let bitcrushNode: AudioNode | null = null;

let impulseCache: { ctx: AudioContext; buf: AudioBuffer } | null = null;
/** The reverb impulse is generated ONCE per context (it used to be regenerated — 2 s of stereo noise — on every toggle, stalling the UI thread). */
function cachedImpulse(ctx: AudioContext): AudioBuffer {
  if (!impulseCache || impulseCache.ctx !== ctx) impulseCache = { ctx, buf: impulse(ctx) };
  return impulseCache.buf;
}

function impulse(ctx: AudioContext, seconds = 2.2, decay = 2.4): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function distortionCurve(amount: number): Float32Array {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/** Local (blob:) or same-origin sources only — cross-origin streams would go silent when routed. */
export function canRouteThroughGraph(audio: HTMLAudioElement): boolean {
  return audio.src.startsWith("blob:") || audio.src.startsWith("asset:") || audio.src.startsWith(window.location.origin) || audio.src === "";
}

/**
 * Resolves true only when the AudioContext is actually RUNNING. Routing the <audio> element into a suspended context makes the
 * element silent (its output goes to a graph that isn't rendering) — which is exactly what "turn on Reverb and the audio is gone"
 * looks like — so callers must await this before routing.
 */
export async function ensureRunning(): Promise<boolean> {
  const t = ensureContext();
  if (t.ctx.state !== "running") {
    try {
      await t.ctx.resume();
    } catch {
      /* autoplay policy: needs a user gesture */
    }
  }
  return t.ctx.state === "running";
}

export function routeThroughGraph(audio: HTMLAudioElement): boolean {
  if (routed) return true;
  if (!canRouteThroughGraph(audio)) return false;
  const t = ensureContext();
  if (t.ctx.state !== "running") return false; // never route into a suspended context
  mediaSource = t.ctx.createMediaElementSource(audio);
  effectIn = t.ctx.createGain();
  effectOut = t.ctx.createGain();
  mediaSource.connect(effectIn);
  effectIn.connect(effectOut);
  effectOut.connect(t.ctx.destination);
  effectOut.connect(t.analyser); // visuals/insights hear the processed output
  routed = true;
  return true;
}

export function isRouted() {
  return routed;
}

export interface EffectSettings {
  filters: Partial<Record<FilterId, boolean>>;
  /** Linear gain from the Volume Normalizer */
  normalizeGain: number;
  /** Pitch shift in semitones (−12…+12) WITHOUT changing playback speed. */
  pitchSemitones?: number;
}

// ---- pitch shifter: granular two-tap delay-line (AudioWorklet), pitch changes while speed stays put ----------
const PITCH_WORKLET = `
class BMPitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'pitch', defaultValue: 1, minValue: 0.5, maxValue: 2 }]; }
  constructor() {
    super();
    this.size = 16384; this.mask = this.size - 1; this.grain = 3072;
    this.bufs = [new Float32Array(this.size), new Float32Array(this.size)];
    this.w = 0; this.phase = 0;
  }
  read(buf, delay) {
    const pos = this.w - delay; const i = Math.floor(pos); const f = pos - i;
    const a = buf[i & this.mask], b = buf[(i + 1) & this.mask];
    return a + (b - a) * f;
  }
  process(inputs, outputs, params) {
    const input = inputs[0]; const output = outputs[0];
    if (!input || input.length === 0) return true;
    const pitch = params.pitch.length > 1 ? params.pitch[0] : params.pitch[0];
    const rate = 1 - pitch;
    const frames = output[0].length;
    for (let n = 0; n < frames; n++) {
      this.phase += rate / this.grain; this.phase -= Math.floor(this.phase);
      const p2 = (this.phase + 0.5) % 1;
      const w1 = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.phase);
      const w2 = 0.5 - 0.5 * Math.cos(2 * Math.PI * p2);
      for (let c = 0; c < output.length; c++) {
        const buf = this.bufs[Math.min(c, 1)];
        const x = (input[c] || input[0])[n];
        buf[this.w & this.mask] = x;
        output[c][n] = w1 * this.read(buf, this.phase * this.grain + 1) + w2 * this.read(buf, p2 * this.grain + 1);
      }
      this.w = (this.w + 1) & this.mask;
    }
    return true;
  }
}
registerProcessor('bm-pitch-shifter', BMPitchShifter);
`;
let pitchReady = false;
export async function initPitchWorklet(): Promise<boolean> {
  if (pitchReady) return true;
  if (!taps || !taps.ctx.audioWorklet) return false;
  try {
    const url = URL.createObjectURL(new Blob([PITCH_WORKLET], { type: "application/javascript" }));
    await taps.ctx.audioWorklet.addModule(url);
    pitchReady = true;
    return true;
  } catch {
    return false;
  }
}

/** Rebuilds the chain: in → [reverb | echo | distortion | 8-bit] → gain(normalizer) → out. */
export interface ApplyResult {
  ok: boolean;
  error?: string;
}

/** Straight through: in → out. What "all effects off" means — no chain nodes left connected. */
export function bypassEffects(): void {
  if (!effectIn || !effectOut) return;
  effectIn.disconnect();
  chainNodes.forEach((n) => {
    try {
      n.disconnect();
    } catch {
      /* already disconnected */
    }
  });
  chainNodes = [];
  bitcrushNode = null;
  effectIn.connect(effectOut);
}

/** Rebuilds the chain from scratch (synchronously, so a toggle is audible immediately). On ANY failure it falls back to bypass,
 *  so a broken effect can never leave the player silent. */
export function applyEffects(settings: EffectSettings): ApplyResult {
  if (!routed || !effectIn || !effectOut || !taps) return { ok: false, error: "Audio effects aren't active yet." };
  const noEffects = !Object.values(settings.filters).some(Boolean) && !settings.pitchSemitones && settings.normalizeGain === 1;
  if (noEffects) {
    bypassEffects();
    return { ok: true };
  }
  try {
    buildChain(settings);
    return { ok: true };
  } catch (e) {
    bypassEffects();
    return { ok: false, error: `An effect couldn't be applied (${e instanceof Error ? e.message : String(e)}). Playing without effects.` };
  }
}

function buildChain(settings: EffectSettings): void {
  const ctx = taps!.ctx;
  const effectInNode = effectIn!;
  const effectOutNode = effectOut!;
  effectInNode.disconnect();
  chainNodes.forEach((n) => {
    try {
      n.disconnect();
    } catch {
      /* already disconnected */
    }
  });
  chainNodes = [];
  bitcrushNode = null;

  let tail: AudioNode = effectInNode;
  const add = (node: AudioNode) => {
    tail.connect(node);
    chainNodes.push(node);
    tail = node;
  };

  if (settings.filters.distortion) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(60) as unknown as Float32Array<ArrayBuffer>;
    shaper.oversample = "4x";
    add(shaper);
  }
  if (settings.filters.bitcrush) {
    // 8-bit retro: quantize through a wave shaper (16 levels) + a low-pass for the lo-fi sample-rate feel
    const crusher = ctx.createWaveShaper();
    const levels = 24;
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i * 2) / curve.length - 1;
      curve[i] = Math.round(x * levels) / levels;
    }
    crusher.curve = curve as unknown as Float32Array<ArrayBuffer>;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 4800;
    add(crusher);
    add(lp);
    bitcrushNode = crusher;
  }
  if (settings.filters.echo) {
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.32;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const mix = ctx.createGain();
    const dry = tail;
    delay.connect(feedback);
    feedback.connect(delay);
    dry.connect(delay);
    delay.connect(mix);
    chainNodes.push(delay, feedback, mix);
    const merge = ctx.createGain();
    dry.connect(merge);
    mix.connect(merge);
    chainNodes.push(merge);
    tail = merge;
  }
  if (settings.filters.reverb) {
    const conv = ctx.createConvolver();
    conv.buffer = cachedImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    const merge = ctx.createGain();
    tail.connect(conv);
    conv.connect(wet);
    tail.connect(dry);
    wet.connect(merge);
    dry.connect(merge);
    chainNodes.push(conv, wet, dry, merge);
    tail = merge;
  }
  if (settings.pitchSemitones && pitchReady) {
    const shifter = new AudioWorkletNode(ctx, "bm-pitch-shifter", { outputChannelCount: [2] });
    shifter.parameters.get("pitch")!.value = Math.pow(2, settings.pitchSemitones / 12);
    add(shifter);
  }
  const norm = ctx.createGain();
  norm.gain.value = settings.normalizeGain;
  add(norm);
  tail.connect(effectOutNode);
  void bitcrushNode;
}

export function resumeContext() {
  if (taps?.ctx.state === "suspended") void taps.ctx.resume();
}
