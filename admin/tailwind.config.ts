import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#090D16",
        surface: "#0F172A",
        surfaceElevated: "#1E293B",
        surfaceHover: "#334155",
        borderDark: "#1E293B",
        adminPrimary: "#6366F1",
        adminAccent: "#8B5CF6",
        bull: "#10B981",
        bear: "#EF4444",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ['"SF Mono"', "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
