import { useEffect, useMemo, useState } from "react";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useT } from "@/lib/i18n";
import { FolderIcon } from "@/app/layout/icons";
import type { Track } from "@/lib/types";

const sepOf = (p: string) => (p.includes("\\") ? "\\" : "/");
const trimEnd = (p: string) => p.replace(/[\\/]+$/, "");
const nameOf = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;

/**
 * Strip of subfolders — shown when the selected parent folder contains subfolders (derived from the scanned tracks'
 * paths, so it never touches the disk). Click a subfolder to step into it; the breadcrumb steps back out.
 */
export function SubfolderStrip({ roots }: { roots: string[] }) {
  const t = useT();
  const { tracks } = useLibrary();
  const { playTrack } = usePlayback();
  const [root, setRoot] = useState(roots[0] ?? "");
  const [current, setCurrent] = useState(roots[0] ?? "");

  useEffect(() => {
    if (!roots.includes(root)) {
      setRoot(roots[0] ?? "");
      setCurrent(roots[0] ?? "");
    }
  }, [roots, root]);

  const { children, direct, all } = useMemo(() => {
    const base = trimEnd(current);
    const sep = sepOf(current);
    const kids = new Map<string, Track[]>();
    const here: Track[] = [];
    const every: Track[] = [];
    for (const tr of tracks) {
      if (!tr.path.startsWith(base + sep)) continue;
      every.push(tr);
      const rest = tr.path.slice(base.length + 1);
      const cut = rest.search(/[\\/]/);
      if (cut === -1) here.push(tr);
      else {
        const name = rest.slice(0, cut);
        kids.set(name, [...(kids.get(name) ?? []), tr]);
      }
    }
    return { children: [...kids.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })), direct: here, all: every };
  }, [tracks, current]);

  if (!current || (children.length === 0 && current === root)) return null;
  const crumbs = trimEnd(current).slice(trimEnd(root).length).split(/[\\/]/).filter(Boolean);

  return (
    <section className="subfolder-strip" aria-label={t("folder.subfolders")}>
      <div className="subfolder-strip__head">
        {roots.length > 1 && (
          <select value={root} onChange={(e) => { setRoot(e.target.value); setCurrent(e.target.value); }} aria-label="Parent folder">
            {roots.map((r) => <option key={r} value={r}>{nameOf(r)}</option>)}
          </select>
        )}
        <nav className="subfolder-strip__crumbs">
          <button type="button" onClick={() => setCurrent(root)} disabled={current === root}>{nameOf(root)}</button>
          {crumbs.map((c, i) => (
            <span key={i}>
              {" / "}
              <button type="button" onClick={() => setCurrent(trimEnd(root) + sepOf(root) + crumbs.slice(0, i + 1).join(sepOf(root)))} disabled={i === crumbs.length - 1}>{c}</button>
            </span>
          ))}
        </nav>
        <button type="button" className="subfolder-strip__play" disabled={all.length === 0} onClick={() => playTrack(all[0], all)}>▶ {all.length}</button>
      </div>
      <div className="subfolder-strip__row">
        {children.map(([name, list]) => (
          <button key={name} type="button" className="subfolder-strip__item" onClick={() => setCurrent(trimEnd(current) + sepOf(current) + name)} title={name}>
            <span className="subfolder-strip__thumb">{list.find((x) => x.artworkUrl)?.artworkUrl ? <img src={list.find((x) => x.artworkUrl)!.artworkUrl} alt="" /> : <FolderIcon />}</span>
            <span className="subfolder-strip__name">{name}</span>
            <small>{list.length}</small>
          </button>
        ))}
        {children.length === 0 && direct.length > 0 && <small className="subfolder-strip__empty">{direct.length} tracks in this folder.</small>}
      </div>
    </section>
  );
}
