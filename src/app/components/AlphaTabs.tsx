import { ALPHABET, type AlphaKey } from "@/lib/library/alphaBucket";
import "./AlphaTabs.css";

interface Props {
  value: AlphaKey;
  counts: Map<AlphaKey, number>;
  onChange: (key: AlphaKey) => void;
}

/** `All | Number | A B C … Z | Symbol` — horizontally scrollable on phones; letters with no songs are dimmed (still clickable). */
export function AlphaTabs({ value, counts, onChange }: Props) {
  const items: { key: AlphaKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "number", label: "Number" },
    ...ALPHABET.map((l) => ({ key: l, label: l })),
    { key: "symbol", label: "Symbol" },
  ];
  return (
    <div className="alpha-tabs" role="tablist" aria-label="Filter by first letter">
      {items.map(({ key, label }) => {
        const empty = key !== "all" && !(counts.get(key) ?? 0);
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={value === key}
            data-active={value === key}
            data-empty={empty}
            title={key === "all" ? "All songs" : `${label} — ${counts.get(key) ?? 0} song(s)`}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
