export const BACKGROUND_THEMES = [
  { id: "current", label: "Wave" },
  { id: "aurora", label: "Aurora" },
  { id: "nebula", label: "Nebula" },
  { id: "still", label: "Still" },
  { id: "black", label: "Black" },
] as const

export type BackgroundTheme = (typeof BACKGROUND_THEMES)[number]["id"]
