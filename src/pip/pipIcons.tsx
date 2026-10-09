import type { SVGProps } from "react";
import type { RepeatMode } from "@/lib/types";

const base: SVGProps<SVGSVGElement> = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function Back10Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M7 5.5 3.5 8.5 7 11.5" />
      <path d="M3.5 8.5h8a7 7 0 1 1-6.6 9.4" />
      <text x="9.3" y="17" fontSize="7.2" fill="currentColor" stroke="none" fontWeight="700" fontFamily="system-ui, sans-serif">
        10
      </text>
    </svg>
  );
}

export function Forward10Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M17 5.5 20.5 8.5 17 11.5" />
      <path d="M20.5 8.5h-8a7 7 0 1 0 6.6 9.4" />
      <text x="8.3" y="17" fontSize="7.2" fill="currentColor" stroke="none" fontWeight="700" fontFamily="system-ui, sans-serif">
        10
      </text>
    </svg>
  );
}

/** Repeat arrows; "Repeat one" gets a "1" in the middle so the three modes are distinguishable at a glance. */
export function RepeatModeIcon({ mode, ...props }: { mode: RepeatMode } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 7h11a2.5 2.5 0 0 1 2.5 2.5v1.5" />
      <path d="m14 4 3 3-3 3" />
      <path d="M19 17H8a2.5 2.5 0 0 1-2.5-2.5V13" />
      <path d="m10 20-3-3 3-3" />
      {mode === "track" && (
        <text x="10.4" y="14.2" fontSize="7.5" fill="currentColor" stroke="none" fontWeight="800" fontFamily="system-ui, sans-serif">
          1
        </text>
      )}
    </svg>
  );
}