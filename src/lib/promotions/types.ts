export type PromotionPlacement =
  | "home"
  | "library-albums"
  | "library-artists"
  | "library-playlists"
  | "folder"
  | "local"
  | "online"
  | "library-all-music";

export type PromotionSource = "manual" | "involve-asia";

export interface Promotion {
  id: string;
  source: PromotionSource;
  type: "brand" | "product" | "service" | "campaign" | "course" | "software" | "offer";
  brandName: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  destinationUrl?: string;
  trackingUrl?: string;
  campaignName?: string;
  countries?: string[];
  enabled: boolean;
  priority?: number;
  placement: PromotionPlacement;
}

// Placement matrix (spec §16) — two independent ecosystems. Never merge these.
export const MANUAL_ALLOWED_PLACEMENTS: PromotionPlacement[] = [
  "home",
  "library-albums",
  "library-artists",
  "library-playlists",
  "folder",
];

export const API_ALLOWED_PLACEMENTS: PromotionPlacement[] = ["local", "online", "library-all-music"];

/** Second layer of protection (spec §27): the renderer re-validates before drawing anything. */
export function isPlacementAllowed(promotion: Pick<Promotion, "source" | "placement">): boolean {
  if (promotion.source === "manual") return MANUAL_ALLOWED_PLACEMENTS.includes(promotion.placement);
  if (promotion.source === "involve-asia") return API_ALLOWED_PLACEMENTS.includes(promotion.placement);
  return false;
}

/** Configurable, not hard-coded forever (spec §23-24). */
export const apiPromotionLimits: Record<"local" | "online" | "library-all-music", number> = {
  local: 1,
  online: 1,
  "library-all-music": 2,
};

export const frequencyCap = {
  maxViewsPerSession: 1,
  maxViewsPerDay: 3,
};
