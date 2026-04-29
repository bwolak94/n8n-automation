import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0e9ff",
          500: "#4f6ef7",
          600: "#3d5ae4",
          700: "#2d46cb",
          900: "#1a2d8f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
