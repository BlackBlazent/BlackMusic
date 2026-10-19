import { useLocation, useNavigate } from "react-router-dom";
import { usePlayback } from "@/app/context/PlaybackContext";
import { Tooltip } from "@/app/components/Tooltip";
import { PlaygroundIcon } from "./icons";
import { useIsMobile } from "@/lib/useIsMobile";
import "./FloatingPlaygroundToggle.css";

export function FloatingPlaygroundToggle() {
  const { currentTrack, isPlaying } = usePlayback();
  const location = useLocation();
  const navigate = useNavigate();
  const mobile = useIsMobile();

  if (!currentTrack || location.pathname === "/playground") return null;

  return (
    <Tooltip label="Back to Playground" side="left">
      <button
        type="button"
        className="floating-playground-toggle"
        data-spinning={isPlaying}
        data-mobile={mobile}
        onClick={() => navigate("/playground")}
      >
        <PlaygroundIcon />
      </button>
    </Tooltip>
  );
}
