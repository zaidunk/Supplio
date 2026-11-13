import "server-only";
import { getServerEnv, requireEnv } from "@/lib/env";
import type { AgentModelFactory } from "./agent";
import { createGeminiModelFactory } from "./gemini-model";

/** Pabrik model untuk server Next.js; API key dari env, tidak pernah ke browser. */
export function getModelFactory(): AgentModelFactory {
  return createGeminiModelFactory({ apiKey: requireEnv("GEMINI_API_KEY"), model: getServerEnv().GEMINI_MODEL });
}
