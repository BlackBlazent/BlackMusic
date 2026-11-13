import { useEffect, useRef, useState } from "react";
import { Modal } from "@/app/overlay/Modal";
import { checkForUpdate, installUpdateAndRelaunch, errorText, type UpdateInfo } from "@/lib/updater";
import { isTauri } from "@/lib/platform";
import { isMobileOs } from "@/lib/useIsMobile";
import { useSharedSetting } from "@/lib/sharedSetting";
import { APP_VERSION } from "@/lib/appVersion";
import "./UpdateWatcher.css";

const FIRST_CHECK_MS = 10_000;
const EVERY_MS = 6 * 60 * 60 * 1000;

export const useAutoUpdateCheck = () => useSharedSetting<boolean>("autoUpdateCheck", true);

/**
 * IMP-09 §9.4 — background update scan. Quietly checks shortly after start and every few hours (desktop only; mobile
 * updates come from the store), and shows an overlay when a newer version exists, with live percentage during install.
 */
export function UpdateWatcher() {
  const [auto] = useAutoUpdateCheck();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [phase, setPhase] = useState<"offer" | "installing" | "error">("offer");
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);

  useEffect(() => {
    if (!auto || !isTauri() || isMobileOs()) return;
    let alive = true;
    const scan = async () => {
      if (busy.current) return;
      try {
        const found = await checkForUpdate();
        if (alive && found) setUpdate(found);
      } catch {
        /* a silent background scan never nags; Settings → Updates shows the reason on a manual check */
      }
    };
    const first = setTimeout(scan, FIRST_CHECK_MS);
    const every = setInterval(scan, EVERY_MS);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(every);
    };
  }, [auto]);

  if (!update || dismissed === update.version) return null;

  const install = async () => {
    busy.current = true;
    setPhase("installing");
    setPct(0);
    try {
      await installUpdateAndRelaunch((done, total) => setPct(total ? Math.min(100, Math.round((done / total) * 100)) : null));
    } catch (e) {
      setError(errorText(e));
      setPhase("error");
      busy.current = false;
    }
  };

  return (
    <Modal onClose={() => phase !== "installing" && setDismissed(update.version)}>
      <div className="update-watcher" role="dialog" aria-label="Update available">
        <h2>BlackMusic {update.version} is available</h2>
        <p className="update-watcher__sub">You have {APP_VERSION}.{update.date ? ` Released ${update.date}.` : ""}</p>
        {update.body && <p className="update-watcher__notes">{update.body}</p>}

        {phase === "installing" && (
          <div className="update-watcher__progress" aria-live="polite">
            <div className="update-watcher__bar"><span style={{ width: pct === null ? "35%" : `${pct}%` }} data-indeterminate={pct === null} /></div>
            <strong>{pct === null ? "Downloading…" : `${pct}%`}</strong>
            <small>BlackMusic restarts when the update is installed. Playback pauses.</small>
          </div>
        )}
        {phase === "error" && <p className="update-watcher__error">{error}</p>}

        {phase !== "installing" && (
          <div className="update-watcher__actions">
            <button type="button" onClick={() => setDismissed(update.version)}>Later</button>
            <button type="button" className="update-watcher__primary" onClick={() => void install()}>{phase === "error" ? "Try again" : "Update now"}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
