import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base = sous-chemin GitHub Pages (https://loyalty-app1.github.io/pickelz/)
export default defineConfig({
  base: "/pickelz/",
  plugins: [react(), tailwindcss()],
});
