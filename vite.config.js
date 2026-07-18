import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base = sous-chemin GitHub Pages (https://gassouma12.github.io/Thefirst/)
export default defineConfig({
  base: "/Thefirst/",
  plugins: [react(), tailwindcss()],
});
