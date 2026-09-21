import { CloseIcon } from "@/app/layout/icons";
import "./LinkDropperModal.css";

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // youtu.be/<videoId>
    if (hostname === "youtu.be") {
      const videoId = parsed.pathname.slice(1).split("/")[0];

      if (videoId) {
        return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
      }

      return null;
    }

    // youtube.com/watch?v=<videoId>
    if (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com"
    ) {
      if (parsed.pathname === "/watch") {
        const videoId = parsed.searchParams.get("v");

        if (videoId) {
          return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
        }
      }

      // youtube.com/shorts/<videoId>
      if (parsed.pathname.startsWith("/shorts/")) {
        const videoId = parsed.pathname.split("/")[2];

        if (videoId) {
          return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
        }
      }

      // youtube.com/embed/<videoId>
      if (parsed.pathname.startsWith("/embed/")) {
        const videoId = parsed.pathname.split("/")[2];

        if (videoId) {
          return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function LinkDropperModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const youtubeEmbedUrl = getYouTubeEmbedUrl(url);

  const iframeUrl = youtubeEmbedUrl ?? url;

  return (
    <div className="link-modal__backdrop" onClick={onClose}>
      <div
        className="link-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="link-modal__header">
          <span className="link-modal__url">{url}</span>

          <button type="button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <iframe
          className="link-modal__frame"
          src={iframeUrl}
          title="Dropped link"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}