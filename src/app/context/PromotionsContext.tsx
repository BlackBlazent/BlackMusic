/*
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MANUAL_PROMOTIONS } from "@/lib/promotions/manualPromotions";
import { loadApiPromotions, eligibleForView, recordView } from "@/lib/promotions/apiPromotions";
import {
  apiPromotionLimits,
  frequencyCap,
  isPlacementAllowed,
  type Promotion,
  type PromotionPlacement,
} from "@/lib/promotions/types";

interface PromotionsContextValue {
  manualFor: (placement: PromotionPlacement) => Promotion[];
  apiReady: boolean;
  allApi: Promotion[];
}

const PromotionsContext = createContext<PromotionsContextValue | null>(null);

export function PromotionsProvider({ children }: { children: ReactNode }) {
  const [allApi, setAllApi] = useState<Promotion[]>([]);
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadApiPromotions()
      .then((list) => !cancelled && setAllApi(list))
      .catch(() => undefined) // promotions must never break the app
      .finally(() => !cancelled && setApiReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<PromotionsContextValue>(
    () => ({
      allApi,
      apiReady,
      manualFor: (placement) =>
        MANUAL_PROMOTIONS.filter((p) => p.enabled && p.placement === placement && isPlacementAllowed(p)).sort(
          (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
        ),
    }),
    [allApi, apiReady],
  );

  return <PromotionsContext.Provider value={value}>{children}</PromotionsContext.Provider>;
}

export function usePromotions(): PromotionsContextValue {
  const ctx = useContext(PromotionsContext);
  if (!ctx) throw new Error("usePromotions must be used within a PromotionsProvider");
  return ctx;
}

/** Manual promotions for a placement (Home / Library tabs / Folder). 
export function useManualPromotions(placement: PromotionPlacement): Promotion[] {
  const { manualFor } = usePromotions();
  return useMemo(() => manualFor(placement), [manualFor, placement]);
}

/**
 * API promotions for a placement (Local / Online / Library → All Music).
 * Chosen once per mount, capped by `apiPromotionLimits` and the frequency cap,
 * and each shown promotion counts as one view.
 
export function useApiPromotions(placement: "local" | "online" | "library-all-music"): Promotion[] {
  const { allApi, apiReady } = usePromotions();
  const [chosen, setChosen] = useState<Promotion[]>([]);
  const decided = useRef(false);

  useEffect(() => {
    if (!apiReady || decided.current) return;
    decided.current = true;
    const candidates = allApi.filter((p) => p.placement === placement);
    (async () => {
      const picked: Promotion[] = [];
      for (const promo of candidates) {
        if (picked.length >= apiPromotionLimits[placement]) break;
        if (await eligibleForView(promo, frequencyCap)) picked.push(promo);
      }
      picked.forEach((p) => void recordView(p.id));
      setChosen(picked);
    })();
  }, [apiReady, allApi, placement]);

  return chosen;
}

/** Index positions for inserting `count` promotions into a list of `length` items. 
export function promotionSlots(length: number, count: number, first = 4, gap = 12): number[] {
  const slots: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const slot = first + i * gap;
    if (slot <= length) slots.push(slot);
  }
  return slots;
}
*/

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MANUAL_PROMOTIONS } from "@/lib/promotions/manualPromotions";
import {
  eligibleForView,
  getPromotionsStatus,
  loadApiPromotions,
  recordView,
  resetPromotionState,
  type PromotionsStatus,
} from "@/lib/promotions/apiPromotions";
import {
  apiPromotionLimits,
  frequencyCap,
  isPlacementAllowed,
  type Promotion,
  type PromotionPlacement,
} from "@/lib/promotions/types";

interface PromotionsContextValue {
  manualFor: (placement: PromotionPlacement) => Promotion[];
  apiReady: boolean;
  allApi: Promotion[];
  status: PromotionsStatus;
  /** Re-ask the backend now (ignores the local cache). */
  reload: () => Promise<void>;
  /** Forget the cached list and the per-promotion view counts. */
  resetLimits: () => Promise<void>;
}

const PromotionsContext = createContext<PromotionsContextValue | null>(null);

export function PromotionsProvider({ children }: { children: ReactNode }) {
  const [allApi, setAllApi] = useState<Promotion[]>([]);
  const [apiReady, setApiReady] = useState(false);
  const [status, setStatus] = useState<PromotionsStatus>(getPromotionsStatus());

  // One async function sets list + ready together, so a page can never see "ready" with a stale empty list.
  const load = useCallback(async (force: boolean) => {
    try {
      setAllApi(await loadApiPromotions(force));
    } catch {
      /* promotions must never break the app */
    }
    setStatus({ ...getPromotionsStatus() });
    setApiReady(true);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const value = useMemo<PromotionsContextValue>(
    () => ({
      allApi,
      apiReady,
      status,
      reload: () => load(true),
      resetLimits: async () => {
        await resetPromotionState();
        await load(true);
      },
      manualFor: (placement) =>
        MANUAL_PROMOTIONS.filter((p) => p.enabled && p.placement === placement && isPlacementAllowed(p)).sort(
          (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
        ),
    }),
    [allApi, apiReady, status, load],
  );

  return <PromotionsContext.Provider value={value}>{children}</PromotionsContext.Provider>;
}

export function usePromotions(): PromotionsContextValue {
  const ctx = useContext(PromotionsContext);
  if (!ctx) throw new Error("usePromotions must be used within a PromotionsProvider");
  return ctx;
}

/** Manual promotions for a placement (Home / Library tabs / Folder). */
export function useManualPromotions(placement: PromotionPlacement): Promotion[] {
  const { manualFor } = usePromotions();
  return useMemo(() => manualFor(placement), [manualFor, placement]);
}

/**
 * API promotions for a placement (Local / Online / Library → All Music).
 * Chosen once per mount, capped by `apiPromotionLimits` and the frequency cap
 * (release builds only), and each shown promotion counts as one view.
 */
export function useApiPromotions(placement: "local" | "online" | "library-all-music"): Promotion[] {
  const { allApi, apiReady } = usePromotions();
  const [chosen, setChosen] = useState<Promotion[]>([]);
  const decided = useRef(false);

  useEffect(() => {
    if (!apiReady || decided.current) return;
    decided.current = true;
    const candidates = allApi.filter((p) => p.placement === placement);
    (async () => {
      const picked: Promotion[] = [];
      for (const promo of candidates) {
        if (picked.length >= apiPromotionLimits[placement]) break;
        if (await eligibleForView(promo, frequencyCap)) picked.push(promo);
      }
      picked.forEach((p) => void recordView(p.id));
      setChosen(picked);
    })();
  }, [apiReady, allApi, placement]);

  return chosen;
}

/** Index positions for inserting `count` promotions into a list of `length` items. */
export function promotionSlots(length: number, count: number, first = 4, gap = 12): number[] {
  const slots: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const slot = first + i * gap;
    if (slot <= length) slots.push(slot);
  }
  return slots;
}
