import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import {
  SOURCING_ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  TRANSITIONS,
  assertTransition,
  canTransition,
  isSourcingActive,
} from "@/lib/procurement/lifecycle";
import { buildTriggerKey } from "@/lib/procurement/trigger";

describe("lifecycle ProcurementRequest (§9)", () => {
  it("jalur normal dari DRAFT sampai COMPLETED valid", () => {
    const path = [
      "DRAFT",
      "SOURCING",
      "AWAITING_RESPONSES",
      "OPTIMIZING",
      "AWAITING_APPROVAL",
      "APPROVED",
      "ORDERED",
      "PARTIALLY_RECEIVED",
      "COMPLETED",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it("ORDERED boleh langsung COMPLETED (penerimaan penuh sekali jalan)", () => {
    expect(canTransition("ORDERED", "COMPLETED")).toBe(true);
  });

  it("tidak bisa memundurkan status (event terlambat)", () => {
    expect(canTransition("OPTIMIZING", "SOURCING")).toBe(false);
    expect(canTransition("ORDERED", "APPROVED")).toBe(false);
    expect(canTransition("COMPLETED", "ORDERED")).toBe(false);
    expect(canTransition("AWAITING_RESPONSES", "DRAFT")).toBe(false);
  });

  it("approval yang gagal validasi ulang boleh kembali ke OPTIMIZING", () => {
    expect(canTransition("AWAITING_APPROVAL", "OPTIMIZING")).toBe(true);
  });

  it("tidak ada order tanpa approval", () => {
    for (const s of Object.keys(TRANSITIONS)) {
      if (s !== "APPROVED") expect(canTransition(s as keyof typeof TRANSITIONS, "ORDERED")).toBe(false);
    }
  });

  it("status akhir tidak punya transisi keluar", () => {
    expect(new Set(TERMINAL_STATUSES)).toEqual(new Set(["COMPLETED", "NO_FEASIBLE_SOLUTION", "CANCELLED", "EXPIRED"]));
  });

  it("assertTransition melempar DomainError 409 untuk transisi terlarang", () => {
    try {
      assertTransition("COMPLETED", "DRAFT");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe("INVALID_TRANSITION");
      expect((e as DomainError).status).toBe(409);
    }
  });

  it("ORDERED dan PARTIALLY_RECEIVED tidak lagi menghitung sebagai sourcing aktif", () => {
    expect(isSourcingActive("APPROVED")).toBe(true);
    expect(isSourcingActive("ORDERED")).toBe(false);
    expect(isSourcingActive("PARTIALLY_RECEIVED")).toBe(false);
  });

  it("SOURCING_ACTIVE_STATUSES identik dengan index unik parsial di migrasi terbaru", () => {
    const dir = join(process.cwd(), "prisma", "migrations");
    const sqls = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .map((name) => readFileSync(join(dir, name, "migration.sql"), "utf8"))
      .filter((sql) => /CREATE UNIQUE INDEX "ProcurementRequest_one_active_per_business"/.test(sql));
    const latest = sqls.at(-1)!;
    const match = latest.match(/CREATE UNIQUE INDEX "ProcurementRequest_one_active_per_business"[\s\S]*?WHERE "status" IN \(([^)]*)\)/);
    const fromDb = [...match![1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect(new Set(fromDb)).toEqual(new Set(SOURCING_ACTIVE_STATUSES));
  });
});

describe("buildTriggerKey", () => {
  it("deterministik untuk peristiwa yang sama", () => {
    expect(buildTriggerKey("b1", "movement:m1")).toBe(buildTriggerKey("b1", "movement:m1"));
  });

  it("berbeda antar peristiwa dan antar bisnis", () => {
    expect(buildTriggerKey("b1", "movement:m1")).not.toBe(buildTriggerKey("b1", "movement:m2"));
    expect(buildTriggerKey("b1", "movement:m1")).not.toBe(buildTriggerKey("b2", "movement:m1"));
  });
});
