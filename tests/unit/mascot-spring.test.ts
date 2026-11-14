import { describe, expect, it } from "vitest";
import { Spring, clamp } from "@/components/mascot/spring";

const run = (spring: Spring, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) spring.step(1 / 60);
};

describe("Spring maskot", () => {
  it("menetap di target dan berhenti", () => {
    const spring = new Spring(0, 34, 12, 1.1);
    spring.target = 100;
    run(spring, 6);
    expect(spring.value).toBeCloseTo(100, 1);
    expect(spring.settled).toBe(true);
  });

  it("pegas kaku-redaman-rendah melampaui target dulu (efek memantul)", () => {
    const spring = new Spring(1, 260, 12);
    spring.velocity = 3;
    let peak = spring.value;
    for (let i = 0; i < 60; i++) {
      spring.step(1 / 60);
      peak = Math.max(peak, spring.value);
    }
    expect(peak).toBeGreaterThan(1.05);
  });

  it("set() melompat tanpa gerak sisa", () => {
    const spring = new Spring(0, 120, 14);
    spring.velocity = 50;
    spring.set(7);
    expect(spring.value).toBe(7);
    expect(spring.velocity).toBe(0);
    expect(spring.settled).toBe(true);
  });

  it("clamp membatasi nilai", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
