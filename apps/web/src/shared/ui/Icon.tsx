export type IconName =
  | "overview" | "file" | "sparkles" | "feedback" | "course" | "settings"
  | "menu" | "search" | "plus" | "chevron" | "close" | "download"
  | "upload" | "refresh" | "trash" | "eye" | "calendar" | "clock"
  | "users" | "logout" | "trend" | "check" | "filter" | "arrow" | "info";

const paths: Record<IconName, string> = {
  overview: "M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8",
  sparkles: "m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z M19 14l1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14z",
  feedback: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9.4 9.4 0 0 1-4-.9L3 21l1.9-4.3a8.3 8.3 0 0 1-1.3-4.5A8.4 8.4 0 0 1 12 4a8.4 8.4 0 0 1 9 7.5z M8 11h.01 M12 11h.01 M16 11h.01",
  course: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z M8 7h8 M8 11h8",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.8 1.8 0 0 0-1.9.1l-.1.1h-3.4l-.1-.2a1.8 1.8 0 0 0-1.6-1l-.2.1-2.9-1.7.1-.2a1.8 1.8 0 0 0-.1-1.9l-.1-.1v-3.4l.2-.1a1.8 1.8 0 0 0 1-1.6l-.1-.2 1.7-2.9.2.1a1.8 1.8 0 0 0 1.9-.1l.1-.1h3.4l.1.2a1.8 1.8 0 0 0 1.6 1l.2-.1 2.9 1.7-.1.2a1.8 1.8 0 0 0 .1 1.9l.1.1z",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  search: "m20 20-4.2-4.2 M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z",
  plus: "M12 5v14 M5 12h14",
  chevron: "m9 18 6-6-6-6",
  close: "m18 6-12 12 M6 6l12 12",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  refresh: "M20 7v5h-5 M4 17v-5h5 M5.6 9A7 7 0 0 1 18 6l2 6 M4 12l2 6a7 7 0 0 0 12.4-3",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v5 M14 11v5",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  calendar: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z M8 14h.01 M12 14h.01 M16 14h.01",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M20 8v6 M23 11h-6",
  logout: "M10 17l5-5-5-5 M15 12H3 M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6",
  trend: "m3 17 6-6 4 4 8-8 M15 7h6v6",
  check: "m5 12 4 4L19 6",
  filter: "M4 6h16 M7 12h10 M10 18h4",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  info: "M12 16v-4 M12 8h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
