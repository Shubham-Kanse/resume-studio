import { ImageResponse } from "next/og"

export const size = {
  width: 32,
  height: 32,
}

export const contentType = "image/png"

const TILE_BACKGROUND = "#22c55e"
const TILE_HIGHLIGHT = "#4ade80"
const TILE_SHADOW = "#14532d"
const ICON_COLOR = "#f7fee7"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: `linear-gradient(135deg, ${TILE_HIGHLIGHT} 0%, ${TILE_BACKGROUND} 58%, ${TILE_SHADOW} 100%)`,
          borderRadius: 8,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="22"
          viewBox="0 0 24 24"
          width="22"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 3.5L13.9 8.1L18.5 10L13.9 11.9L12 16.5L10.1 11.9L5.5 10L10.1 8.1L12 3.5Z"
            fill={ICON_COLOR}
          />
          <path
            d="M18.25 4.75L19.05 6.7L21 7.5L19.05 8.3L18.25 10.25L17.45 8.3L15.5 7.5L17.45 6.7L18.25 4.75Z"
            fill={ICON_COLOR}
            opacity="0.92"
          />
          <path
            d="M6.25 14.75L7.05 16.7L9 17.5L7.05 18.3L6.25 20.25L5.45 18.3L3.5 17.5L5.45 16.7L6.25 14.75Z"
            fill={ICON_COLOR}
            opacity="0.72"
          />
        </svg>
      </div>
    ),
    size
  )
}
