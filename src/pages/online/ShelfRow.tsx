import { useRef, useState } from "react";
import type { Shelf, ShelfItem } from "./shelves";
import { PlaygroundIcon } from "@/app/layout/icons";

function Card({ item, onActivate, busy }: { item: ShelfItem; onActivate: (i: ShelfItem) => void; busy: boolean }) {
  return (
    <button type="button" className="shelf-card" data-round={Boolean(item.round)} data-busy={busy} onClick={() => onActivate(item)} title={item.title}>
      <span className="shelf-card__art">
        {item.image ? <img src={item.image} alt="" loading="lazy" draggable={false} /> : <PlaygroundIcon />}
        {item.badge && <span className="shelf-card__badge">{item.badge}</span>}
        <span className="shelf-card__play" aria-hidden="true">▶</span>
      </span>
      <span className="shelf-card__title">{item.title}</span>
      {item.subtitle && <span className="shelf-card__subtitle">{item.subtitle}</span>}
    </button>
  );
}

export function ShelfRow({ shelf, onActivate, busyId }: { shelf: Shelf; onActivate: (i: ShelfItem, shelf: Shelf) => void; busyId: string | null }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const nudge = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * 640, behavior: "smooth" });

  return (
    <section className="shelf">
      {shelf.caption && <p className="shelf__caption">{shelf.caption}</p>}
      <header className="shelf__head">
        {shelf.avatar && <img className="shelf__avatar" src={shelf.avatar} alt="" />}
        <div className="shelf__titles">
          {shelf.eyebrow && <small>{shelf.eyebrow}</small>}
          <h2>{shelf.title}</h2>
        </div>
        {shelf.items.length > 6 && (
          <button type="button" className="shelf__show-all" onClick={() => setExpanded((v) => !v)}>{expanded ? "Show less" : "Show all"}</button>
        )}
        {!expanded && shelf.items.length > 5 && (
          <span className="shelf__arrows">
            <button type="button" onClick={() => nudge(-1)} aria-label="Scroll left">‹</button>
            <button type="button" onClick={() => nudge(1)} aria-label="Scroll right">›</button>
          </span>
        )}
      </header>
      <div className="shelf__scroller" data-expanded={expanded} ref={scroller}>
        {shelf.items.map((item) => (
          <Card key={item.id} item={item} busy={busyId === item.id} onActivate={(i) => onActivate(i, shelf)} />
        ))}
      </div>
    </section>
  );
}
