import { useLyrics } from "../context/LyricsContext";
import "./Lyrics.css";

export function LyricsSettings() {
  const { settings: s, updateSettings: u, resetSettings } = useLyrics();
  return (
    <div className="lyrics-settings">
      <div className="lyrics-settings__row">
        <span>Alignment</span>
        {(["left", "center", "right"] as const).map((a) => (
          <button key={a} type="button" data-active={s.alignment === a} onClick={() => u({ alignment: a })}>{a}</button>
        ))}
      </div>
      <label>Text color <input type="color" value={s.textColor} onChange={(e) => u({ textColor: e.target.value })} /></label>
      <label>Background <input type="color" value={s.backgroundColor} onChange={(e) => u({ backgroundColor: e.target.value })} /></label>
      <label>Font
        <select value={s.fontFamily} onChange={(e) => u({ fontFamily: e.target.value })}>
          <option value="Poppins, sans-serif">Poppins</option>
          <option value="Inter, system-ui, sans-serif">Inter</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="ui-monospace, Consolas, monospace">Mono</option>
        </select>
      </label>
      <label>Size {s.fontSize}px <input type="range" min={12} max={56} value={s.fontSize} onChange={(e) => u({ fontSize: Number(e.target.value) })} /></label>
      <label>Weight {s.fontWeight} <input type="range" min={300} max={900} step={100} value={s.fontWeight} onChange={(e) => u({ fontWeight: Number(e.target.value) })} /></label>
      <label>Opacity {Math.round(s.opacity * 100)}% <input type="range" min={0.2} max={1} step={0.05} value={s.opacity} onChange={(e) => u({ opacity: Number(e.target.value) })} /></label>
      <label>Line spacing {s.lineSpacing} <input type="range" min={1} max={2.4} step={0.1} value={s.lineSpacing} onChange={(e) => u({ lineSpacing: Number(e.target.value) })} /></label>
      <label>Padding {s.padding}px <input type="range" min={0} max={48} value={s.padding} onChange={(e) => u({ padding: Number(e.target.value) })} /></label>
      <label>Max width {s.maxWidth}% <input type="range" min={40} max={100} value={s.maxWidth} onChange={(e) => u({ maxWidth: Number(e.target.value) })} /></label>
      <label>Animation
        <select value={s.animation} onChange={(e) => u({ animation: e.target.value as typeof s.animation })}>
          <option value="none">None</option><option value="fade">Fade</option><option value="slide">Slide</option>
        </select>
      </label>
      <label className="lyrics-settings__check"><input type="checkbox" checked={s.autoScroll} onChange={(e) => u({ autoScroll: e.target.checked })} /> Auto-scroll</label>
      <label className="lyrics-settings__check"><input type="checkbox" checked={s.showCurrentLineOnly} onChange={(e) => u({ showCurrentLineOnly: e.target.checked })} /> Show current line only</label>
      <label className="lyrics-settings__check"><input type="checkbox" checked={s.shadow} onChange={(e) => u({ shadow: e.target.checked })} /> Text shadow</label>
      <button type="button" className="lyrics-settings__reset" onClick={resetSettings}>Reset to defaults</button>
    </div>
  );
}
