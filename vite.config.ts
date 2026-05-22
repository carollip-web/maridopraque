// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        "https://xvrjzixmoitjbvzmmkdk.supabase.co",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cmp6aXhtb2l0amJ2em1ta2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzkzOTksImV4cCI6MjA5NDM1NTM5OX0.hN3BKwPBEt0Oia3b1vZ87tcdheqkJCBsag90PYJXqHA",
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cmp6aXhtb2l0amJ2em1ta2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzkzOTksImV4cCI6MjA5NDM1NTM5OX0.hN3BKwPBEt0Oia3b1vZ87tcdheqkJCBsag90PYJXqHA",
      ),
      "process.env.SUPABASE_URL": JSON.stringify("https://xvrjzixmoitjbvzmmkdk.supabase.co"),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cmp6aXhtb2l0amJ2em1ta2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzkzOTksImV4cCI6MjA5NDM1NTM5OX0.hN3BKwPBEt0Oia3b1vZ87tcdheqkJCBsag90PYJXqHA",
      ),
    },
  },
});
