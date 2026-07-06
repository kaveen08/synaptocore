import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [react()],
  trailingSlash: "always",
  build: {
    format: "directory"
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
