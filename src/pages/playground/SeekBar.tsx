import { useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { formatDuration } from "@/lib/formatDuration";
import "./SeekBar.css";

/** "2:30", "1:02:03", "90" or "2.5" (seconds) -> seconds, or null if it isn't a time. */
export function parseTimeInput(raw: string, max: number): number | null {
  const text = raw.trim();
  if (!text) return null;
  // Accept "2:30 - 3:00" style entries: only the part before the dash is the target position.
  const first = text.split(/\s*[-–—/]\s*/)[0];
  const parts = first.split(":").map((p) => p.trim());
  if (parts.length > 3 || parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;
  const seconds = parts.reduce((total, p) => total * 60 + Number(p), 0);
  if (seconds < 0) return null;
  return max > 0 ? Math.min(seconds, max) : seconds;
}

export function SeekBar({
  position,
  duration,
  disabled,
  onSeek,
}: {
  position: number;
  duration: number;
  disabled?: boolean;
  onSeek: (seconds: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  const onMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !duration) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHoverX(event.clientX - rect.left);
    setHoverTime(ratio * duration);
  };

  const startEditing = () => {
    if (disabled) return;
    setDraft(formatDuration(position));
    setInvalid(false);
    setEditing(true);
  };

  const commit = () => {
    const seconds = parseTimeInput(draft, duration);
    if (seconds === null) {
      setInvalid(true);
      return;
    }
    onSeek(seconds);
    setEditing(false);
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") setEditing(false);
  };

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <div className="seek-bar">
      {editing ? (
        <input
          className="seek-bar__time seek-bar__time--input"
          data-invalid={invalid}
          value={draft}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={onKey}
          onBlur={() => (parseTimeInput(draft, duration) === null ? setEditing(false) : commit())}
          aria-label="Jump to time (for example 2:30)"
          placeholder="2:30"
        />
      ) : (
        <button type="button" className="seek-bar__time seek-bar__time--editable" onClick={startEditing} disabled={disabled} title="Click to type a time and jump to it">
          {formatDuration(position)}
        </button>
      )}
      <div className="seek-bar__track" ref={trackRef} onMouseMove={onMove} onMouseLeave={() => setHoverX(null)}>
        {hoverX !== null && !disabled && (
          <span className="seek-bar__preview" style={{ left: hoverX }}>
            {formatDuration(hoverTime)}
          </span>
        )}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(position, duration || 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
          disabled={disabled}
          aria-label="Seek"
          style={{ ["--seek-progress" as string]: `${progress * 100}%` }}
        />
      </div>
      <span className="seek-bar__time">{formatDuration(duration)}</span>
    </div>
  );
}
