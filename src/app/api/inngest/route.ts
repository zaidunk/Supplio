import { serve } from "inngest/next";
import { functions } from "@/inngest/functions";
import { inngest } from "@/inngest/client";

/** Handler Inngest (GET/POST/PUT). Dilindungi signing key Inngest, bukan sesi owner (lihat proxy.ts). */
export const { GET, POST, PUT } = serve({ client: inngest, functions });
