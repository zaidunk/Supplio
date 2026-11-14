import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { describe, expect, it } from "vitest";
import { runModelLoop, type AgentRunnable, type ModelStepLog } from "@/lib/ai/agent";
import { classifyLlmError } from "@/lib/ai/rate-limit";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Model palsu yang butuh `delayMs` per panggilan dan selalu meminta tool yang tidak ada (loop berlanjut). */
const slowModel = (delayMs: number): AgentRunnable & { calls: number } => ({
  calls: 0,
  async invoke() {
    this.calls++;
    await sleep(delayMs);
    return new AIMessage({ content: "", tool_calls: [{ id: `c${this.calls}`, name: "tidakAda", args: {}, type: "tool_call" }] });
  },
});

const run = (model: AgentRunnable, options: Parameters<typeof runModelLoop>[3]) =>
  runModelLoop(() => model, [] as StructuredToolInterface[], [new HumanMessage("halo")], options);

describe("runModelLoop: batas waktu total giliran", () => {
  it("berhenti dengan galat yang dikenali sebagai galat sementara saat anggaran total habis", async () => {
    const model = slowModel(40);
    const logs: ModelStepLog[] = [];

    const error = await run(model, { budgetMs: 100, callTimeoutMs: 1_000, onStep: (l) => logs.push(l) }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(model.calls).toBeLessThan(6); // tidak sampai MAX_MODEL_STEPS
    expect(classifyLlmError(error)?.reason).toBe("UNAVAILABLE"); // → RetryAfterError, bukan fungsi dibunuh platform
  });

  it("memotong satu panggilan yang menggantung sesuai sisa anggaran, bukan batas per panggilan", async () => {
    const hanging: AgentRunnable = { invoke: () => new Promise(() => {}) };
    const logs: ModelStepLog[] = [];
    const startedAt = Date.now();

    const error = await run(hanging, { budgetMs: 80, callTimeoutMs: 10_000, onStep: (l) => logs.push(l) }).catch((e: unknown) => e);

    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(classifyLlmError(error)?.reason).toBe("UNAVAILABLE");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ step: 1, outcome: "error" });
  });

  it("mencatat durasi dan jumlah tool call per langkah tanpa memuat isi prompt", async () => {
    const model: AgentRunnable = { invoke: async () => new AIMessage({ content: "selesai" }) };
    const logs: ModelStepLog[] = [];

    await run(model, { onStep: (l) => logs.push(l) });

    expect(logs).toEqual([{ step: 1, durationMs: expect.any(Number), outcome: "ok", toolCalls: 0 }]);
    expect(JSON.stringify(logs)).not.toContain("halo");
  });
});
