export const THEME_COLOR_STORAGE_KEY = "resume-studio:theme-color"

export const THEME_COLORS = [
  { id: "green", label: "Green" },
  { id: "purple", label: "Purple" },
  { id: "white", label: "White" },
] as const

export type ThemeColor = (typeof THEME_COLORS)[number]["id"]

export function isThemeColor(value: string | null): value is ThemeColor {
  if (!value) return false
  return THEME_COLORS.some((theme) => theme.id === value)
}
