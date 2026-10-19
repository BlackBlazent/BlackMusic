import { useSharedSetting } from "./sharedSetting";

/** All Settings → Personalization values, as shared settings so the shell reacts instantly. */
export interface BannerSettings {
  kind: "none" | "photo" | "video";
  /** Absolute path of the copy kept in the app data folder. */
  path: string;
  heightPx: number;
  /** 0–0.9: how much the banner is dimmed toward the theme background, for text legibility. */
  dim: number;
  /** Video only: let the video's own sound play (it's muted by default). */
  videoAudio: boolean;
}
export const DEFAULT_BANNER: BannerSettings = { kind: "none", path: "", heightPx: 240, dim: 0.35, videoAudio: false };
export const useBanner = () => useSharedSetting<BannerSettings>("banner", DEFAULT_BANNER);

export type DockEdge = "off" | "bottom" | "left" | "right" | "top";
export interface DockSettings {
  /** Which edge the global playback bar / page tools are pinned to. */
  edge: DockEdge;
  /** macOS-dock style magnification of docked items on hover. */
  magnify: boolean;
  magnification: number; // 1–2
  iconSize: number; // px
  autoHide: boolean;
  pages: Record<"home" | "playground" | "local" | "online" | "library" | "folder" | "settings" | "playback", boolean>;
}
export const DEFAULT_DOCK: DockSettings = {
  edge: "off",
  magnify: true,
  magnification: 1.5,
  iconSize: 40,
  autoHide: false,
  pages: { home: true, playground: true, local: true, online: true, library: true, folder: true, settings: true, playback: true },
};
export const useDock = () => useSharedSetting<DockSettings>("dock", DEFAULT_DOCK);

export interface ScreensaverSettings {
  enabled: boolean;
  idleMinutes: number;
  mode: "bars" | "waves" | "particles" | "liquid";
  showTrackInfo: boolean;
}
export const DEFAULT_SCREENSAVER: ScreensaverSettings = { enabled: true, idleMinutes: 5, mode: "liquid", showTrackInfo: true };
export const useScreensaver = () => useSharedSetting<ScreensaverSettings>("screensaver", DEFAULT_SCREENSAVER);

export const useCoverEffect = () => useSharedSetting<"off" | "vibrate" | "zoom" | "rotate">("coverEffect", "off");
export const useButtonMotion = () => useSharedSetting<boolean>("buttonMotion", true);

/** Last.fm username — enables "Your recent scrobbles" on the Online → Last.fm page. */
export const useLastfmUser = () => useSharedSetting<string>("lastfmUser", "");
