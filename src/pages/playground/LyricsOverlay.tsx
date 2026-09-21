import "./LyricsOverlay.css";

export function LyricsOverlay({ line }: { line?: string }) {
  return (
    <div className="lyrics-overlay">
      <p>{line ?? "Not Available: synced lyrics will be shown here."}</p>
    </div>
  );
}
