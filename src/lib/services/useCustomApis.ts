import { useCallback, useEffect, useState } from "react";
import { loadCustomApis, saveCustomApis, type CustomServiceApi } from "./customApis";

const EVENT = "blackmusic:customApisChanged";

/** Shared, live list of the user's own music-service APIs (Settings adds them; menu + Online read them). */
export function useCustomApis() {
  const [apis, setApis] = useState<CustomServiceApi[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = () => loadCustomApis().then((list) => alive && setApis(list));
    void refresh();
    window.addEventListener(EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, refresh);
    };
  }, []);

  const persist = useCallback(async (next: CustomServiceApi[]) => {
    setApis(next);
    await saveCustomApis(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { apis, save: persist };
}
