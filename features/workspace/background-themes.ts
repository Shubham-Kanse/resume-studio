export const BACKGROUND_THEMES = [
  { id: "current", label: "Wave" },
  { id: "aurora", label: "Aurora" },
] as const

export type BackgroundTheme = (typeof BACKGROUND_THEMES)[number]["id"]
