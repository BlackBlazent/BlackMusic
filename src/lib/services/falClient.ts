import { getPreference } from "@/lib/preferencesStore";
import { SERVICE_KEYS_STORAGE_KEY, type ServiceKeys } from "./serviceRegistry";
import { useSharedSetting } from "@/lib/sharedSetting";
import { serviceFetch } from "./serviceFetch";

/**
 * fal.ai image generation (3.0.0, IMP-09 §9.2 + FEAT-09 "Generate Thumbnail").
 * User-based: it runs on the USER'S OWN fal.ai key and subscription — BlackMusic never ships a key. The key is stored
 * locally with the other service keys (id "falai"). Request shapes follow fal's queue-less `https://fal.run/<endpoint>`
 * HTTP API; verify an endpoint's schema on fal.ai before relying on a model not listed here as tested.
 */
export interface FalModel {
  id: string;
  label: string;
  endpoint: string;
  price: string;
  body: (prompt: string) => Record<string, unknown>;
}

const square = (prompt: string) => ({ prompt, image_size: "square_hd", num_images: 1 });
const ratio = (prompt: string) => ({ prompt, aspect_ratio: "1:1", num_images: 1 });

export const FAL_MODELS: FalModel[] = [
  { id: "flux-schnell", label: "FLUX.1 [schnell] — cheapest", endpoint: "fal-ai/flux/schnell", price: "$0.003 / megapixel", body: square },
  { id: "z-image-turbo", label: "Z Image Turbo", endpoint: "fal-ai/z-image/turbo", price: "$0.005 / megapixel", body: square },
  { id: "nano-banana", label: "Nano Banana", endpoint: "fal-ai/nano-banana", price: "$0.0398 / image", body: ratio },
  { id: "nano-banana-2", label: "Nano Banana 2", endpoint: "fal-ai/nano-banana-2", price: "$0.08 / image", body: ratio },
  { id: "nano-banana-pro", label: "Nano Banana Pro", endpoint: "fal-ai/nano-banana-pro", price: "$0.15 / image", body: ratio },
  { id: "gpt-image-2", label: "GPT Image 2", endpoint: "openai/gpt-image-2", price: "$1 / unit", body: (prompt) => ({ prompt, num_images: 1 }) },
];

export const useFalModelId = () => useSharedSetting<string>("falModel", "flux-schnell");

export class FalError extends Error {
  constructor(message: string, readonly kind: "no-key" | "auth" | "billing" | "rate-limit" | "timeout" | "network" | "bad-response") {
    super(message);
    this.name = "FalError";
  }
}

export async function loadFalKey(): Promise<string> {
  const keys = await getPreference<ServiceKeys>(SERVICE_KEYS_STORAGE_KEY, {});
  return (keys.falai ?? "").trim();
}

export function coverPrompt(t: { title: string; artist: string; album: string; genre?: string; mood?: string }): string {
  const bits = [`Square album cover artwork for the ${t.genre ? `${t.genre} ` : ""}release "${t.album && t.album !== "Unknown album" ? t.album : t.title}"`];
  if (t.artist && t.artist !== "Unknown artist") bits.push(`by ${t.artist}`);
  if (t.mood) bits.push(`${t.mood.toLowerCase()} mood`);
  bits.push("professional graphic design, bold composition, no text, no letters, no watermark");
  return bits.join(", ");
}

/** Returns the URL of one generated image. Throws FalError with a message fit to show the user. */
export async function generateCoverImage(prompt: string, modelId: string): Promise<string> {
  const key = await loadFalKey();
  if (!key) throw new FalError("Add your fal.ai API key in Settings → AI artwork (fal.ai) to generate thumbnails.", "no-key");
  const model = FAL_MODELS.find((m) => m.id === modelId) ?? FAL_MODELS[0];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await serviceFetch(`https://fal.run/${model.endpoint}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(model.body(prompt)),
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) throw new FalError("fal.ai rejected your API key. Check it in Settings.", "auth");
    if (res.status === 402) throw new FalError("Your fal.ai balance is empty. Top it up on fal.ai and try again.", "billing");
    if (res.status === 429) throw new FalError("fal.ai is rate-limiting you. Wait a moment and try again.", "rate-limit");
    if (!res.ok) throw new FalError(`fal.ai couldn't generate the image (${res.status}).`, "bad-response");
    const data = (await res.json()) as { images?: { url?: string }[]; image?: { url?: string } };
    const url = data.images?.[0]?.url ?? data.image?.url;
    if (!url || !url.startsWith("https://")) throw new FalError("fal.ai answered without an image.", "bad-response");
    return url;
  } catch (e) {
    if (e instanceof FalError) throw e;
    if (controller.signal.aborted) throw new FalError("fal.ai took too long (90 s). Try a faster model.", "timeout");
    throw new FalError("Couldn't reach fal.ai. Check your connection.", "network");
  } finally {
    clearTimeout(timer);
  }
}
