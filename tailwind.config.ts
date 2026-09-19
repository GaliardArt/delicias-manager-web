import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base neutrals (warm, very slightly pink-tinted, not clinical white)
        bg: {
          DEFAULT: "#FFF9FB",
          subtle: "#FDF3F6",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#FBF3F6",
        },
        ink: {
          DEFAULT: "#2B2230", // soft dark plum-charcoal, not pure black
          muted: "#6E6470",
          faint: "#A79CAA",
        },
        line: {
          DEFAULT: "#F1E1E8",
          strong: "#E7CBD8",
        },
        // Brand: rosa (primary) + rosa bebê (secondary/accent), kept light per brief
        brand: {
          50: "#FFF3F7",
          100: "#FFE1EC", // rosa bebê
          200: "#FFC6DC",
          300: "#FCA3C5",
          400: "#F57DAA",
          500: "#EC5D91", // rosa — primary action color
          600: "#D3447A",
          700: "#AE3363",
          800: "#812448",
          900: "#4E1530",
        },
        babypink: {
          DEFAULT: "#FFE1EC",
          dark: "#FFC6DC",
        },
        success: {
          50: "#EFFAF3",
          500: "#3FA66E",
          700: "#2A7A50",
        },
        warning: {
          50: "#FDF6E7",
          500: "#DFA22F",
          700: "#96700F",
        },
        danger: {
          50: "#FDEFEF",
          500: "#DE5252",
          700: "#A33131",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(78, 21, 48, 0.04), 0 4px 16px rgba(78, 21, 48, 0.06)",
        card: "0 1px 3px rgba(78, 21, 48, 0.05)",
      },
      spacing: {
        18: "4.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
