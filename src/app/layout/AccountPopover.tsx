import { useRef, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useClickOutside } from "@/lib/useClickOutside";
import { ProfileCard } from "./ProfileCard";
import "./AccountPopover.css";

export function AccountPopover({ onClose }: { onClose: () => void }) {
  const { user, signOut, deleteAccount } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  useClickOutside(ref, onClose, true);

  if (!user) return null;

  const onDelete = async () => {
    const result = await deleteAccount();
    setDeleteMessage(result.message);
    if (result.ok) onClose();
  };

  return (
    <div className="account-popover" ref={ref}>
      <div className="account-popover__profile">
        <ProfileCard user={user} size={44} />
      </div>

      <button type="button" className="account-popover__signout" onClick={() => { void signOut(); onClose(); }}>
        Log out
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
