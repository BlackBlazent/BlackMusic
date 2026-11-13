import { SERVICE_CLIENTS } from "./serviceRegistry";
import { CUSTOM_SERVICE_PREFIX } from "./customApis";

/**
 * IMP-02 — what the Online page should say when a service can't be browsed. No dead end, no blank page: every state has words
 * and a way out. (store-compliance.md: "no active button that does nothing, no blank screens".)
 */
export type ServiceState =
  | { kind: "ready" }
  | { kind: "unavailable"; title: string; message: string };

/** Services whose provider offers no open API for this kind of use. Honest wording, never "coming soon" for something that can't happen. */
const NO_PUBLIC_API: Record<string, string> = {
  pandora: "Pandora doesn't offer a public API, so BlackMusic can't list or play its catalog. If you run your own compatible endpoint you can add it in Settings → Service API keys.",
  amazon: "Amazon Music's developer API is invite-only, so most people can't connect it yet. It will appear here once you add working credentials in Settings → Service API keys.",
  tidal: "Tidal's developer API is limited-access. If you have credentials, add them in Settings → Service API keys; otherwise Tidal can't be browsed here yet.",
};

export function serviceState(id: string): ServiceState {
  if (id === "bmusic" || id === "spotify" || id.startsWith(CUSTOM_SERVICE_PREFIX)) return { kind: "ready" };
  if (SERVICE_CLIENTS[id]) return { kind: "ready" };
  return {
    kind: "unavailable",
    title: "This service isn't available in BlackMusic yet",
    message: NO_PUBLIC_API[id] ?? "BlackMusic doesn't have a connection for this service yet. Your own library and the other services still work.",
  };
}

/** Extra context for a service that IS wired but needs credentials that most people can't get. */
export const credentialNote = (id: string): string | undefined => NO_PUBLIC_API[id];
