import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Base — deep marine navy, like the sky over open water
        void: "#0A1220",
        surface: {
          DEFAULT: "#101A2C",   // ink-raised: panels
          raised: "#101A2C",
          elevated: "#14213A",  // ink-elevated: nested cards, table cells
        },
        hairline: {
          DEFAULT: "rgba(255,255,255,.055)",
          strong: "rgba(255,255,255,.14)",
        },
        // Primary brand accent — "signal", like a plotter trace. Reserved for
        // data, active states, and the Meridian Line instrument. Never used
        // for gain/loss semantics.
        signal: {
          DEFAULT: "#7DD3FC",
          soft: "rgba(125,211,252,.12)",
          glow: "rgba(125,211,252,.45)",
        },
        // Reserved exclusively for AI Coach / insights / risk warnings.
        // Never decorative — its presence always means "pay attention".
        amber: {
          DEFAULT: "#E8A33D",
          soft: "rgba(232,163,61,.12)",
        },
        gain: {
          DEFAULT: "#34D399",
          soft: "rgba(52,211,153,.10)",
        },
        loss: {
          DEFAULT: "#F87171",
          soft: "rgba(248,113,113,.10)",
        },
        ink: {
          1: "#EAF2FB",
          2: "#93A4BD",
          3: "#5C6B84",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
