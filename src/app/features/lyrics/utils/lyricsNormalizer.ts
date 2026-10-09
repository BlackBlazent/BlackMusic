import type { LyricLine } from "../types/lyrics.types";

const TIMESTAMP = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/** Parses LRC ("[01:23.45] text") into timed lines; end times come from the next line's start. */
export function parseLrc(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const row of raw.split(/\r?\n/)) {
    const stamps = [...row.matchAll(TIMESTAMP)];
    const text = row.replace(TIMESTAMP, "").trim();
    if (stamps.length === 0 || !text) continue;
    for (const m of stamps) {
      const frac = m[3] ? Number(`0.${m[3]}`) : 0;
      lines.push({ id: "", text, startTime: Number(m[1]) * 60 + Number(m[2]) + frac });
    }
  }
  lines.sort((a, b) => a.startTime! - b.startTime!);
  return lines.map((l, i) => ({ ...l, id: String(i + 1), endTime: lines[i + 1]?.startTime ?? l.startTime! + 6 }));
}

export function parsePlain(raw: string): LyricLine[] {
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .map((t) => t.trim())
    .map((text, i) => ({ id: String(i + 1), text }))
    .filter((l, i, all) => l.text || (i > 0 && all[i - 1].text)); // keep single blank lines as stanza breaks
}

/** Serialises back to a plain .txt (spec: lyrics are saved as a standard file locally). */
export function toPlainText(lines: LyricLine[]): string {
  return lines.map((l) => l.text).join("\n");
}

export function getCurrentLyricLine(lines: LyricLine[], currentTime: number): LyricLine | undefined {
  return lines.find((l) => l.startTime !== undefined && l.endTime !== undefined && currentTime >= l.startTime && currentTime < l.endTime);
}
