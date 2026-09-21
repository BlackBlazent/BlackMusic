import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { formatDuration } from "@/lib/formatDuration";
import "./SeekBar.css";

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

  const onMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !duration) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHoverX(event.clientX - rect.left);
    setHoverTime(ratio * duration);
  };

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <div className="seek-bar">
      <span className="seek-bar__time">{formatDuration(position)}</span>
      <div
        className="seek-bar__track"
        ref={trackRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverX(null)}
      >
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
