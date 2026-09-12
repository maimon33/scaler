import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#101512",
        surface: "#101512",
        "surface-container-lowest": "#090d0b",
        "surface-container-low": "#171e1a",
        "surface-container": "#1d2822",
        "surface-container-high": "#26352d",
        "surface-bright": "#33483c",
        primary: "#b9f7d1",
        "primary-container": "#3f8b65",
        "primary-fixed": "#d5ffe4",
        "on-primary-fixed": "#062016",
        secondary: "#71e7a4",
        "secondary-fixed": "#9fffc4",
        tertiary: "#f1c968",
        "tertiary-fixed": "#ffe5a2",
        "on-surface": "#eef2ed",
        "on-surface-variant": "#c1cac3",
        outline: "#89958d",
        "outline-variant": "#3c4941"
      },
      fontFamily: {
        headline: ["Space Grotesk"],
        body: ["Manrope"],
        label: ["Space Grotesk"]
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.75rem"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")],
} satisfies Config
