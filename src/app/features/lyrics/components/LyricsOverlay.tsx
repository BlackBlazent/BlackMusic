import { useEffect, useRef } from "react";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useLyrics } from "../context/LyricsContext";
import { getCurrentLyricLine } from "../utils/lyricsNormalizer";
import "./Lyrics.css";

/** Renders ONLY `lyrics.lines` — it knows nothing about Genius or any provider. */
export function LyricsOverlay() {
  const { document: doc, status, settings } = useLyrics();
  const { position } = usePlayback();
  const listRef = useRef<HTMLDivElement>(null);
  const current = doc?.synced ? getCurrentLyricLine(doc.lines, position) : undefined;

  useEffect(() => {
    if (!settings.autoScroll || !current) return;
    listRef.current?.querySelector(`[data-line-id="${current.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current?.id, settings.autoScroll]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = {
    color: settings.textColor,
    fontFamily: settings.fontFamily,
    fontSize: `${settings.fontSize}px`,
    fontWeight: settings.fontWeight,
    lineHeight: settings.lineSpacing,
    padding: `${settings.padding}px`,
    maxWidth: `${settings.maxWidth}%`,
    opacity: settings.opacity,
    background: `color-mix(in srgb, ${settings.backgroundColor} 55%, transparent)`,
  } as const;

  let body;
  if (status === "loading") body = <p className="lyrics__note">Finding lyrics…</p>;
  else if (!doc) body = <p className="lyrics__note">{status === "idle" ? "Play something to see lyrics." : "Lyrics unavailable for this track."}</p>;
  else if (settings.showCurrentLineOnly && doc.synced) body = <p key={current?.id} className="lyrics__line lyrics__line--current" data-animation={settings.animation}>{current?.text ?? "♪"}</p>;
  else
    body = doc.lines.map((line) => (
      <p key={line.id} data-line-id={line.id} className={`lyrics__line${current?.id === line.id ? " lyrics__line--current" : ""}`} data-animation={settings.animation}>
        {line.text || "\u00A0"}
      </p>
    ));

  return (
    <div className="lyrics-overlay" data-alignment={settings.alignment} data-shadow={settings.shadow} style={style} ref={listRef}>
      {body}
      {doc?.sourceUrl && <a className="lyrics__source" href={doc.sourceUrl} target="_blank" rel="noreferrer">Song info on Genius</a>}
    </div>
  );
}
