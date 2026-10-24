"use client";

export const COLOR_PRESETS = ["#6c63ff", "#9b5de5", "#f15bb5", "#ff6b6b", "#ff9f1c", "#ffc233", "#00c9a7", "#3b9eff", "#8b8da3"];

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

/** Native colour input plus preset swatches. */
export default function ColorField({ id, label, value, onChange, onBlur, disabled, invalid, describedBy }: Props) {
  return (
    <div className="color-field">
      <input
        id={id} type="color" className="color-input" value={/^#[0-9a-f]{6}$/i.test(value) ? value : COLOR_PRESETS[COLOR_PRESETS.length - 1]}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur} disabled={disabled}
        aria-label={`${label} picker`} aria-invalid={invalid || undefined} aria-describedby={describedBy}
      />
      <div className="swatches" role="group" aria-label="Preset colours">
        {COLOR_PRESETS.map((c) => (
          <button key={c} type="button" className={`swatch ${value.toLowerCase() === c ? "is-on" : ""}`} style={{ background: c }} aria-label={`Use colour ${c}`} aria-pressed={value.toLowerCase() === c} disabled={disabled} onClick={() => onChange(c)} />
        ))}
      </div>
    </div>
  );
}
