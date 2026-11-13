import { Inngest } from "inngest";

/**
 * Klien Inngest. Kunci (INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY) dibaca SDK dari environment server.
 * Lokal tanpa kunci: jalankan `npx inngest-cli@latest dev` dan set INNGEST_DEV=1.
 */
export const inngest = new Inngest({ id: "supplio" });
