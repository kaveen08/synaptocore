import { defineConfig } from "astro/config";

// GitHub Pages project site: https://kaveen08.github.io/synaptocore/
export default defineConfig({
  site: "https://kaveen08.github.io",
  base: "/synaptocore",
  trailingSlash: "always",
  build: {
    format: "directory"
  }
});
