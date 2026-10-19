import { LATEST_CHANGELOG } from "@/lib/changelog";
import { Modal } from "@/app/overlay/Modal";
import { CloseIcon } from "@/app/layout/icons";
import "./EditMetadataModal.css";
import "./ChangelogModal.css";

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div className="changelog-dialog changelog" role="dialog" aria-label="What's new">
        <div className="edit-meta__header">
          <h2>What's new in {LATEST_CHANGELOG.version}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="changelog__body">
          {LATEST_CHANGELOG.sections.map((section) => (
            <section key={section.heading}>
              <h3>{section.heading}</h3>
              <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
