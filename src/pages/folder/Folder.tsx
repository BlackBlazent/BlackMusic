import { useMemo, useRef, useState } from "react";
import { useFolders } from "@/app/context/FoldersContext";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useClickOutside } from "@/lib/useClickOutside";
import { openInFileExplorer } from "@/lib/openInFileExplorer";
import { isTauri } from "@/lib/platform";
import { usePersistentState } from "@/lib/usePersistentState";
import { useManualPromotions } from "@/app/context/PromotionsContext";
import { PromotionFolderCard } from "@/app/components/Promotion";
import { Tooltip } from "@/app/components/Tooltip";
import { FolderIcon, FolderOpenIcon, GridIcon, RefreshIcon } from "@/app/layout/icons";
import type { Track } from "@/lib/types";
import "./Folder.css";

const VIEW_STYLES = [
  "Cover Art View",
  "List View",
  "Compact Grid View",
  "Detailed View",
  "Timeline View",
  "Storyboard View",
  "Tag View",
  "Mood Board View",
  "Text-Only View",
  "Custom Template View",
] as const;
type ViewStyle = (typeof VIEW_STYLES)[number];

const DEFAULT_TEMPLATE = "{name} — {count} tracks · {duration} · {artists} artists";

interface FolderInfo {
  folder: string;
  name: string;
  tracks: Track[];
  count: number;
  totalSeconds: number;
  artists: string[];
  topArtists: { name: string; count: number }[];
  formats: string[];
  art: string[];
  addedAt: number;
}

function nameOf(folder: string) {
  return folder.split(/[/\\]/).filter(Boolean).pop() ?? folder;
}

function buildInfo(folder: string, all: Track[]): FolderInfo {
  const tracks = all.filter((t) => t.path.startsWith(folder));
  const byArtist = new Map<string, number>();
  const formats = new Set<string>();
  const art: string[] = [];
  let totalSeconds = 0;
  let addedAt = Infinity;
  for (const t of tracks) {
    totalSeconds += t.duration;
    byArtist.set(t.artist, (byArtist.get(t.artist) ?? 0) + 1);
    const dot = t.path.lastIndexOf(".");
    if (dot !== -1) formats.add(t.path.slice(dot + 1).toUpperCase());
    if (t.artworkUrl && art.length < 12 && !art.includes(t.artworkUrl)) art.push(t.artworkUrl);
    addedAt = Math.min(addedAt, t.addedAt);
  }
  const topArtists = [...byArtist.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  return {
    folder,
    name: nameOf(folder),
    tracks,
    count: tracks.length,
    totalSeconds,
    artists: [...byArtist.keys()],
    topArtists,
    formats: [...formats].sort(),
    art,
    addedAt: Number.isFinite(addedAt) ? addedAt : 0,
  };
}

function formatLong(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function renderTemplate(template: string, info: FolderInfo): string {
  return template
    .replace(/\{name\}/g, info.name)
    .replace(/\{path\}/g, info.folder)
    .replace(/\{count\}/g, String(info.count))
    .replace(/\{duration\}/g, formatLong(info.totalSeconds))
    .replace(/\{artists\}/g, String(info.artists.length))
    .replace(/\{formats\}/g, info.formats.join("/"));
}

export function Folder() {
  const { folders, addFolder, removeFolder } = useFolders();
  const { tracks, scanning, scanProgress, lastScanError, rescan } = useLibrary();
  const { playTrack } = usePlayback();
  const [viewStyle, setViewStyle] = usePersistentState<ViewStyle>("folder.viewStyle", "Cover Art View");
  const [template, setTemplate] = usePersistentState<string>("folder.template", DEFAULT_TEMPLATE);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(viewMenuRef, () => setViewMenuOpen(false), viewMenuOpen);
  const promos = useManualPromotions("folder");

  const infos = useMemo(() => folders.map((f) => buildInfo(f, tracks)), [folders, tracks]);
  const countLabel = (info: FolderInfo) => (scanning ? "Scanning…" : `${info.count} Audio`);
  const playFolder = (info: FolderInfo) => info.tracks[0] && playTrack(info.tracks[0], info.tracks);

  const renderBody = () => {
    switch (viewStyle) {
      case "Cover Art View":
        return (
          <div className="folder-page__grid">
            {infos.map((info) => (
              <FolderCard key={info.folder} info={info} label={countLabel(info)} onRemove={() => removeFolder(info.folder)} onOpen={() => openInFileExplorer(info.folder)} />
            ))}
            {promos[0] && <PromotionFolderCard promotion={promos[0]} />}
          </div>
        );

      case "Compact Grid View":
        return (
          <div className="folder-page__compact-grid">
            {infos.map((info) => (
              <button key={info.folder} type="button" className="folder-compact" title={info.folder} onClick={() => openInFileExplorer(info.folder)}>
                <FolderIcon />
                <span className="folder-compact__name">{info.name}</span>
                <span className="folder-compact__count">{scanning ? "…" : info.count}</span>
              </button>
            ))}
            {promos[0] && <PromotionFolderCard promotion={promos[0]} />}
          </div>
        );

      case "Detailed View":
        return (
          <div className="folder-page__detailed">
            {infos.map((info) => (
              <article key={info.folder} className="folder-detail">
                <header>
                  <FolderIcon />
                  <div>
                    <h3>{info.name}</h3>
                    <p title={info.folder}>{info.folder}</p>
                  </div>
                  <div className="folder-detail__buttons">
                    <button type="button" onClick={() => playFolder(info)} disabled={info.count === 0}>
                      Play
                    </button>
                    <button type="button" onClick={() => openInFileExplorer(info.folder)}>
                      Open
                    </button>
                    <button type="button" onClick={() => removeFolder(info.folder)}>
                      Remove
                    </button>
                  </div>
                </header>
                <dl>
                  <div><dt>Tracks</dt><dd>{scanning ? "…" : info.count}</dd></div>
                  <div><dt>Total time</dt><dd>{formatLong(info.totalSeconds)}</dd></div>
                  <div><dt>Artists</dt><dd>{info.artists.length}</dd></div>
                  <div><dt>Formats</dt><dd>{info.formats.join(", ") || "—"}</dd></div>
                </dl>
                {info.topArtists.length > 0 && (
                  <p className="folder-detail__artists">Top artists: {info.topArtists.slice(0, 5).map((a) => `${a.name} (${a.count})`).join(" · ")}</p>
                )}
              </article>
            ))}
          </div>
        );

      case "Timeline View": {
        const sorted = [...infos].sort((a, b) => b.addedAt - a.addedAt);
        const groups = new Map<string, FolderInfo[]>();
        for (const info of sorted) {
          const label = info.addedAt ? new Date(info.addedAt).toLocaleDateString(undefined, { year: "numeric", month: "long" }) : "Not scanned yet";
          groups.set(label, [...(groups.get(label) ?? []), info]);
        }
        return (
          <ol className="folder-page__timeline">
            {[...groups.entries()].map(([label, items]) => (
              <li key={label}>
                <h3>{label}</h3>
                {items.map((info) => (
                  <button key={info.folder} type="button" className="folder-timeline__item" onClick={() => openInFileExplorer(info.folder)}>
                    <span className="folder-timeline__dot" />
                    <span className="folder-timeline__name">{info.name}</span>
                    <span className="folder-timeline__meta">{info.count} tracks · {info.addedAt ? new Date(info.addedAt).toLocaleDateString() : "—"}</span>
                  </button>
                ))}
              </li>
            ))}
          </ol>
        );
      }

      case "Storyboard View":
        return (
          <div className="folder-page__storyboard">
            {infos.map((info) => (
              <section key={info.folder}>
                <h3>
                  {info.name} <span>{info.count} tracks</span>
                </h3>
                <div className="folder-storyboard__frames">
                  {info.art.length === 0 ? (
                    <span className="folder-storyboard__empty">No embedded artwork in this folder yet.</span>
                  ) : (
                    info.art.slice(0, 8).map((src, i) => (
                      <button key={src.slice(-24) + i} type="button" className="folder-storyboard__frame" onClick={() => playFolder(info)} aria-label={`Play ${info.name}`}>
                        <img src={src} alt="" loading="lazy" />
                        <span>{i + 1}</span>
                      </button>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        );

      case "Tag View":
        return (
          <div className="folder-page__tags">
            {infos.map((info) => (
              <section key={info.folder}>
                <h3>{info.name}</h3>
                <div className="folder-tags__cloud">
                  <span className="folder-tag folder-tag--folder">{info.count} tracks</span>
                  {info.formats.map((f) => (
                    <span key={f} className="folder-tag folder-tag--format">{f}</span>
                  ))}
                  {info.topArtists.map((a) => (
                    <button
                      key={a.name}
                      type="button"
                      className="folder-tag"
                      title={`Play ${a.name} from ${info.name}`}
                      onClick={() => {
                        const list = info.tracks.filter((t) => t.artist === a.name);
                        if (list[0]) playTrack(list[0], list);
                      }}
                    >
                      {a.name} · {a.count}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        );

      case "Mood Board View": {
        const tiles = infos.flatMap((info) => info.art.map((src) => ({ src, info })));
        return tiles.length === 0 ? (
          <p className="folder-page__notice">A mood board needs album art — it appears as soon as scanned tracks have embedded artwork.</p>
        ) : (
          <div className="folder-page__moodboard">
            {tiles.slice(0, 60).map(({ src, info }, i) => (
              <button key={src.slice(-24) + i} type="button" className="folder-mood" data-tall={i % 5 === 0} onClick={() => playFolder(info)} title={info.name}>
                <img src={src} alt="" loading="lazy" />
                <span>{info.name}</span>
              </button>
            ))}
          </div>
        );
      }

      case "Text-Only View":
        return (
          <pre className="folder-page__text">
            {infos.map((info) => `${info.folder}  —  ${info.count} track${info.count === 1 ? "" : "s"}`).join("\n")}
          </pre>
        );

      case "Custom Template View":
        return (
          <div className="folder-page__custom">
            <label>
              Template — tokens: {"{name} {path} {count} {duration} {artists} {formats}"}
              <input type="text" value={template} onChange={(e) => setTemplate(e.target.value)} spellCheck={false} />
            </label>
            <ul>
              {infos.map((info) => (
                <li key={info.folder}>{renderTemplate(template, info)}</li>
              ))}
            </ul>
          </div>
        );

      case "List View":
      default:
        return (
          <ul className="folder-page__list">
            {infos.map((info) => (
              <li key={info.folder} className="folder-page__item">
                <FolderIcon className="folder-page__item-icon" />
                <div className="folder-page__item-info">
                  <span className="folder-page__item-path">{info.folder}</span>
                  <span className="folder-page__item-count">{scanning ? "Scanning…" : `${info.count} tracks`}</span>
                </div>
                <button type="button" onClick={() => openInFileExplorer(info.folder)}>
                  Open
                </button>
                <button type="button" onClick={() => removeFolder(info.folder)} aria-label={`Remove ${info.folder}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        );
    }
  };

  return (
    <div className="folder-page">
      <div className="folder-page__header">
        <h1>Folders</h1>
        <div className="folder-page__actions">
          <Tooltip label="Add folder" side="bottom">
            <button type="button" className="folder-page__icon-btn" onClick={addFolder}>
              <FolderIcon />
            </button>
          </Tooltip>
          <Tooltip label="Open watched folder (opens Explorer)" side="bottom">
            <button
              type="button"
              className="folder-page__icon-btn"
              disabled={folders.length === 0}
              onClick={() => folders[0] && openInFileExplorer(folders[0])}
            >
              <FolderOpenIcon />
            </button>
          </Tooltip>
          <Tooltip label={scanning ? "Scanning…" : "Rescan"} side="bottom">
            <button type="button" className="folder-page__icon-btn" data-spinning={scanning} onClick={() => void rescan()}>
              <RefreshIcon />
            </button>
          </Tooltip>

          <div className="folder-page__view-menu" ref={viewMenuRef}>
            <Tooltip label={`Folder view style: ${viewStyle}`} side="bottom">
              <button type="button" className="folder-page__icon-btn" data-active={viewMenuOpen} onClick={() => setViewMenuOpen((v) => !v)}>
                <GridIcon />
              </button>
            </Tooltip>
            {viewMenuOpen && (
              <div className="folder-page__view-panel" role="menu">
                <h2>Folder View Style</h2>
                {VIEW_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    data-active={viewStyle === style}
                    onClick={() => {
                      setViewStyle(style);
                      setViewMenuOpen(false);
                    }}
                  >
                    {style}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!isTauri() && (
        <p className="folder-page__notice">
          Folder picking and scanning need the native shell — run <code>pnpm tauri:dev</code> to use this
          page.
        </p>
      )}

      {lastScanError && <p className="folder-page__error">Scan failed: {lastScanError}</p>}

      {scanning && (
        <p className="folder-page__scanning">
          Scanning… {scanProgress} file{scanProgress === 1 ? "" : "s"} processed so far.
        </p>
      )}

      {folders.length === 0 ? (
        <div className="folder-page__empty">
          <FolderIcon />
          <p>No folders added yet.</p>
        </div>
      ) : (
        renderBody()
      )}
    </div>
  );
}

function FolderCard({ info, label, onRemove, onOpen }: { info: FolderInfo; label: string; onRemove: () => void; onOpen: () => void }) {
  return (
    <div className="folder-card">
      <button type="button" className="folder-card__thumb" onClick={onOpen} title={info.folder}>
        {info.art[0] ? <img src={info.art[0]} alt="" /> : <FolderIcon />}
      </button>
      <span className="folder-card__name">{info.name}</span>
      <span className="folder-card__count">{label}</span>
      <button type="button" className="folder-card__remove" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}

