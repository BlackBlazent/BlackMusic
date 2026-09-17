import { useState } from "react";
import { useLibrary } from "@/app/context/LibraryContext";
import { useFolders } from "@/app/context/FoldersContext";
import { Tooltip } from "@/app/components/Tooltip";
import { RefreshIcon } from "./icons";
import "./Footer.css";

export function Footer() {
  const { rescan, scanning } = useLibrary();
  const { folders } = useFolders();
  const [spinning, setSpinning] = useState(false);

  const onReload = async () => {
    setSpinning(true);
    await rescan();
    setSpinning(false);
  };

  return (
    <footer className="app-footer">
      <span className="app-footer__copyright">© BlackMusic {new Date().getFullYear()}</span>

      <span className="app-footer__status">
        <span className="app-footer__dot" data-ok={folders.length > 0} />
        {folders.length === 0 ? "No folders watched" : `${folders.length} folder${folders.length === 1 ? "" : "s"} watched`}
      </span>

      <div className="app-footer__actions">
        <Tooltip label="Reload library" side="top">
          <button
            type="button"
            className="app-footer__reload"
            data-spinning={spinning || scanning}
            onClick={onReload}
            aria-label="Reload"
          >
            <RefreshIcon />
          </button>
        </Tooltip>
        <a
          className="app-footer__feedback"
          href="mailto:feedback@blackmusic.app?subject=BlackMusic%20feedback"
        >
          Give feedback
        </a>
      </div>
    </footer>
  );
}
