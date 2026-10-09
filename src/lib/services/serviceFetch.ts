import { isTauri } from "@/lib/platform";

/**
 * Inside Tauri the webview enforces CORS like any browser, and several music
 * APIs (Deezer, Yandex, Tidal, Amazon, …) don't send CORS headers. The Tauri
 * HTTP plugin makes the request from the Rust side instead, so those calls
 * work; in a plain browser tab (UI iteration) it falls back to normal fetch.
 * Allowed hosts are scoped in src-tauri/capabilities/default.json.
 */
export async function serviceFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(input, init);
  }
  return fetch(input, init);
}

export async function serviceJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await serviceFetch(input, init);
  if (!response.ok) throw new Error(`${new URL(input).host} responded ${response.status}`);
  return (await response.json()) as T;
}
