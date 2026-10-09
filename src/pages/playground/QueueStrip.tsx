import { useRef, useState, type DragEvent } from "react";
import type { Track } from "@/lib/types";
import type { Playlist } from "@/app/context/PlaylistsContext";
import { EditIcon, FolderIcon, PinIcon, PlaygroundIcon, TrashIcon } from "@/app/layout/icons";
import { TrackMenu } from "@/app/components/TrackMenu";
import "./QueueStrip.css";

export interface PlaylistFolder {
  playlist: Playlist;
  count: number;
  art?: string;
}

export function QueueStrip({
  tracks,
  currentTrackId,
  pins,
  folders,
  openFolder,
  onSelect,
  onOpenFolder,
  onCloseFolder,
  onTogglePin,
  onEdit,
  onRemove,
  onMove,
}: {
  tracks: Track[];
  currentTrackId?: string;
  pins: string[];
  folders: PlaylistFolder[];
  /** Playlist currently shown in the strip (null = general queue strip). */
  openFolder: PlaylistFolder | null;
  onSelect: (track: Track) => void;
  onOpenFolder: (playlistId: string) => void;
  onCloseFolder: () => void;
  onTogglePin: (track: Track) => void;
  onEdit: (track: Track) => void;
  onRemove: (track: Track) => void;
  onMove: (dragId: string, targetId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const scrollBy = (amount: number) => scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });

  const onDragStart = (event: DragEvent, id: string) => {
    setDragId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };

  if (tracks.length === 0 && folders.length === 0 && !openFolder) return null;

  return (
    <div className="queue-strip">
      <button type="button" className="queue-strip__nav" onClick={() => scrollBy(-320)} aria-label="Scroll left">
        ‹
      </button>
      <div className="queue-strip__track" ref={scrollRef}>
        {/* Inside a playlist: the first card takes you back to the general queue strip. */}
        {openFolder ? (
          <button type="button" className="queue-strip__item queue-strip__folder" data-open="true" onClick={onCloseFolder} title="Back to the general queue">
            <span className="queue-strip__thumb">{openFolder.art ? <img src={openFolder.art} alt="" /> : <FolderIcon />}</span>
            <span className="queue-strip__label">← {openFolder.playlist.name}</span>
            <span className="queue-strip__count">{openFolder.count} songs</span>
          </button>
        ) : (
          folders.map((folder) => (
            <button
              key={folder.playlist.id}
              type="button"
              className="queue-strip__item queue-strip__folder"
              onClick={() => onOpenFolder(folder.playlist.id)}
              title={`${folder.playlist.name} — ${folder.count} songs`}
            >
              <span className="queue-strip__thumb queue-strip__thumb--folder">
                {folder.art ? <img src={folder.art} alt="" /> : <FolderIcon />}
                <FolderIcon className="queue-strip__folder-badge" />
              </span>
              <span className="queue-strip__label">{folder.playlist.name}</span>
              <span className="queue-strip__count">{folder.count} songs</span>
            </button>
          ))
        )}

        {tracks.map((track) => {
          const pinned = pins.includes(track.id);
          return (
            <div
              key={track.id}
              className="queue-strip__card"
              data-dragging={dragId === track.id}
              data-over={overId === track.id && dragId !== track.id}
              draggable
              onDragStart={(e) => onDragStart(e, track.id)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverId(track.id);
              }}
              onDragLeave={() => setOverId((id) => (id === track.id ? null : id))}
              onDrop={() => {
                if (dragId) onMove(dragId, track.id);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
            >
              <button
                type="button"
                className="queue-strip__item"
                data-active={track.id === currentTrackId}
                onClick={() => onSelect(track)}
                title={`${track.title} — ${track.artist}`}
              >
                <span className="queue-strip__thumb">
                  {track.artworkUrl ? <img src={track.artworkUrl} alt="" loading="lazy" /> : <PlaygroundIcon />}
                  {pinned && <PinIcon className="queue-strip__pin" />}
                </span>
                <span className="queue-strip__label">{track.title}</span>
              </button>
              <div className="queue-strip__more">
                <TrackMenu
                  label={`More for ${track.title}`}
                  items={[
                    { label: pinned ? "Unpin" : "Pin to first", icon: <PinIcon />, onSelect: () => onTogglePin(track) },
                    { label: "Edit metadata", icon: <EditIcon />, disabled: !track.path, onSelect: () => onEdit(track) },
                    { label: "Remove from the list", icon: <TrashIcon />, danger: true, onSelect: () => onRemove(track) },
                  ]}
                />
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="queue-strip__nav" onClick={() => scrollBy(320)} aria-label="Scroll right">
        ›
      </button>
    </div>
  );
}
