import { CloseIcon } from "@/app/layout/icons";
import "./LinkDropperModal.css";

export function LinkDropperModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="link-modal__backdrop" onClick={onClose}>
      <div className="link-modal" onClick={(event) => event.stopPropagation()}>
        <div className="link-modal__header">
          <span className="link-modal__url">{url}</span>
          <button type="button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <iframe
          className="link-modal__frame"
          src={url}
          title="Dropped link"
          allow="autoplay; encrypted-media; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
