import type { ReactNode } from "react";
import "./Tooltip.css";

export function Tooltip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <span className="tooltip" data-side={side}>
      {children}
      <span className="tooltip__bubble" role="tooltip">
        {label}
      </span>
    </span>
  );
}
