import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No R2 incremental-cache override - every route in this app is
// force-dynamic (cookie-based auth + locale), so there's no ISR/static
// regeneration to cache. Revisit if that changes.
export default defineCloudflareConfig();
