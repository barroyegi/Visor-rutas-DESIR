import { defineConfig } from "vite";

export default defineConfig({
    // Relative base so the built app works from ANY path: the domain root, a
    // subfolder (/visor/), or a deeper one, without rebuilding per location.
    // The app is a single page with no client-side router, so relative asset
    // URLs always resolve against index.html correctly.
    base: "./"
});
