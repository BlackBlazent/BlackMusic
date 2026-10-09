import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getPreference, setPreference } from "@/lib/preferencesStore";

const KEY = "blackmusic:lastRoute";
const SCROLL_KEY = "blackmusic:scrollByRoute";

/** Restores the page you were on when the app was closed, then keeps tracking it. */
export function RouteResume() {
  const location = useLocation();
  const navigate = useNavigate();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (location.pathname !== "/" || location.search) return; // launched straight into somewhere (deep link etc.)
    getPreference<string | null>(KEY, null).then((saved) => {
      if (saved && saved !== "/") navigate(saved, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on launch
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    void setPreference(KEY, `${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  // Scroll position per page: saved (debounced) as you scroll, restored when the page content appears.
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".app-shell__content");
    if (!scroller) return;
    const path = location.pathname;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    getPreference<Record<string, number>>(SCROLL_KEY, {}).then((all) => {
      const target = all[path];
      if (!target || cancelled) return;
      // Lists render after the library loads — retry briefly until the page is tall enough.
      let tries = 0;
      const attempt = () => {
        if (cancelled) return;
        scroller.scrollTop = target;
        if (Math.abs(scroller.scrollTop - target) > 4 && tries++ < 20) setTimeout(attempt, 150);
      };
      attempt();
    });

    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const all = await getPreference<Record<string, number>>(SCROLL_KEY, {});
        await setPreference(SCROLL_KEY, { ...all, [path]: scroller.scrollTop });
      }, 400);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [location.pathname]);

  return null;
}
