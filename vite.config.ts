// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // This app uses better-sqlite3 (a native Node module) for its database, which cannot run on
  // Cloudflare Workers (no filesystem/native addons there). Target a plain Node server instead
  // of the default Cloudflare preset so `npm run build` + `npm run preview` work locally.
  nitro: {
    preset: "node-server",
  },
  // Server-only native/Node packages — keep Vite's dependency scanner from ever pre-bundling
  // these for the client, regardless of which module graph path discovers them first.
  vite: {
    optimizeDeps: {
      exclude: ["better-sqlite3", "imapflow", "mailparser"],
    },
    ssr: {
      external: ["better-sqlite3", "imapflow", "mailparser"],
    },
  },
});
