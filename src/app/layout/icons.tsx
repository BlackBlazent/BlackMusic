import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 10.5 12 3l8.5 7.5" />
      <path d="M5.5 9v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

export function PlaygroundIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4" width="17" height="13" rx="1.5" />
      <path d="M10 8.2v4.6l4-2.3-4-2.3Z" fill="currentColor" stroke="none" />
      <path d="M8.5 20.5h7" />
      <path d="M12 17v3.5" />
    </svg>
  );
}

export function LocalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h9" />
      <path d="M4 11h9" />
      <path d="M4 16.5h6" />
      <circle cx="18" cy="15.5" r="2.5" />
      <path d="M20.5 15.5V6l-4 1.2" />
    </svg>
  );
}

export function OnlineIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.3-3.6-8.5S9.6 5.8 12 3.5Z" />
    </svg>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 6.5a1 1 0 0 1 1-1h4.4l1.8 2h9.3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-15.5a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
      <path d="M9.7 18.5a2.3 2.3 0 0 0 4.6 0" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1h-.2a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6v-.2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20s-7.5-4.6-9.8-9.3C.8 7.4 2.5 4 6 4c2 0 3.4 1.1 4.2 2.4C11 5.1 12.4 4 14.4 4c3.5 0 5.2 3.4 3.8 6.7C15.9 15.4 12 20 12 20Z" />
    </svg>
  );
}

export function ChevronsLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m13.5 6-6 6 6 6" />
      <path d="m19 6-6 6 6 6" />
    </svg>
  );
}

export function UndoArrowIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8.5 9.5H16a4.5 4.5 0 0 1 0 9h-3" />
      <path d="m8.5 9.5 4-4M8.5 9.5l4 4" />
    </svg>
  );
}

export function RedoArrowIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M15.5 9.5H8a4.5 4.5 0 0 0 0 9h3" />
      <path d="m15.5 9.5-4-4M15.5 9.5l-4 4" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base} {...props} fill="currentColor" stroke="none">
      <path d="M7 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...base} {...props} fill="currentColor" stroke="none">
      <rect x="6.5" y="5" width="4" height="14" rx="1" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function PreviousIcon(props: IconProps) {
  return (
    <svg {...base} {...props} fill="currentColor" stroke="none">
      <rect x="5" y="5" width="2.4" height="14" rx="1" />
      <path d="M18 5.5v13L8 12l10-6.5Z" />
    </svg>
  );
}

export function NextIcon(props: IconProps) {
  return (
    <svg {...base} {...props} fill="currentColor" stroke="none">
      <rect x="16.6" y="5" width="2.4" height="14" rx="1" />
      <path d="M6 5.5v13l10-6.5L6 5.5Z" />
    </svg>
  );
}

export function ShuffleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 7h3.2c1.6 0 3 .9 3.8 2.2" />
      <path d="M3.5 17h3.2c1.6 0 3-.9 3.8-2.2M14 7h3.7M14 17h3.7" />
      <path d="m10.3 12 .3.5" />
      <path d="m15.3 7 2.4 0 0 2.4M15.3 17l2.4 0 0-2.4" />
    </svg>
  );
}

export function RepeatIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 7h11a2.5 2.5 0 0 1 2.5 2.5v1.5" />
      <path d="m14 4 3 3-3 3" />
      <path d="M19 17H8a2.5 2.5 0 0 1-2.5-2.5V13" />
      <path d="m10 20-3-3 3-3" />
    </svg>
  );
}

export function VolumeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9.5h3.2L11 6v12l-3.8-3.5H4Z" />
      <path d="M15 9.2a3.6 3.6 0 0 1 0 5.6" />
      <path d="M17.3 6.8a7 7 0 0 1 0 10.4" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M10.8 6.8 12.5 5a3 3 0 1 1 4.5 4l-2.1 2.1" />
      <path d="M13.2 17.2 11.5 19a3 3 0 1 1-4.5-4l2.1-2.1" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4v11" />
      <path d="m7.5 11 4.5 4.5L16.5 11" />
      <path d="M5 19.5h14" />
    </svg>
  );
}

export function ScissorsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="6.5" cy="6.5" r="2.2" />
      <circle cx="6.5" cy="17.5" r="2.2" />
      <path d="m8.3 7.8 11.7 8.7M8.3 16.2 20 7.5" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5L19.5 8" />
      <path d="M19.5 4.5V8H16" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.6 5.5L4.5 16" />
      <path d="M4.5 19.5V16H8" />
    </svg>
  );
}

export function FolderOpenIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 8V6.5a1 1 0 0 1 1-1h4.4l1.8 2h8.3a1 1 0 0 1 1 1V10" />
      <path d="M3.5 8h16l-1.8 9a1 1 0 0 1-1 .8H6.3a1 1 0 0 1-1-.8Z" />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 15 8l3.5 1.3L14 13l.5 6-2.5-3.5L9.5 19l.5-6-4.5-3.7L9 8Z" />
    </svg>
  );
}

export function SortAscIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 17V7M6 7 3 10M6 7l3 3" />
      <path d="M12 8h8M12 12h6M12 16h4" />
    </svg>
  );
}

export function SortDescIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 7v10M6 17l-3-3M6 17l3-3" />
      <path d="M12 8h4M12 12h6M12 16h8" />
    </svg>
  );
}

export function CheckSquareIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h16l-6 7v5l-4 2v-7Z" />
    </svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <svg {...base} {...props} fill="currentColor" stroke="none">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

export function Rewind10Icon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 6.5 3.5 9 7 11.5" />
      <path d="M3.5 9h6a6.5 6.5 0 1 1-6.2 8.5" />
      <text x="9" y="17" fontSize="7" fill="currentColor" stroke="none" fontWeight="700">
        10
      </text>
    </svg>
  );
}

export function Forward15Icon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M17 6.5 20.5 9 17 11.5" />
      <path d="M20.5 9h-6a6.5 6.5 0 1 0 6.2 8.5" />
      <text x="6.5" y="17" fontSize="7" fill="currentColor" stroke="none" fontWeight="700">
        15
      </text>
    </svg>
  );
}

export function FullscreenIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 4H5a1 1 0 0 0-1 1v3" />
      <path d="M16 4h3a1 1 0 0 1 1 1v3" />
      <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M16 20h3a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

export function CaptionsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M7 10.5c-1.2 0-2 .8-2 2s.8 2 2 2c.6 0 1.1-.2 1.5-.6" />
      <path d="M14 10.5c-1.2 0-2 .8-2 2s.8 2 2 2c.6 0 1.1-.2 1.5-.6" />
    </svg>
  );
}

export function QueueListIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h11M4 12h11M4 18h7" />
      <path d="M18 9v9M15.5 15.5 18 18l2.5-2.5" />
    </svg>
  );
}
