import type { Config } from "tailwindcss";

// Design tokens sourced directly from the Stitch "Kinetic Logic" design
// system (DESIGN.md) for RailCast. Keep this file in sync with DESIGN.md —
// it is the single source of truth for color, type, spacing and shape.
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        background: "#f9f9f9",
        "on-background": "#1a1c1c",
        surface: "#f9f9f9",
        "surface-dim": "#dadada",
        "surface-bright": "#f9f9f9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f3f4",
        "surface-container": "#eeeeee",
        "surface-container-high": "#e8e8e8",
        "surface-container-highest": "#e2e2e2",
        "surface-variant": "#e2e2e2",
        "on-surface": "#1a1c1c",
        "on-surface-variant": "#434654",
        "inverse-surface": "#2f3131",
        "inverse-on-surface": "#f0f1f1",
        outline: "#737685",
        "outline-variant": "#c3c6d6",
        "surface-tint": "#0c56d0",

        // Brand / Railway Blue
        primary: "#003d9b",
        "on-primary": "#ffffff",
        "primary-container": "#0052cc",
        "on-primary-container": "#c4d2ff",
        "inverse-primary": "#b2c5ff",
        "primary-fixed": "#dae2ff",
        "primary-fixed-dim": "#b2c5ff",
        "on-primary-fixed": "#001848",
        "on-primary-fixed-variant": "#0040a2",

        secondary: "#4c5e83",
        "on-secondary": "#ffffff",
        "secondary-container": "#bfd2fd",
        "on-secondary-container": "#475a7e",
        "secondary-fixed": "#d7e2ff",
        "secondary-fixed-dim": "#b4c7f1",
        "on-secondary-fixed": "#041b3c",
        "on-secondary-fixed-variant": "#34476a",

        tertiary: "#414446",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#595b5d",
        "on-tertiary-container": "#d2d3d5",
        "tertiary-fixed": "#e1e2e4",
        "tertiary-fixed-dim": "#c5c6c8",
        "on-tertiary-fixed": "#191c1e",
        "on-tertiary-fixed-variant": "#444749",

        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",

        // Operational status system (semantic, rigid — see DESIGN.md)
        "rail-green": "#0b8a00", // On Time
        "rail-amber": "#d68800", // Minor delay
        "rail-orange": "#c2540a", // Significant delay
        "rail-blue": "#0052cc", // Live / predictive
      },
      borderRadius: {
        DEFAULT: "0.25rem", // 4px — inputs & buttons
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem", // cards & larger containers
        xl: "0.75rem",
        full: "9999px",
      },
      spacing: {
        base: "4px",
        "container-padding": "24px",
        "element-gap": "12px",
        "sidebar-width": "240px",
        "sidebar-collapsed": "64px",
        "header-height": "56px",
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      fontSize: {
        "display-lg": [
          "32px",
          { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        "headline-md": [
          "24px",
          { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
        "headline-sm": ["18px", { lineHeight: "24px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "18px", fontWeight: "400" }],
        "label-md": [
          "12px",
          { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" },
        ],
        "data-mono": [
          "13px",
          { lineHeight: "18px", letterSpacing: "0.01em", fontWeight: "500" },
        ],
      },
      boxShadow: {
        card: "0px 2px 4px rgba(0,0,0,0.04)",
        popover: "0px 8px 16px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
