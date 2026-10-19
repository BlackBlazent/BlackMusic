import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useServices } from "@/app/context/ServicesContext";
import { SERVICE_DIRECTORY } from "@/lib/services/serviceDirectory";
import { useAppSettings, type IntegrationId } from "@/app/context/AppSettingsContext";
import { Overlay } from "@/app/overlay/Overlay";
import { useCustomApis } from "@/lib/services/useCustomApis";
import { CUSTOM_SERVICE_PREFIX } from "@/lib/services/customApis";
import { useIsMobile } from "@/lib/useIsMobile";
import { CloseIcon } from "./icons";
import "./ServicesMenu.css";

// Real brand marks, shipped in public/assets — falls back to a plain letter
// badge (see ServiceBadge below) if an image is missing for a given id.
function logoPathFor(id: string): string {
  return `/assets/media/images/icons/general/thirdParty/${id}.png`;
}

const BADGE_COLOR: Record<string, string> = {
  bmusic: "#ff0030",
  spotify: "#1db954",
  audius: "#7e1bcc",
  tidal: "#000000",
  amazon: "#00a8e1",
  apple: "#fa233b",
  deezer: "#a238ff",
  soundcloud: "#ff5500",
  pandora: "#005483",
  yandex: "#fc3f1d",
  youtube: "#ff0000",
  lastfm: "#d51007",
};

function ServiceBadge({ id, name, size }: { id: string; name: string; size: number }) {
  // 2.2.0 fix: `failed` used to stick to the component instance, so after ONE failed load every later
  // service (same instance, new id) rendered the big letter. Track the id that failed instead — a
  // different id always gets a fresh attempt at its real logo.
  const [failedId, setFailedId] = useState<string | null>(null);
  if (failedId === id) {
    return (
      <span
        className="services-menu__fallback-badge"
        style={{ background: BADGE_COLOR[id] ?? "#444", width: size, height: size, fontSize: Math.round(size * 0.45) }}
        aria-hidden="true"
      >
        {name[0]}
      </span>
    );
  }
  return (
    <img
      key={id}
      src={logoPathFor(id)}
      alt=""
      width={size}
      height={size}
      className="services-menu__logo"
      onError={() => setFailedId(id)}
    />
  );
}

export function ServicesMenu() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const { activeServiceId, connectedIds, setActiveService, connect } = useServices();
  const { isEnabled } = useAppSettings();
  const mobile = useIsMobile();
  const swipe = useRef<{ x: number; y: number } | null>(null);

  // The panel lives in the global popover layer (outside the sidebar), so position it from the trigger's rect.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const place = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      setAnchor({ left: Math.max(8, r.left), top: r.bottom + 8 });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Desktop popover: a press anywhere outside closes it. The mobile drawer has its own backdrop instead.
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (!mobile) document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, mobile]);

  const { apis: customApis } = useCustomApis();
  const allServices = [
    ...SERVICE_DIRECTORY,
    ...customApis.filter((a) => a.enabled).map((a) => ({ id: `${CUSTOM_SERVICE_PREFIX}${a.id}`, name: a.name, available: true })),
  ];
  const activeService = allServices.find((s) => s.id === activeServiceId);
  const settingsControlledIds = new Set<IntegrationId>(["spotify","audius","tidal","amazon","apple","deezer","soundcloud","pandora","yandex","lastfm","youtube"]);

  const items = allServices.map((service) => {
    const isActive = service.id === activeServiceId;
    const isConnected = connectedIds.has(service.id);
    const enabledInSettings = settingsControlledIds.has(service.id as IntegrationId) ? isEnabled(service.id as IntegrationId) : true;
    const usable = service.available && enabledInSettings;
    return (
      <button
        key={service.id}
        type="button"
        role="menuitem"
        className="services-menu__item"
        data-unavailable={!usable}
        data-active={isActive}
        disabled={!usable}
        title={!enabledInSettings ? "Turned off in Settings → Integrations" : undefined}
        onClick={async () => {
          setOpen(false);
          if (!isConnected) await connect(service.id);
          else setActiveService(service.id);
        }}
      >
        <ServiceBadge id={service.id} name={service.name} size={mobile ? 30 : 22} />
        <span className="services-menu__item-name">{service.name}</span>
        {isConnected && <span className="services-menu__item-dot" title="Connected" />}
        {!service.available && <span className="services-menu__item-soon">Not available</span>}
        {service.available && !enabledInSettings && <span className="services-menu__item-soon">Off</span>}
      </button>
    );
  });

  return (
    <div className="services-menu">
      <button
        ref={triggerRef}
        type="button"
        className="services-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Services"
      >
        <ServiceBadge id={activeServiceId} name={activeService?.name ?? "BlackMusic"} size={mobile ? 28 : 30} />
      </button>

      {open && !mobile && (
        <Overlay layer="popover">
          <div className="services-menu__panel" role="menu" ref={panelRef} style={{ left: anchor.left, top: anchor.top }}>
            {items}
          </div>
        </Overlay>
      )}

      {open && mobile && (
        <Overlay layer="popover">
          <div className="services-drawer" role="presentation">
            <div className="services-drawer__backdrop" onClick={() => setOpen(false)} />
            <aside
              className="services-drawer__panel"
              role="dialog"
              aria-label="Services"
              onTouchStart={(e) => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
              onTouchEnd={(e) => {
                const start = swipe.current;
                swipe.current = null;
                if (!start) return;
                const dx = e.changedTouches[0].clientX - start.x;
                const dy = e.changedTouches[0].clientY - start.y;
                // A deliberate leftward swipe (mostly horizontal) closes it; vertical list scrolling never does.
                if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.5) setOpen(false);
              }}
            >
              <header className="services-drawer__header">
                <strong>Services</strong>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close services">
                  <CloseIcon />
                </button>
              </header>
              <div className="services-drawer__list" role="menu">{items}</div>
            </aside>
          </div>
        </Overlay>
      )}
    </div>
  );
}
