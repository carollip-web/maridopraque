import { defineConfig } from "@lovable.dev/vite-tanstack-config";

try {
  const config = defineConfig();
  console.log("Config loaded successfully:", JSON.stringify(config, null, 2));
} catch (err) {
  console.error("Error loading config:", err);
}
