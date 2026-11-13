import { useState } from "react";
import { FloatingWindow } from "@/app/components/FloatingWindow";
import { useAudioFx } from "@/app/context/AudioFxContext";
import { EQ_BANDS, eqIsFlat } from "@/lib/audio/audioEngine";
import "./EqualizerWindow.css";

const label = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : String(hz));

/** FEAT-03b — 10-band equalizer in a floating window, with Bass Boost / Soft Vocal / Treble Punch presets and user "Custom" presets. */
export function EqualizerWindow({ onClose }: { onClose: () => void }) {
  const fx = useAudioFx();
  const [name, setName] = useState("");
  const activePreset = fx.eqPresets.find((p) => p.gains.every((g, i) => g === fx.eq[i]));
  const onSave = () => {
    if (!name.trim()) return;
    fx.saveEqPreset(name, fx.eq);
    setName("");
  };

  return (
    <FloatingWindow title="Equalizer" onClose={onClose} width={460} height={430}>
      <div className="eq">
        {!fx.fxAvailable && <p className="eq__warn">The equalizer needs the desktop/mobile audio engine; it isn't available in this build.</p>}
        {fx.fxError && <p className="eq__warn">{fx.fxError}</p>}

        <div className="eq__presets" role="radiogroup" aria-label="Presets">
          {fx.eqPresets.map((p) => (
            <span key={p.id} className="eq__preset" data-active={activePreset?.id === p.id}>
              <button type="button" role="radio" aria-checked={activePreset?.id === p.id} onClick={() => fx.setEq(p.gains)}>{p.name}</button>
              {!p.builtIn && <button type="button" className="eq__x" aria-label={`Delete ${p.name}`} onClick={() => fx.deleteEqPreset(p.id)}>✕</button>}
            </span>
          ))}
          {!activePreset && <span className="eq__preset" data-active="true"><button type="button" disabled>Custom</button></span>}
        </div>

        <div className="eq__bands">
          {EQ_BANDS.map((hz, i) => (
            <label key={hz} className="eq__band">
              <span className="eq__db">{fx.eq[i] > 0 ? "+" : ""}{Math.round(fx.eq[i])}</span>
              <input
                type="range" min={-12} max={12} step={1} value={fx.eq[i]}
                aria-label={`${label(hz)} Hz`}
                onChange={(e) => { const g = [...fx.eq]; g[i] = Number(e.target.value); fx.setEq(g); }}
                onDoubleClick={() => { const g = [...fx.eq]; g[i] = 0; fx.setEq(g); }}
              />
              <span className="eq__hz">{label(hz)}</span>
            </label>
          ))}
        </div>

        <div className="eq__foot">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name your sound…" maxLength={24} aria-label="Preset name" onKeyDown={(e) => e.key === "Enter" && onSave()} />
          <button type="button" onClick={onSave} disabled={!name.trim() || eqIsFlat(fx.eq)}>Save preset</button>
          <button type="button" onClick={() => fx.setEq(fx.eqPresets[0].gains)} disabled={eqIsFlat(fx.eq)}>Reset</button>
        </div>
      </div>
    </FloatingWindow>
  );
}
