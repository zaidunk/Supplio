"use client";

import Link from "next/link";
import { useEffect, useRef, type ComponentProps, type RefObject } from "react";
import { Spring } from "@/components/mascot/spring";

/**
 * Efek "kenyal" ala Supplio untuk tombol: ditekan = gepeng melebar, dilepas = melenting tinggi lalu bergoyang menetap.
 * Memakai pegas yang sama dengan maskot (mascot/spring.ts) dan properti CSS `scale`, jadi tidak bentrok dengan `transform` milik tombol.
 */
export function useJelly<T extends HTMLElement>(ref: RefObject<T | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Redaman 11 pada kekakuan 300 membuat pegas memantul beberapa kali (rasa kenyal), tidak langsung diam.
    const sx = new Spring(1, 300, 11);
    const sy = new Spring(1, 300, 11);
    let raf = 0;
    let last = 0;
    let pressed = false;
    let hover = false;
    let keyTimer: ReturnType<typeof setTimeout> | undefined;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      sx.step(dt);
      sy.step(dt);
      el.style.scale = `${sx.value} ${sy.value}`;
      if (sx.settled && sy.settled) {
        el.style.scale = hover ? `${sx.target} ${sy.target}` : "";
        raf = 0;
      } else raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const rest = () => {
      const s = hover ? 1.03 : 1;
      sx.target = s;
      sy.target = s;
      kick();
    };

    const press = () => {
      pressed = true;
      sx.target = 1.1;
      sy.target = 0.84;
      kick();
    };
    const release = (jolt = true) => {
      if (!pressed) return;
      pressed = false;
      rest();
      if (jolt) {
        sx.velocity -= 2.4;
        sy.velocity += 3.4;
      }
    };

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      hover = true;
      if (!pressed) rest();
    };
    const onLeave = () => {
      hover = false;
      if (pressed) release(false);
      else rest();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat) return;
      press();
      clearTimeout(keyTimer);
      keyTimer = setTimeout(() => release(), 110);
    };
    const onUp = () => release();

    el.addEventListener("pointerdown", press);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onLeave);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(keyTimer);
      el.style.scale = "";
      el.removeEventListener("pointerdown", press);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onLeave);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("keydown", onKey);
    };
  }, [ref]);
}

/** `next/link` dengan efek kenyal saat ditekan. */
export function JellyLink(props: ComponentProps<typeof Link>) {
  const ref = useRef<HTMLAnchorElement>(null);
  useJelly(ref);
  return <Link ref={ref} {...props} />;
}
