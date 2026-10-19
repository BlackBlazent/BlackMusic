import { useRef, useState } from "react";
import { AnchoredPopover } from "@/app/overlay/AnchoredPopover";
import { usePlayback } from "@/app/context/PlaybackContext";
import { VolumeIcon } from "./icons";

/**
 * Compact speaker button → slider popover (used on phones, where an always-visible slider ate the row). It reads and writes the
 * SAME playback `volume` the audio element is driven by — there is no second volume state to drift out of sync.
 * The popover lives in the global overlay layer, so no parent can clip it or stack it underneath something.
 */
export function VolumeControl() {
  const { volume, setVolume } = usePlayback();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const lastNonZero = useRef(volume > 0 ? volume : 0.8);
  if (volume > 0) lastNonZero.current = volume;
  return (
    <>
      <button ref={button} type="button" className="volume-control__btn" aria-label={`Volume ${Math.round(volume * 100)}%`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)} data-muted={volume === 0}>
        <VolumeIcon />
      </button>
      {open && (
        <AnchoredPopover anchorRef={button} onClose={() => setOpen(false)} placement="top" width={260}>
          <div className="volume-control__panel">
            <button type="button" className="volume-control__mute" onClick={() => setVolume(volume === 0 ? lastNonZero.current : 0)} aria-label={volume === 0 ? "Unmute" : "Mute"} data-muted={volume === 0}>
              <VolumeIcon />
            </button>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" />
            <span className="volume-control__value">{Math.round(volume * 100)}</span>
          </div>
        </AnchoredPopover>
      )}
    </>
  );
}
