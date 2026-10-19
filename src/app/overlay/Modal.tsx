import type { ReactNode } from "react";
import { Overlay } from "./Overlay";

/** Centered modal in the global layer. Backdrop stops below the navbar / above the footer. */
export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <Overlay layer="modal">
      <div className="bm-modal-backdrop" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
      </div>
    </Overlay>
  );
}
