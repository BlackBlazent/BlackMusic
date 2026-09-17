import { useRef, useState } from "react";
import { useFolders } from "@/app/context/FoldersContext";
import { useLibrary } from "@/app/context/LibraryContext";
import { useClickOutside } from "@/lib/useClickOutside";
import { openInFileExplorer } from "@/lib/openInFileExplorer";
import { isTauri } from "@/lib/platform";
import { Tooltip } from "@/app/components/Tooltip";
import { FolderIcon, FolderOpenIcon, GridIcon, RefreshIcon } from "@/app/layout/icons";
import "./Folder.css";

// The first two are fully implemented; the rest are listed (as the original
// app listed them) but currently render as List View until built out.
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

export function Folder() {
  const { folders, addFolder, removeFolder } = useFolders();
  const { tracks, scanning, scanProgress, lastScanError, rescan } = useLibrary();
  const [viewStyle, setViewStyle] = useState<(typeof VIEW_STYLES)[number]>("Cover Art View");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(viewMenuRef, () => setViewMenuOpen(false), viewMenuOpen);

  const countFor = (folder: string) => tracks.filter((t) => t.path.startsWith(folder)).length;
  const isCoverView = viewStyle === "Cover Art View";

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
          <Tooltip label="Open watched folders" side="bottom">
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
            <Tooltip label="Folder view style" side="bottom">
              <button type="button" className="folder-page__icon-btn" onClick={() => setViewMenuOpen((v) => !v)}>
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
          Scanning… {scanProgress} file{scanProgress === 1 ? "" : "s"} found so far
          {scanProgress > 0 ? " — this can take a while for large libraries." : "."}
        </p>
      )}

      {folders.length === 0 ? (
        <div className="folder-page__empty">
          <FolderIcon />
          <p>No folders added yet.</p>
        </div>
      ) : isCoverView ? (
        <div className="folder-page__grid">
          {folders.map((folder) => (
            <FolderCard
              key={folder}
              folder={folder}
              count={countFor(folder)}
              scanning={scanning}
              onRemove={() => removeFolder(folder)}
              onOpen={() => openInFileExplorer(folder)}
            />
          ))}
        </div>
      ) : (
        <ul className="folder-page__list">
          {folders.map((folder) => (
            <li key={folder} className="folder-page__item">
              <FolderIcon className="folder-page__item-icon" />
              <div className="folder-page__item-info">
                <span className="folder-page__item-path">{folder}</span>
                <span className="folder-page__item-count">{scanning ? "Scanning…" : `${countFor(folder)} tracks`}</span>
              </div>
              <button type="button" onClick={() => openInFileExplorer(folder)}>
                Open
              </button>
              <button type="button" onClick={() => removeFolder(folder)} aria-label={`Remove ${folder}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FolderCard({
  folder,
  count,
  scanning,
  onRemove,
  onOpen,
}: {
  folder: string;
  count: number;
  scanning: boolean;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const name = folder.split(/[/\\]/).filter(Boolean).pop() ?? folder;
  return (
    <div className="folder-card">
      <button type="button" className="folder-card__thumb" onClick={onOpen} title={folder}>
        <FolderIcon />
      </button>
      <span className="folder-card__name">{name}</span>
      <span className="folder-card__count">{scanning ? "Scanning…" : `${count} Audio`}</span>
      <button type="button" className="folder-card__remove" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
