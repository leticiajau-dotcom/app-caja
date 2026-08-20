import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        madera: {
          50: "#faf6f1",
          100: "#f0e6d8",
          200: "#e0cbaf",
          300: "#cca77d",
          400: "#b8834f",
          500: "#a06b38",
          600: "#84542d",
          700: "#6a4326",
          800: "#573822",
          900: "#4a301f",
        },
        // Paleta del rediseño mobile ("Resumen" en celular y, en menor
        // medida, el resto de las pantallas). Separada de "madera" (que
        // sigue siendo la paleta de desktop) a propósito.
        caja: {
          bg: "#f4efe4",
          card: "#ffffff",
          ink: "oklch(24% 0.03 250)",
          muted: "oklch(52% 0.03 250)",
          divider: "oklch(93% 0.01 250)",
          primary: "oklch(55% 0.135 175)",
          accent: "oklch(78% 0.14 75)",
          positive: "oklch(52% 0.15 155)",
          negative: "oklch(56% 0.18 25)",
          avatar1: "oklch(70% 0.16 35)",
          avatar2: "oklch(72% 0.14 85)",
          avatar3: "oklch(55% 0.135 175)",
        },
      },
      fontFamily: {
        manrope: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
