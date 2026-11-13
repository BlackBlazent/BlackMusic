import { isTauri } from "@/lib/platform";
import { isMobileOs } from "@/lib/useIsMobile";
import { NativeAddonMissing, nativeCall, nativeCapabilities } from "@/lib/mobileNative";
import { ffmpegRun } from "@/lib/ffmpeg";
import { getPreference, setPreference } from "@/lib/preferencesStore";
import type { LyricsDocument } from "@/app/features/lyrics/types/lyrics.types";
import type { Track } from "@/lib/types";

/** whisper.cpp front-end (speech-to-text for lyrics/captions, offline). Backed by src-tauri/src/tools.rs. */
export interface WhisperModel {
  id: string;
  file: string;
  approxMb: number;
  installed: boolean;
  bundled: boolean;
  englishOnly: boolean;
}
export interface Segment {
  start: number;
  end: number;
  text: string;
}

const MODEL_KEY = "blackmusic:whisperModel";
const CACHE_PREFIX = "blackmusic:whisperLyrics:";

export async function listModels(): Promise<WhisperModel[]> {
  if (!isTauri()) return [];
  const { invoke } = await import("@tauri-apps/api/core");
  const rows = await invoke<{ id: string; file: string; approx_mb: number; installed: boolean; bundled: boolean; english_only: boolean }[]>("whisper_list_models");
  return rows.map((r) => ({ id: r.id, file: r.file, approxMb: r.approx_mb, installed: r.installed, bundled: r.bundled, englishOnly: r.english_only }));
}

export async function downloadModel(id: string, onProgress: (done: number, total: number) => void): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const off = await listen<{ id: string; downloaded: number; total: number }>("whisper:progress", (e) => {
    if (e.payload.id === id) onProgress(e.payload.downloaded, e.payload.total);
  });
  try {
    await invoke("whisper_download_model", { id });
  } finally {
    off();
  }
}

export async function importModel(sourcePath: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("whisper_import_model", { sourcePath });
}

export async function deleteModel(id: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("whisper_delete_model", { id });
}

export const getActiveModel = () => getPreference<string>(MODEL_KEY, "tiny");
export const setActiveModel = (id: string) => setPreference(MODEL_KEY, id);

export async function transcribe(path: string, opts: { language?: string; translate?: boolean; model?: string } = {}): Promise<Segment[]> {
  if (!isTauri()) throw new Error("whisper.cpp needs the BlackMusic app.");
  const { invoke } = await import("@tauri-apps/api/core");
  const modelId = opts.model ?? (await getActiveModel());
  if (isMobileOs()) return transcribeOnDevice(path, modelId, opts.language);
  return invoke<Segment[]>("whisper_transcribe", { audioPath: path, modelId, language: opts.language ?? null, translate: Boolean(opts.translate) });
}

/** Stops the running transcription (the Rust side kills whisper-cli and cleans up its scratch folder). */
export async function cancelTranscription(): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("whisper_cancel");
}

/** Segments → the lyrics model the overlay already renders (time-synced lines). */
export function segmentsToLyrics(track: Pick<Track, "id" | "title" | "artist">, segments: Segment[]): LyricsDocument {
  return {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    provider: "other",
    fetchedAt: Date.now(),
    synced: true,
    lines: segments.map((s, i) => ({ id: `w${i}`, text: s.text, startTime: s.start, endTime: s.end })),
  };
}

export async function cachedWhisperLyrics(trackId: string): Promise<LyricsDocument | null> {
  return getPreference<LyricsDocument | null>(CACHE_PREFIX + trackId, null);
}
export async function cacheWhisperLyrics(doc: LyricsDocument): Promise<void> {
  await setPreference(CACHE_PREFIX + doc.trackId, doc);
}

export function linesToLrc(doc: LyricsDocument): string {
  const stamp = (t: number) => `[${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}]`;
  return doc.lines.map((l) => (l.startTime !== undefined ? `${stamp(l.startTime)}${l.text}` : l.text)).join("\n");
}

/**
 * Mobile: whisper.cpp runs as a native library (add-on), not an executable. Pipeline: FFmpeg turns the song into 16 kHz mono WAV in
 * the app cache → whisper reads the downloaded model → timed segments come back. The WAV is always deleted afterwards.
 */
async function transcribeOnDevice(path: string, modelId: string, language?: string): Promise<Segment[]> {
  const caps = nativeCapabilities();
  if (!caps.whisper) throw new NativeAddonMissing("whisper");
  if (!caps.ffmpeg) throw new NativeAddonMissing("ffmpeg");
  const { invoke } = await import("@tauri-apps/api/core");
  const model = await invoke<string>("whisper_model_path", { id: modelId });
  const { appCacheDir, join } = await import("@tauri-apps/api/path");
  const { mkdir, remove } = await import("@tauri-apps/plugin-fs");
  const dir = await appCacheDir();
  await mkdir(dir, { recursive: true }).catch(() => undefined);
  const wav = await join(dir, `whisper-${Date.now()}.wav`);
  try {
    const r = await ffmpegRun(["-y", "-i", path, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
    if (r.code !== 0) throw new Error("Couldn't prepare the audio for transcription. The file may be damaged or unsupported.");
    const json = await nativeCall((id) => window.BMNative!.whisperTranscribe(id, model, wav, language ?? "auto"), 30 * 60_000);
    const out = JSON.parse(json) as { error?: string; segments?: Segment[] };
    if (out.error) throw new Error(out.error);
    return out.segments ?? [];
  } finally {
    await remove(wav).catch(() => undefined);
  }
}
