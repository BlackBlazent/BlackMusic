import { useRef, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useClickOutside } from "@/lib/useClickOutside";
import "./AccountPopover.css";

export function AccountPopover({ onClose }: { onClose: () => void }) {
  const { user, signOut, deleteAccount } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  useClickOutside(ref, onClose, true);

  if (!user) return null;

  const initial = (user.email ?? "?")[0]?.toUpperCase();

  const onDelete = async () => {
    const result = await deleteAccount();
    setDeleteMessage(result.message);
    if (result.ok) onClose();
  };

  return (
    <div className="account-popover" ref={ref}>
      <div className="account-popover__profile">
        <span className="account-popover__avatar">{initial}</span>
        <div>
          <span className="account-popover__email">{user.email ?? "Signed in"}</span>
          <span className="account-popover__id">ID: {user.id.slice(0, 8)}…</span>
        </div>
      </div>

      <button type="button" className="account-popover__signout" onClick={() => { void signOut(); onClose(); }}>
        Sign out
      </button>

      {!confirmingDelete ? (
        <button type="button" className="account-popover__delete" onClick={() => setConfirmingDelete(true)}>
          Delete account
        </button>
      ) : (
        <div className="account-popover__confirm">
          <p>This can't be undone.</p>
          <div>
            <button type="button" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
            <button type="button" className="account-popover__delete" onClick={onDelete}>
              Confirm delete
            </button>
          </div>
        </div>
      )}

      {deleteMessage && <p className="account-popover__delete-note">{deleteMessage}</p>}
    </div>
  );
}
