import "./LyricsOverlay.css";

export function LyricsOverlay({ line }: { line?: string }) {
  return (
    <div className="lyrics-overlay">
      <p>{line ?? "Add VITE_GENIUS_ACCESS_TOKEN to .env to show synced lyrics here."}</p>
    </div>
  );
}
