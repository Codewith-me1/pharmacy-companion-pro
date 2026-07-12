// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import process from "node:process";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // This app connects to PostgreSQL over a TCP socket (via `pg`), which cannot run on
  // Cloudflare Workers or an edge runtime. Locally, target a plain Node server so
  // `npm run build` + `npm run preview` work (outputs to .output/). On Vercel, target
  // the "vercel" preset instead — it emits Vercel's Build Output API format
  // (.vercel/output/), which Vercel's platform detects directly regardless of any
  // "Output Directory" project setting, and runs on their Node.js serverless runtime
  // (not Edge), so `pg`/`imapflow`/`mailparser` still work.
  nitro: {
    preset: process.env.VERCEL ? "vercel" : "node-server",
  },
  // Server-only native/Node packages — keep Vite's dependency scanner from ever pre-bundling
  // these for the client, regardless of which module graph path discovers them first.
  vite: {
    optimizeDeps: {
      exclude: ["pg", "imapflow", "mailparser"],
    },
    ssr: {
      external: ["pg", "imapflow", "mailparser"],
    },
  },
});
