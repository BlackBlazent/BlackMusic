import { CHANGELOG_2_1_0 } from "@/lib/changelog";
import { CloseIcon } from "@/app/layout/icons";
import "./EditMetadataModal.css";
import "./ChangelogModal.css";

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="edit-meta__backdrop" onClick={onClose}>
      <div className="edit-meta changelog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="What's new">
        <div className="edit-meta__header">
          <h2>What's new in {CHANGELOG_2_1_0.version}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="changelog__body">
          {CHANGELOG_2_1_0.sections.map((section) => (
            <section key={section.heading}>
              <h3>{section.heading}</h3>
              <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
