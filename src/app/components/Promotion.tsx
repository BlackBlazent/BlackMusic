import type { ReactNode } from "react";
import type { Promotion } from "@/lib/promotions/types";
import { isPlacementAllowed } from "@/lib/promotions/types";
import { openInSystemBrowser } from "@/lib/services/openInSystemBrowser";
import "./Promotion.css";

function openOffer(promotion: Promotion) {
  const url = promotion.trackingUrl || promotion.destinationUrl;
  if (url) void openInSystemBrowser(url); // affiliate redirect — attribution happens on Involve Asia's side
}

/** Banner → brand logo → fallback artwork (spec §25). Remote images only; nothing is downloaded or stored. */
export function PromotionImage({ promotion }: { promotion: Promotion }) {
  if (!promotion.imageUrl) {
    return <span className="promotion-fallback-art" aria-hidden="true">{promotion.brandName[0]}</span>;
  }
  return (
    <img
      src={promotion.imageUrl}
      alt={promotion.brandName}
      loading="lazy"
      onError={(e) => ((e.currentTarget.style.display = "none"), undefined)}
    />
  );
}

/** Home rail card — same family as `.rail-item`. */
export function PromotionRailItem({ promotion }: { promotion: Promotion }) {
  if (!isPlacementAllowed(promotion)) return null;
  return (
    <button
      type="button"
      className="rail-item promotion-item"
      data-promotion-id={promotion.id}
      data-promotion-source={promotion.source}
      data-promotion-placement={promotion.placement}
      onClick={() => openOffer(promotion)}
    >
      <span className="rail-item__art promotion-item__art">
        <PromotionImage promotion={promotion} />
      </span>
      <span className="rail-item__title">{promotion.title}</span>
      <span className="rail-item__subtitle">Sponsored offer</span>
    </button>
  );
}

/** Library Albums / Artists / Playlists tile. */
export function PromotionTile({ promotion }: { promotion: Promotion }) {
  if (!isPlacementAllowed(promotion)) return null;
  return (
    <button
      type="button"
      className="tile promotion-tile"
      data-promotion-id={promotion.id}
      data-promotion-source={promotion.source}
      data-promotion-placement={promotion.placement}
      onClick={() => openOffer(promotion)}
    >
      <span className="tile__art promotion-tile__art">
        <PromotionImage promotion={promotion} />
      </span>
      <span className="tile__title">{promotion.title}</span>
      <span className="tile__subtitle">Sponsored</span>
    </button>
  );
}

/** Folder page card — same family as `.folder-card`. */
export function PromotionFolderCard({ promotion }: { promotion: Promotion }) {
  if (!isPlacementAllowed(promotion)) return null;
  return (
    <div
      className="folder-card promotion-card"
      data-promotion-id={promotion.id}
      data-promotion-source={promotion.source}
      data-promotion-placement={promotion.placement}
    >
      <button type="button" className="folder-card__thumb promotion-card__thumb" aria-label="Open promotion" onClick={() => openOffer(promotion)}>
        <PromotionImage promotion={promotion} />
      </button>
      <span className="folder-card__name">{promotion.brandName}</span>
      <span className="folder-card__count">Sponsored</span>
      <button type="button" className="promotion-card__action" onClick={() => openOffer(promotion)}>
        View Offer
      </button>
    </div>
  );
}

/**
 * API promotion as a row. `variant` picks the host list's own row class so it
 * lines up with the music rows around it (Local / Online / Library → All Music).
 */
export function PromotionRow({
  promotion,
  variant,
  children,
}: {
  promotion: Promotion;
  variant: "local" | "online" | "library-all-music";
  children?: ReactNode;
}) {
  if (!isPlacementAllowed(promotion)) return null;
  const common = {
    "data-promotion-id": promotion.id,
    "data-promotion-source": promotion.source,
    "data-promotion-placement": promotion.placement,
  } as const;

  if (variant === "library-all-music") {
    return (
      <div className="library-page__track promotion-track" {...common}>
        <button type="button" className="promotion-track__image" aria-label="Open promotion" onClick={() => openOffer(promotion)}>
          <PromotionImage promotion={promotion} />
        </button>
        <button type="button" className="library-page__track-title" onClick={() => openOffer(promotion)}>
          {promotion.title}
        </button>
        <span>{promotion.brandName}</span>
        <span>Sponsored</span>
        {children}
      </div>
    );
  }

  const rowClass = variant === "local" ? "local-page__row" : "online-page__row";
  const titleClass = variant === "local" ? "local-page__title" : "online-page__title";
  return (
    <div className={`${rowClass} promotion-row`} role="row" {...common} data-promotion-variant={variant}>
      <button type="button" className="promotion-row__image" aria-label="Open promotion" onClick={() => openOffer(promotion)}>
        <PromotionImage promotion={promotion} />
      </button>
      <span className={titleClass}>{promotion.title}</span>
      <span>{promotion.brandName}</span>
      <span>Sponsored</span>
      <span>Offer</span>
      {children}
    </div>
  );
}
