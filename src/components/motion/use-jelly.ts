import { useEffect, type RefObject } from "react";
import { Spring } from "@/components/mascot/spring";

/**
 * Gerak "kenyal" ala Supplio untuk elemen yang bisa ditekan. Satu mesin pegas (mascot/spring.ts), beberapa watak:
 * - `jelly`  tombol utama: gepeng melebar saat ditekan, melenting tinggi lalu bergoyang menetap.
 * - `pop`    tombol sekunder: versi lebih kecil dan cepat.
 * - `soft`   tombol ghost: menciut tipis, tanpa goyang besar.
 * - `press`  aksi serius (setujui, tolak, hapus): hanya menciut sedikit dan kembali, tanpa melenting.
 * - `nav`    menu samping: tekan ringan, ikon bergoyang saat dihover.
 * - `card`   kartu tertaut: terangkat saat dihover, menciut saat ditekan.
 * - `icon`   tombol ikon: membesar saat hover, ikon bergoyang.
 * - `back`   tautan kembali: panah menyentil ke kiri saat hover.
 * Hover hanya untuk mouse; sentuhan dan keyboard (Enter) memakai efek tekan. Mati bila prefers-reduced-motion.
 */
export type JellyVariant = "jelly" | "pop" | "soft" | "press" | "nav" | "card" | "icon" | "back";

type IconMotion = { kind: "wiggle" | "pop" | "slide"; dir?: 1 | -1 };

type Preset = {
  /** Skala [lebar, tinggi] saat ditekan. */
  press: [number, number];
  /** Skala saat dihover. */
  hover: number;
  /** Dorongan kecepatan saat dilepas [lebar, tinggi]; menentukan seberapa melenting. */
  jolt: [number, number];
  stiffness: number;
  damping: number;
  icon?: IconMotion;
  /** Naik sekian px saat hover. Gerak dikenakan ke anak pertama agar area hover tidak ikut bergeser (mencegah kedap-kedip). */
  lift?: number;
};

export const JELLY_PRESETS: Record<JellyVariant, Preset> = {
  jelly: { press: [1.1, 0.84], hover: 1.03, jolt: [-2.4, 3.4], stiffness: 300, damping: 11, icon: { kind: "pop" } },
  pop: { press: [1.05, 0.92], hover: 1.02, jolt: [-1.2, 1.8], stiffness: 320, damping: 12, icon: { kind: "wiggle" } },
  soft: { press: [0.96, 0.96], hover: 1, jolt: [0.7, 0.7], stiffness: 340, damping: 14, icon: { kind: "wiggle" } },
  press: { press: [0.97, 0.97], hover: 1, jolt: [0.5, 0.5], stiffness: 380, damping: 18 },
  nav: { press: [1.03, 0.94], hover: 1, jolt: [-1, 1.4], stiffness: 320, damping: 12, icon: { kind: "wiggle" } },
  card: { press: [0.985, 0.985], hover: 1, jolt: [0.3, 0.3], stiffness: 300, damping: 14, lift: -3 },
  icon: { press: [1.12, 0.9], hover: 1.05, jolt: [-1.5, 2.2], stiffness: 320, damping: 11, icon: { kind: "wiggle" } },
  back: { press: [1.03, 0.94], hover: 1, jolt: [-1, 1.4], stiffness: 320, damping: 12, icon: { kind: "slide", dir: -1 } },
};

const isDisabled = (el: HTMLElement) =>
  el.hasAttribute("disabled") || el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";

export function useJelly<T extends HTMLElement>(ref: RefObject<T | null>, variant: JellyVariant | "none" = "jelly") {
  useEffect(() => {
    const el = ref.current;
    if (!el || variant === "none" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const p = JELLY_PRESETS[variant];
    const visual = p.lift ? ((el.firstElementChild as HTMLElement | null) ?? el) : el;
    const icon = p.icon ? el.querySelector<SVGElement>("svg") : null;

    // Elemen yang memakai `transition: all` akan menghaluskan `scale` dan meredam pantulan; batasi ke properti lain.
    if (getComputedStyle(visual).transitionProperty === "all") {
      visual.style.transitionProperty = "background-color, border-color, color, box-shadow, opacity";
    }

    const sx = new Spring(1, p.stiffness, p.damping);
    const sy = new Spring(1, p.stiffness, p.damping);
    const lift = new Spring(0, 300, 14);
    const iconRot = new Spring(0, 220, 7);
    const iconScale = new Spring(1, 300, 10);
    const iconX = new Spring(0, 260, 14);
    const springs = [sx, sy, lift, iconRot, iconScale, iconX];

    let raf = 0;
    let last = 0;
    let pressed = false;
    let hover = false;
    let keyTimer: ReturnType<typeof setTimeout> | undefined;

    const apply = () => {
      visual.style.scale = `${sx.value} ${sy.value}`;
      if (p.lift) visual.style.translate = `0px ${lift.value}px`;
      if (icon) {
        icon.style.rotate = `${iconRot.value}deg`;
        icon.style.scale = String(iconScale.value);
        icon.style.translate = `${iconX.value}px 0px`;
      }
    };
    const clear = () => {
      visual.style.scale = "";
      visual.style.translate = "";
      if (icon) {
        icon.style.rotate = "";
        icon.style.scale = "";
        icon.style.translate = "";
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const s of springs) s.step(dt);
      apply();
      if (springs.every((s) => s.settled) && !hover) {
        clear();
        raf = 0;
      } else if (springs.every((s) => s.settled)) raf = 0;
      else raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const rest = () => {
      const s = hover ? p.hover : 1;
      sx.target = s;
      sy.target = s;
      lift.target = hover ? (p.lift ?? 0) : 0;
      kick();
    };

    const bumpIcon = () => {
      if (!icon || !p.icon) return;
      const dir = p.icon.dir ?? 1;
      if (p.icon.kind === "wiggle") iconRot.velocity += 220;
      else if (p.icon.kind === "pop") iconScale.velocity += 4;
      else iconX.target = 4 * dir;
      kick();
    };
    const relaxIcon = () => {
      if (icon && p.icon?.kind === "slide") {
        iconX.target = 0;
        kick();
      }
    };

    const press = (e: PointerEvent) => {
      if (isDisabled(el)) return;
      pressed = true;
      sx.target = p.press[0];
      sy.target = p.press[1];
      if (e.pointerType !== "mouse") bumpIcon();
      kick();
    };
    const release = (jolt = true) => {
      if (!pressed) return;
      pressed = false;
      rest();
      if (jolt) {
        sx.velocity += p.jolt[0];
        sy.velocity += p.jolt[1];
      }
    };

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || isDisabled(el)) return;
      hover = true;
      if (!pressed) rest();
      bumpIcon();
    };
    const onLeave = () => {
      hover = false;
      relaxIcon();
      if (pressed) release(false);
      else rest();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || isDisabled(el)) return;
      pressed = true;
      sx.target = p.press[0];
      sy.target = p.press[1];
      bumpIcon();
      kick();
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
      clear();
      visual.style.transitionProperty = "";
      el.removeEventListener("pointerdown", press);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onLeave);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("keydown", onKey);
    };
  }, [ref, variant]);
}
