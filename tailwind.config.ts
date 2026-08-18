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
      },
    },
  },
  plugins: [],
};

export default config;
