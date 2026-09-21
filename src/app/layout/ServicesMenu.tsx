import { useRef, useState } from "react";
import { useServices } from "@/app/context/ServicesContext";
import { SERVICE_DIRECTORY } from "@/lib/services/serviceDirectory";
import { useAppSettings, type IntegrationId } from "@/app/context/AppSettingsContext";
import { useClickOutside } from "@/lib/useClickOutside";
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
};

function ServiceBadge({ id, name, size }: { id: string; name: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="services-menu__fallback-badge"
        style={{ background: BADGE_COLOR[id], width: size, height: size }}
        aria-hidden="true"
      >
        {name[0]}
      </span>
    );
  }
  return (
    <img
      src={logoPathFor(id)}
      alt=""
      width={size}
      height={size}
      className="services-menu__logo"
      onError={() => setFailed(true)}
    />
  );
}

export function ServicesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { activeServiceId, connectedIds, setActiveService, connect } = useServices();
  const { isEnabled } = useAppSettings();
  useClickOutside(ref, () => setOpen(false), open);

  const activeService = SERVICE_DIRECTORY.find((s) => s.id === activeServiceId);
  const settingsControlledIds = new Set<IntegrationId>(["spotify", "audius", "tidal"]);

  return (
    <div className="services-menu" ref={ref}>
      <button
        type="button"
        className="services-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ServiceBadge id={activeServiceId} name={activeService?.name ?? "BlackMusic"} size={30} />
      </button>

      {open && (
        <div className="services-menu__panel" role="menu">
          {SERVICE_DIRECTORY.map((service) => {
            const isActive = service.id === activeServiceId;
            const isConnected = connectedIds.has(service.id);
            const enabledInSettings = settingsControlledIds.has(service.id as IntegrationId)
              ? isEnabled(service.id as IntegrationId)
              : true;
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
                  if (!isConnected) await connect(service.id);
                  else setActiveService(service.id);
                  setOpen(false);
                }}
              >
                <ServiceBadge id={service.id} name={service.name} size={22} />
                <span className="services-menu__item-name">{service.name}</span>
                {isConnected && <span className="services-menu__item-dot" title="Connected" />}
                {!service.available && <span className="services-menu__item-soon">Not available</span>}
                {service.available && !enabledInSettings && (
                  <span className="services-menu__item-soon">Off</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
