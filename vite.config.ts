import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tendLivePlugin } from "./server/live/vite-plugin";

export default defineConfig({
  plugins: [react(), tendLivePlugin()],
  server: {
    port: 5173,
    fs: {
      deny: ["**/var/**"],
    },
  },
});
