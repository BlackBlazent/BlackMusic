import { useEffect, useState } from "react";

/** Phone-class device or narrow touch window. Drives the bottom-tab layout and which desktop-only features hide. */
export function detectMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const mobileUa = /Android|iPhone|iPad|iPod/i.test(ua);
  const narrowTouch = typeof window !== "undefined" && window.matchMedia("(max-width: 720px) and (pointer: coarse)").matches;
  return mobileUa || narrowTouch;
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(detectMobile);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const update = () => setMobile(detectMobile() || mq.matches);
    mq.addEventListener("change", update);
    update();
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

/** Native mobile OS (Android/iOS build), as opposed to a narrow desktop window. */
export const isMobileOs = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
