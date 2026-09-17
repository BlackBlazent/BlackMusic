import { useRef } from "react";
import type { Track } from "@/lib/types";
import { PlaygroundIcon } from "@/app/layout/icons";
import "./QueueStrip.css";

export function QueueStrip({
  tracks,
  currentTrackId,
  onSelect,
}: {
  tracks: Track[];
  currentTrackId?: string;
  onSelect: (track: Track) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (amount: number) => scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });

  if (tracks.length === 0) return null;

  return (
    <div className="queue-strip">
      <button type="button" className="queue-strip__nav" onClick={() => scrollBy(-320)} aria-label="Scroll left">
        ‹
      </button>
      <div className="queue-strip__track" ref={scrollRef}>
        {tracks.map((track) => (
          <button
            key={track.id}
            type="button"
            className="queue-strip__item"
            data-active={track.id === currentTrackId}
            onClick={() => onSelect(track)}
            title={`${track.title} — ${track.artist}`}
          >
            <span className="queue-strip__thumb">
              {track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <PlaygroundIcon />}
            </span>
            <span className="queue-strip__label">{track.title}</span>
          </button>
        ))}
      </div>
      <button type="button" className="queue-strip__nav" onClick={() => scrollBy(320)} aria-label="Scroll right">
        ›
      </button>
    </div>
  );
}
