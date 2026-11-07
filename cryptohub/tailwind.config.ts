import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
      },
      colors: {
        background: "#0b0e14",
        card: "#121722",
        "card-hover": "#171e2c",
        border: "#1e293b",
        "crypto-green": "#10b981",
        "crypto-green-glow": "rgba(16, 185, 129, 0.15)",
        "crypto-red": "#f43f5e",
        "crypto-red-glow": "rgba(244, 63, 94, 0.15)",
        "accent-blue": "#38bdf8",
        "accent-purple": "#a855f7",
        "accent-amber": "#f59e0b",
      },
      animation: {
        "pulse-fast": "pulse-fast 1.2s ease-in-out infinite",
        "fade-in": "fade-in 0.25s ease-out forwards",
        "slide-up": "slide-up 0.3s ease-out forwards",
        "ticker": "ticker-scroll 30s linear infinite",
        "shimmer": "shimmer 2.5s infinite",
        "number-pop": "number-pop 0.3s ease-out",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-fast": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "ticker-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "number-pop": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
      },
    },
  },
  plugins: [],
};
export default config;
