import { useSharedSetting } from "@/lib/sharedSetting";

/** FEAT-04 — animation for the seek / progress bar. Applies ONLY to the Playground and the global playback bar. */
export type SeekAnimation = "classic" | "wavy" | "zigzag" | "flash" | "dissolve";
export const SEEK_ANIMATIONS: { id: SeekAnimation; label: string; hint: string }[] = [
  { id: "classic", label: "Classic", hint: "A plain bar" },
  { id: "wavy", label: "Wavy", hint: "A flowing wave fills the played part" },
  { id: "zigzag", label: "Zigzag", hint: "A sharp zigzag runs along the bar" },
  { id: "flash", label: "Flash", hint: "The played part pulses with light" },
  { id: "dissolve", label: "Dissolve", hint: "The played part fades and shimmers" },
];

export const useSeekAnimation = () => useSharedSetting<SeekAnimation>("seekAnimation", "classic");
