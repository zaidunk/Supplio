import { AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { AgentModelFactory, AgentRunnable } from "@/lib/ai/agent";

export interface Call {
  name: string;
  args: Record<string, unknown>;
}

/** Satu langkah model: daftar pemanggilan tool, atau "THROW" untuk mensimulasikan galat model/jaringan. */
export type Step = Call[] | "THROW";

/**
 * Model palsu terskrip (SUPPLIO.md §7: OpenAI/Gemini di-mock di CI). Mengembalikan pemanggilan tool sesuai skrip,
 * sehingga tes dapat mensimulasikan model yang patuh MAUPUN model yang "terhasut" (menuruti suntikan prompt, membocorkan
 * budget, memanggil tool terlarang), lalu memeriksa bahwa KODE tetap menegakkan aturan.
 */
export class ScriptedModel implements AgentRunnable {
  invocations = 0;
  transcripts: BaseMessage[][] = [];

  constructor(private readonly steps: Step[]) {}

  async invoke(messages: BaseMessage[]): Promise<AIMessage> {
    this.transcripts.push([...messages]);
    const step = this.steps[this.invocations++] ?? [];
    if (step === "THROW") throw new Error("galat model palsu");
    return new AIMessage({
      content: step.length === 0 ? "selesai" : "",
      tool_calls: step.map((c, i) => ({ id: `call-${this.invocations}-${i}`, name: c.name, args: c.args, type: "tool_call" as const })),
    });
  }

  /** Semua hasil tool yang diterima model (dari transkrip terakhir). */
  toolResults(): { name: string; content: string }[] {
    const last = this.transcripts.at(-1) ?? [];
    return last
      .filter((m): m is ToolMessage => m instanceof ToolMessage)
      .map((m) => ({ name: m.name ?? "", content: String(m.content) }));
  }

  /** Pesan sistem dan pesan manusia pertama yang dilihat model. */
  firstPrompt(): { system: string; human: string } {
    const first = this.transcripts[0] ?? [];
    return { system: String(first[0]?.content ?? ""), human: String(first[1]?.content ?? "") };
  }
}

export const factoryOf =
  (model: ScriptedModel): AgentModelFactory =>
  () =>
    model;
