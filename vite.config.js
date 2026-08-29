import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: base must match your GitHub repo name for GitHub Pages to load
// assets correctly, e.g. if your repo is github.com/you/wedding-photos,
// this should be "/wedding-photos/".
export default defineConfig({
  plugins: [react()],
  base: "/photo_uploader/",
});
