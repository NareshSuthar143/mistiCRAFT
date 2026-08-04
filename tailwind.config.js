/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./*.js"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "error": "#ba1a1a", "surface": "#fbf9f4", "on-primary": "#ffffff",
        "tertiary": "#9c4421", "inverse-primary": "#e9c176",
        "surface-container-high": "#eae8e3", "inverse-surface": "#30312e",
        "primary": "#775a19", "on-primary-container": "#4e3700",
        "on-primary-fixed-variant": "#5d4201", "secondary": "#2a6865",
        "surface-container-highest": "#e4e2dd", "on-primary-fixed": "#261900",
        "surface-container-lowest": "#ffffff", "on-secondary-fixed-variant": "#084f4d",
        "surface-container": "#f0eee9", "secondary-fixed-dim": "#95d1ce",
        "on-tertiary-container": "#6d2201", "outline-variant": "#d1c5b4",
        "tertiary-fixed-dim": "#ffb59b", "on-surface": "#1b1c19",
        "on-secondary-fixed": "#00201f", "surface-bright": "#fbf9f4",
        "on-surface-variant": "#4e4639", "outline": "#7f7667",
        "surface-tint": "#775a19", "error-container": "#ffdad6",
        "surface-dim": "#dbdad5", "inverse-on-surface": "#f2f1ec",
        "background": "#fbf9f4", "on-tertiary": "#ffffff",
        "primary-fixed": "#ffdea5", "on-tertiary-fixed": "#380d00",
        "on-secondary-container": "#316e6b", "secondary-fixed": "#b1eeea",
        "on-background": "#1b1c19", "on-error": "#ffffff",
        "primary-container": "#c5a059", "on-error-container": "#93000a",
        "surface-container-low": "#f5f3ee", "primary-fixed-dim": "#e9c176",
        "tertiary-fixed": "#ffdbcf", "on-secondary": "#ffffff",
        "secondary-container": "#b1eeea", "surface-variant": "#e4e2dd",
        "on-tertiary-fixed-variant": "#7c2d0b", "tertiary-container": "#f4885f"
      },
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
      spacing: {
        "section-padding-mobile": "48px", "container-margin": "20px",
        base: "8px", gutter: "16px", "section-padding-desktop": "80px"
      },
      fontFamily: {
        "body-md": ["Montserrat"], "label-md": ["Montserrat"],
        "display-lg-mobile": ["Playfair Display"], "headline-md": ["Playfair Display"],
        "headline-lg": ["Playfair Display"], "display-lg": ["Playfair Display"],
        "label-sm": ["Montserrat"], "body-lg": ["Montserrat"]
      },
      fontSize: {
        "body-md": ["16px", {lineHeight: "24px", fontWeight: "400"}],
        "label-md": ["14px", {lineHeight: "20px", letterSpacing: "0.05em", fontWeight: "600"}],
        "display-lg-mobile": ["36px", {lineHeight: "42px", letterSpacing: "-0.01em", fontWeight: "700"}],
        "headline-md": ["24px", {lineHeight: "32px", fontWeight: "600"}],
        "headline-lg": ["32px", {lineHeight: "40px", fontWeight: "600"}],
        "display-lg": ["48px", {lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700"}],
        "label-sm": ["12px", {lineHeight: "16px", letterSpacing: "0.08em", fontWeight: "500"}],
        "body-lg": ["18px", {lineHeight: "28px", fontWeight: "400"}]
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries")
  ]
};
