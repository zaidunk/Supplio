import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { AgentModelFactory, AgentRunnable } from "./agent";

/**
 * Pabrik model Gemini via LangChain.js (SUPPLIO.md §7, disesuaikan: Gemini menggantikan OpenAI atas keputusan pemilik).
 * Suhu rendah: tugasnya ekstraksi dan kesopanan, bukan kreativitas. Tool di-bind per giliran.
 */
export function createGeminiModelFactory(options: { apiKey: string; model: string; temperature?: number }): AgentModelFactory {
  return (tools) =>
    new ChatGoogleGenerativeAI({
      model: options.model,
      apiKey: options.apiKey,
      temperature: options.temperature ?? 0.2,
      maxRetries: 2,
    }).bindTools(tools) as unknown as AgentRunnable;
}
