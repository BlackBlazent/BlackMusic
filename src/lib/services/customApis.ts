import { getPreference, setPreference } from "@/lib/preferencesStore";

const KEY = "blackmusic:customServiceApis";

/** A user-supplied music service API (Settings → Custom API integrations). */
export interface CustomServiceApi {
  id: string;
  name: string;
  /** Endpoint that returns a JSON list of tracks (see mapCustomTracks for accepted shapes). */
  baseUrl: string;
  apiKey: string;
  /** Header the key is sent in. Default "Authorization" (sent as `Bearer <key>`). */
  authHeader: string;
  enabled: boolean;
}

export async function loadCustomApis(): Promise<CustomServiceApi[]> {
  return getPreference<CustomServiceApi[]>(KEY, []);
}

export async function saveCustomApis(apis: CustomServiceApi[]): Promise<void> {
  await setPreference(KEY, apis);
}

export const CUSTOM_SERVICE_PREFIX = "custom:";
