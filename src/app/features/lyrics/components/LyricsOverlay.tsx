import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLyrics } from "../context/LyricsContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { getCurrentLyricLine } from "../utils/lyricsNormalizer";
import "./Lyrics.css";

/** Renders ONLY `lyrics.lines` — it knows nothing about Genius or any provider. */
export function LyricsOverlay() {
  const { document: doc, status, settings, generateFromAudio, transcribing } = useLyrics();
  const { position, currentTrack } = usePlayback();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const current = doc?.synced ? getCurrentLyricLine(doc.lines, position) : undefined;

  // 2.2.0: adapt to whatever space the stage gives us (aspect-ratio presets, minimized windows, fullscreen, phones).
  useLayoutEffect(() => {
    const parent = wrapRef.current?.parentElement;
    if (!parent) return;
    const update = () => setScale(Math.min(1.9, Math.max(0.55, Math.min(parent.clientWidth / 420, parent.clientHeight / 260))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!settings.autoScroll || !current) return;
    listRef.current?.querySelector(`[data-line-id="${current.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current?.id, settings.autoScroll]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = {
    color: settings.textColor,
    fontFamily: settings.fontFamily,
    fontSize: `${Math.round(settings.fontSize * scale)}px`,
    fontWeight: settings.fontWeight,
    lineHeight: settings.lineSpacing,
    padding: `${Math.round(settings.padding * Math.min(1.3, scale))}px`,
    opacity: settings.opacity,
    background: `color-mix(in srgb, ${settings.backgroundColor} 55%, transparent)`,
    width: `${settings.maxWidth}%`,
    ["--karaoke" as string]: settings.karaokeColor,
  } as const;

  const renderLine = (line: { id: string; text: string; startTime?: number; endTime?: number }, isCurrent: boolean) => {
    const text = line.text || "\u00A0";
    if (!(settings.karaoke && isCurrent && line.startTime !== undefined && line.endTime !== undefined)) return text;
    const progress = Math.min(1, Math.max(0, (position - line.startTime) / Math.max(0.1, line.endTime - line.startTime)));
    const words = text.split(" ");
    // Words fill in proportion to their length, so long words take longer — closer to how the line is actually sung.
    const total = words.reduce((n, w) => n + w.length + 1, 0);
    let seen = 0;
    return words.map((w, i) => {
      const from = seen / total;
      seen += w.length + 1;
      const to = seen / total;
      const fill = Math.min(1, Math.max(0, (progress - from) / Math.max(0.001, to - from)));
      return (
        <span key={i} className="lyrics__word" style={{ ["--fill" as string]: `${fill * 100}%` }}>
          {w}{" "}
        </span>
      );
    });
  };

  let body;
  if (status === "loading") body = <p className="lyrics__note">Finding lyrics…</p>;
  else if (!doc)
    body = (
      <>
        <p className="lyrics__note">{status === "idle" ? "Play something to see lyrics." : "Lyrics unavailable for this track."}</p>
        {status === "unavailable" && currentTrack?.path && (
          <button type="button" className="lyrics__generate" disabled={transcribing} onClick={() => void generateFromAudio()}>
            {transcribing ? "Transcribing with whisper.cpp…" : "Generate with whisper.cpp"}
          </button>
        )}
      </>
    );
  else if (settings.showCurrentLineOnly && doc.synced)
    body = (
      <p key={current?.id} className="lyrics__line lyrics__line--current" data-animation={settings.animation} data-karaoke={settings.karaoke}>
        {current ? renderLine(current, true) : "♪"}
      </p>
    );
  else
    body = doc.lines.map((line) => {
      const isCurrent = current?.id === line.id;
      return (
        <p key={line.id} data-line-id={line.id} data-karaoke={settings.karaoke && isCurrent} className={`lyrics__line${isCurrent ? " lyrics__line--current" : ""}`} data-animation={settings.animation}>
          {renderLine(line, isCurrent)}
        </p>
      );
    });

  return (
    <div className="lyrics-overlay" data-alignment={settings.alignment} data-shadow={settings.shadow} style={style} ref={(el) => { wrapRef.current = el; listRef.current = el; }}>
      {body}
      {doc?.sourceUrl && <a className="lyrics__source" href={doc.sourceUrl} target="_blank" rel="noreferrer">Song info on Genius</a>}
    </div>
  );
}
