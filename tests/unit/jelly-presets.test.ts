import { describe, expect, it } from "vitest";
import { JELLY_PRESETS, type JellyVariant } from "@/components/motion/use-jelly";
import { Spring } from "@/components/mascot/spring";

const peak = (variant: JellyVariant) => {
  const p = JELLY_PRESETS[variant];
  const spring = new Spring(1, p.stiffness, p.damping);
  spring.velocity = p.jolt[1];
  let max = 1;
  for (let i = 0; i < 120; i++) {
    spring.step(1 / 60);
    max = Math.max(max, spring.value);
  }
  return max;
};

describe("preset gerak kenyal", () => {
  it("tiap preset menekan elemen (skala tekan < 1 pada minimal satu sumbu atau membesar tipis) dan wajar", () => {
    for (const [name, p] of Object.entries(JELLY_PRESETS)) {
      expect(p.stiffness, name).toBeGreaterThan(0);
      expect(p.damping, name).toBeGreaterThan(0);
      for (const s of p.press) expect(s, name).toBeGreaterThan(0.7);
      for (const s of p.press) expect(s, name).toBeLessThan(1.2);
    }
  });

  it("aksi serius (press) hampir tidak melenting, tombol utama (jelly) jelas melenting", () => {
    expect(peak("press")).toBeLessThan(1.05);
    expect(peak("jelly")).toBeGreaterThan(1.1);
  });
});
