"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { PackageOpen } from "lucide-react";
import { MascotArt, type MascotMood } from "./mascot-art";
import {
  DIZZY,
  DROP,
  FALL,
  FIRST_VISIT,
  FLY,
  IDLE,
  PAT,
  PAT_MANY,
  PICKUP,
  RETURNING,
  WAKE,
  pickFresh,
} from "./mascot-lines";
import { Spring, clamp } from "./spring";

const HIDDEN_KEY = "supplio-mascot-hidden";
const SEEN_KEY = "supplio-mascot-seen";
const SAY_EVENT = "mascot:say";

/** Elemen yang tidak boleh ditutup Supplio saat memilih tempat singgah. */
const AVOID =
  'h1,h2,h3,h4,h5,h6,p,li,label,button,a,input,select,textarea,img,svg,summary,[role="button"],[data-mascot-avoid]';

export type MascotSection = {
  /** Selector CSS bagian halaman; Supplio singgah di dekatnya saat bagian itu sedang dilihat. */
  selector: string;
  /** Titik singgah ideal sebagai pecahan layar (0-1). Digeser otomatis bila menutupi konten. */
  at: { x: number; y: number };
  lines: string[];
};

/** Minta Supplio berbicara dari mana saja di aplikasi (komponen client). */
export function sayMascot(text: string, mood?: MascotMood) {
  window.dispatchEvent(new CustomEvent(SAY_EVENT, { detail: { text, mood } }));
}

const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
const bubbleMs = (text: string) => Math.round(2600 + 32 * text.length);

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, String(Date.now()));
    else localStorage.removeItem(key);
  } catch {
    /* penyimpanan diblokir: abaikan */
  }
}

function measure() {
  const vw = window.innerWidth;
  const w = vw < 640 ? 72 : 96;
  return { vw, vh: window.innerHeight, w, h: Math.round((w * 350) / 364) };
}

type Dims = ReturnType<typeof measure>;
type Box = { l: number; t: number; r: number; b: number };

function collectObstacles(dims: Dims): Box[] {
  const boxes: Box[] = [{ l: 0, t: 0, r: dims.vw, b: 84 }];
  document.querySelectorAll(AVOID).forEach((el) => {
    if (el.closest("[data-mascot]")) return;
    const r = el.getBoundingClientRect();
    if (
      r.width < 4 ||
      r.height < 4 ||
      r.bottom < 0 ||
      r.top > dims.vh ||
      r.right < 0 ||
      r.left > dims.vw ||
      r.width * r.height > dims.vw * dims.vh * 0.45
    )
      return;
    boxes.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  });
  return boxes;
}

function isFree(px: number, py: number, dims: Dims, obstacles: Box[], pad = 14) {
  const me = {
    l: px + 0.12 * dims.w - pad,
    t: py + 0.06 * dims.h - pad,
    r: px + 0.88 * dims.w + pad,
    b: py + 0.86 * dims.h + pad,
  };
  return !obstacles.some((o) => o.l < me.r && o.r > me.l && o.t < me.b && o.b > me.t);
}

/** Titik ideal; bila menutupi konten, ambil titik kosong terdekat dari sampel acak. */
function findSpot(at: { x: number; y: number }, dims: Dims) {
  const ideal = {
    x: clamp(at.x * dims.vw - dims.w / 2, 8, dims.vw - dims.w - 8),
    y: clamp(at.y * dims.vh - dims.h / 2, 88, dims.vh - dims.h - 8),
  };
  const obstacles = collectObstacles(dims);
  if (isFree(ideal.x, ideal.y, dims, obstacles)) return ideal;
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < 90; i++) {
    const x = 8 + Math.random() * Math.max(1, dims.vw - dims.w - 16);
    const y = 88 + Math.random() * Math.max(1, dims.vh - dims.h - 96);
    if (!isFree(x, y, dims, obstacles)) continue;
    const dist = Math.hypot(x - ideal.x, y - ideal.y);
    if (dist < bestDist) {
      best = { x, y };
      bestDist = dist;
    }
  }
  return best ?? ideal;
}

type Bubble = { text: string; key: number; below: boolean; right: boolean };

type Drag = {
  id: number;
  sx: number;
  sy: number;
  bx: number;
  by: number;
  moved: boolean;
  lastX: number;
  lastY: number;
  lastT: number;
  dizz: number;
  dir: { x: number; y: number };
};

type Handlers = {
  down: (e: PointerEvent<HTMLDivElement>) => void;
  move: (e: PointerEvent<HTMLDivElement>) => void;
  up: (e: PointerEvent<HTMLDivElement>) => void;
  enter: () => void;
  key: (e: KeyboardEvent<HTMLDivElement>) => void;
};

const subscribe = () => () => {};

/**
 * Supplio, maskot melayang yang bisa disapa dan diseret. Dengan `sections`, ia ikut singgah mengikuti bagian halaman:
 * terbang pelan bila berpindah ke atas atau menyamping, turun pelan bila ke bawah. Tombol × menyembunyikannya.
 */
export function MascotGuide({ sections }: { sections?: MascotSection[] }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [hidden, setHidden] = useState(() => (typeof window === "undefined" ? false : readFlag(HIDDEN_KEY)));

  if (!mounted) return null;

  if (hidden) {
    return (
      <button
        type="button"
        data-mascot
        onClick={() => {
          writeFlag(HIDDEN_KEY, false);
          setHidden(false);
        }}
        aria-label="Tampilkan Supplio"
        title="Tampilkan Supplio"
        className="fixed bottom-5 right-5 z-40 flex size-11 items-center justify-center rounded-full border border-line bg-background/90 text-blue-700 shadow-sm backdrop-blur-md transition hover:scale-105 hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <PackageOpen aria-hidden size={22} strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <MascotRunner
      sections={sections}
      onHide={() => {
        writeFlag(HIDDEN_KEY, true);
        setHidden(true);
      }}
    />
  );
}

function MascotRunner({ onHide, sections }: { onHide: () => void; sections?: MascotSection[] }) {
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const look = useRef<SVGGElement>(null);
  const handlers = useRef<Handlers | null>(null);
  const sectionsRef = useRef(sections);
  const [mood, setMoodState] = useState<MascotMood>("idle");
  const [blink, setBlink] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    const rootEl = root.current;
    const bodyEl = body.current;
    if (!rootEl || !bodyEl) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dims = measure();

    // Kekakuan/redaman pegas mengikuti rasa pemandu di agenteco.web.id (diukur dari kodenya); gerak singgah dibuat lebih lambat.
    const BASE = { x: [34, 12, 1.1], y: [48, 11, 1] } as const;
    const GLIDE = { x: [9, 8, 1.1], y: [11, 7, 1.1] } as const;
    const x = new Spring(0, ...BASE.x);
    const y = new Spring(0, ...BASE.y);
    const tilt = new Spring(0, 120, 14); // miring mengikuti kecepatan gerak
    const headTurn = new Spring(0, 70, 16); // condong ke arah kursor
    const wig = new Spring(0, 120, 7); // goyang sesaat (impuls)
    const spin = new Spring(0, 60, 12);
    const hop = new Spring(0, 180, 11);
    const sx = new Spring(1, 260, 12);
    const sy = new Spring(1, 260, 12);
    const lookX = new Spring(0, 120, 18);
    const lookY = new Spring(0, 120, 18);
    const springs = [x, y, tilt, headTurn, wig, spin, hop, sx, sy, lookX, lookY];

    const tune = (mode: "base" | "glide") => {
      const p = mode === "base" ? BASE : GLIDE;
      [x.stiffness, x.damping, x.mass] = p.x;
      [y.stiffness, y.damping, y.mass] = p.y;
    };

    let drag: Drag | null = null;
    let dragVx = 0;
    let dragVy = 0;
    let raf = 0;
    let last = 0;
    let moodNow: MascotMood = "idle";
    let moodTimer: ReturnType<typeof setTimeout> | undefined;
    let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
    let bubbleKey = 0;
    let lastBubbleAt = 0;
    let lastActivity = Date.now();
    let lastDragAt = 0;
    let pats = { count: 0, at: 0 };
    let travel: { x: number; y: number; since: number; lines: string[] } | null = null;
    let activeSection = -1;
    let followTimer: ReturnType<typeof setTimeout> | undefined;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    };

    const bounds = () => ({
      minX: 0,
      maxX: Math.max(0, dims.vw - dims.w),
      minY: 8,
      maxY: Math.max(8, dims.vh - dims.h - 8),
    });

    const apply = () => {
      rootEl.style.transform = `translate3d(${x.value}px, ${y.value}px, 0)`;
      const rotate = tilt.value + headTurn.value + wig.value + spin.value;
      bodyEl.style.transform = `translateY(${hop.value}px) rotate(${rotate}deg) scale(${sx.value}, ${sy.value})`;
      look.current?.setAttribute("transform", `translate(${lookX.value} ${lookY.value})`);
    };

    const active = () => Boolean(drag?.moved) || springs.some((s) => !s.settled);

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dragged = Boolean(drag?.moved);
      if (dragged) {
        const decay = Math.max(0, 1 - dt * 8);
        dragVx *= decay;
        dragVy *= decay;
      }
      const vx = dragged ? dragVx : x.velocity;
      tilt.target = clamp(vx / 70, -22, 22);
      for (const s of springs) s.step(dt);
      if (spin.target === 360 && spin.settled) spin.set(0);
      if (
        travel &&
        ((Math.abs(x.value - travel.x) < 10 &&
          Math.abs(y.value - travel.y) < 10 &&
          Math.abs(x.velocity) < 25 &&
          Math.abs(y.velocity) < 25) ||
          performance.now() - travel.since > 5000)
      )
        arrive();
      apply();
      raf = active() ? requestAnimationFrame(tick) : 0;
    };

    const kick = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const go = (s: Spring, target: number) => {
      if (reduce) s.set(target);
      else s.target = target;
      kick();
    };

    const impulse = (s: Spring, v: number) => {
      if (reduce) return;
      s.velocity += v;
      kick();
    };

    const setMood = (next: MascotMood, ms?: number) => {
      clearTimeout(moodTimer);
      moodNow = next;
      setMoodState(next);
      if (next === "sleep" || next === "dizzy" || next === "flying" || next === "falling") {
        go(lookX, 0);
        go(lookY, 0);
      }
      if (ms) {
        moodTimer = setTimeout(() => {
          const rest: MascotMood = drag?.moved ? "surprised" : "idle";
          moodNow = rest;
          setMoodState(rest);
        }, ms);
      }
    };

    const say = (text: string, ms = bubbleMs(text)) => {
      clearTimeout(bubbleTimer);
      lastBubbleAt = Date.now();
      bubbleKey += 1;
      setBubble({
        text,
        key: bubbleKey,
        below: y.value < 150,
        right: x.value + dims.w / 2 > dims.vw / 2,
      });
      bubbleTimer = setTimeout(() => setBubble(null), ms);
    };

    const hush = () => {
      clearTimeout(bubbleTimer);
      setBubble(null);
    };

    const motion = {
      hop: () => {
        impulse(hop, -420);
        impulse(sy, 2);
        impulse(sx, -1.5);
      },
      squash: () => {
        impulse(sy, -2.6);
        impulse(sx, 2.2);
      },
      wiggle: (power = 140) => impulse(wig, power),
      spin: () => {
        if (reduce) return;
        spin.target = 360;
        impulse(hop, -300);
        kick();
      },
    };

    const wake = () => {
      if (moodNow !== "sleep") return;
      setMood("surprised", 900);
      motion.hop();
      say(pickFresh("wake", WAKE));
    };

    const greet = () => {
      lastActivity = Date.now();
      if (moodNow === "sleep") return wake();
      const now = Date.now();
      pats = { count: now - pats.at < 4000 ? pats.count + 1 : 1, at: now };
      const next: MascotMood = pats.count === 1 ? "happy" : pats.count === 2 ? "wink" : "love";
      setMood(next, 1800);
      say(pickFresh(pats.count >= 5 ? "pat-many" : "pat", pats.count >= 5 ? PAT_MANY : PAT), 2400);
      motion.squash();
      motion.hop();
      if (pats.count === 5) motion.spin();
    };

    const shiftTo = (nx: number, ny: number) => {
      const b = bounds();
      go(x, clamp(nx, b.minX, b.maxX));
      go(y, clamp(ny, b.minY, b.maxY));
    };

    // Singgah mengikuti bagian halaman -----------------------------------------------------------

    const arrive = () => {
      const t = travel;
      if (!t) return;
      travel = null;
      tune("base");
      if (moodNow === "flying" || moodNow === "falling") {
        const fell = moodNow === "falling";
        setMood("idle");
        if (fell) motion.squash();
        else motion.hop();
      }
      if (moodNow !== "sleep" && Date.now() - lastBubbleAt > 4000) say(pickFresh(`section-${t.lines[0]}`, t.lines));
    };

    const cancelTravel = () => {
      if (!travel) return;
      travel = null;
      tune("base");
    };

    const follow = (index: number) => {
      const section = sectionsRef.current?.[index];
      if (!section || drag || moodNow === "sleep" || moodNow === "dizzy") return;
      if (Date.now() - lastDragAt < 15_000) return;
      const spot = findSpot(section.at, dims);
      const dx = spot.x - x.value;
      const dy = spot.y - y.value;
      if (Math.hypot(dx, dy) < 40) return;
      if (reduce) {
        shiftTo(spot.x, spot.y);
        if (Date.now() - lastBubbleAt > 4000) say(pickFresh(`section-${section.lines[0]}`, section.lines));
        return;
      }
      travel = { x: spot.x, y: spot.y, since: performance.now(), lines: section.lines };
      tune("glide");
      const falling = dy > 140;
      setMood(falling ? "falling" : "flying");
      if (Date.now() - lastBubbleAt > 4000) say(pickFresh(falling ? "fall" : "fly", falling ? FALL : FLY), 2200);
      shiftTo(spot.x, spot.y);
    };

    const currentSection = () => {
      const list = sectionsRef.current ?? [];
      const probe = dims.vh * 0.45;
      let found = -1;
      list.forEach((s, i) => {
        const el = document.querySelector(s.selector);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) found = i;
      });
      return found;
    };

    let scrollFrame = 0;
    const onScroll = () => {
      if (scrollFrame || !sectionsRef.current?.length) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const index = currentSection();
        if (index < 0 || index === activeSection) return;
        activeSection = index;
        clearTimeout(followTimer);
        followTimer = setTimeout(() => follow(index), 650);
      });
    };

    // Awal: ukur, taruh di pojok kanan bawah, lalu meluncur masuk dari bawah layar.
    rootEl.style.width = `${dims.w}px`;
    rootEl.style.height = `${dims.h}px`;
    const start = { x: dims.vw - dims.w - 24, y: dims.vh - dims.h - 24 };
    x.set(start.x);
    y.set(reduce ? start.y : dims.vh + 40);
    y.target = start.y;
    apply();
    rootEl.style.opacity = "1";
    activeSection = currentSection();
    kick();

    const onResize = () => {
      dims = measure();
      rootEl.style.width = `${dims.w}px`;
      rootEl.style.height = `${dims.h}px`;
      shiftTo(x.target, y.target);
    };

    const onWindowMove = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== "mouse" || ["sleep", "dizzy", "flying", "falling"].includes(moodNow)) return;
      const dx = e.clientX - (x.value + dims.w / 2);
      const dy = e.clientY - (y.value + dims.h * 0.5);
      go(lookX, 8 * clamp(dx / 260, -1, 1));
      go(lookY, 5 * clamp(dy / 260, -1, 1));
      go(headTurn, 5 * clamp(dx / 600, -1, 1));
      lastActivity = Date.now();
    };

    const onSay = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string; mood?: MascotMood }>).detail;
      if (!detail?.text || drag?.moved) return;
      setMood(detail.mood ?? "happy", 2000);
      say(detail.text);
    };

    handlers.current = {
      down: (e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag = {
          id: e.pointerId,
          sx: e.clientX,
          sy: e.clientY,
          bx: x.value,
          by: y.value,
          moved: false,
          lastX: e.clientX,
          lastY: e.clientY,
          lastT: performance.now(),
          dizz: 0,
          dir: { x: 0, y: 0 },
        };
      },
      move: (e) => {
        const d = drag;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.sx;
        const dy = e.clientY - d.sy;
        if (!d.moved) {
          if (Math.hypot(dx, dy) <= 6) return;
          d.moved = true;
          cancelTravel();
          clearTimeout(followTimer);
          setDragging(true);
          setMood("surprised");
          if (Math.random() < 0.5) say(pickFresh("pickup", PICKUP), 1800);
          else hush();
          go(sx, 0.94);
          go(sy, 1.08);
        }
        const b = bounds();
        const now = performance.now();
        const dt = Math.max(1, now - d.lastT) / 1000;
        dragVx = 0.6 * dragVx + 0.4 * ((e.clientX - d.lastX) / dt);
        dragVy = 0.6 * dragVy + 0.4 * ((e.clientY - d.lastY) / dt);
        x.set(clamp(d.bx + dx, b.minX - 20, b.maxX + 20));
        y.set(clamp(d.by + dy, b.minY, b.maxY));

        // Digoyang bolak-balik: tiap pembalikan arah menaikkan "pusing", yang turun lagi seiring waktu.
        d.dizz = Math.max(0, d.dizz - (now - d.lastT) / 450);
        for (const axis of ["x", "y"] as const) {
          const delta = axis === "x" ? e.clientX - d.lastX : e.clientY - d.lastY;
          if (Math.abs(delta) > 3) {
            const sign = Math.sign(delta);
            if (d.dir[axis] && sign !== d.dir[axis]) d.dizz += 1;
            d.dir[axis] = sign;
          }
        }
        d.lastX = e.clientX;
        d.lastY = e.clientY;
        d.lastT = now;
        if (d.dizz >= 3.5) {
          d.dizz = 2.5;
          if (moodNow !== "dizzy") {
            setMood("dizzy", 2200);
            say(pickFresh("dizzy", DIZZY), 2200);
            motion.wiggle(260);
          }
        }
        kick();
      },
      up: (e) => {
        const d = drag;
        if (!d || d.id !== e.pointerId) return;
        drag = null;
        if (!d.moved) {
          greet();
          return;
        }
        setDragging(false);
        lastDragAt = Date.now();
        go(sx, 1);
        go(sy, 1);
        // Lepas dengan sedikit lemparan; pegas menenangkannya di dalam layar.
        const throwX = clamp(dragVx, -1200, 1200);
        const throwY = clamp(dragVy, -1200, 1200);
        x.velocity = reduce ? 0 : throwX;
        y.velocity = reduce ? 0 : throwY;
        shiftTo(x.value + throwX * 0.08, y.value + throwY * 0.08);
        motion.squash();
        if (moodNow !== "dizzy") {
          setMood("happy", 900);
          if (Math.random() < 0.4) say(pickFresh("drop", DROP), 1800);
        }
        lastActivity = Date.now();
      },
      enter: () => {
        lastActivity = Date.now();
        if (moodNow === "sleep") wake();
      },
      key: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          greet();
        }
      },
    };

    // Berkedip acak.
    const blinkLoop = () =>
      later(() => {
        if (!reduce && moodNow !== "sleep") {
          setBlink(true);
          later(() => setBlink(false), 110);
        }
        blinkLoop();
      }, 2200 + Math.random() * 3400);
    if (!reduce) blinkLoop();

    // Kebiasaan iseng saat diam: loncat kecil, goyang, melirik, atau bergumam. Lalu mengantuk bila lama tak disentuh.
    const idleLoop = () =>
      later(() => {
        const quiet = moodNow === "idle" && !drag && !travel && Date.now() - lastBubbleAt > 7000;
        if (quiet && !reduce) {
          const action = pick(["hop", "tilt", "wiggle", "glance", "chat"] as const);
          if (action === "hop") motion.hop();
          else if (action === "tilt") motion.wiggle(-110);
          else if (action === "wiggle") motion.wiggle(170);
          else {
            setMood("curious", 1800);
            if (action === "chat" || Math.random() < 0.4) say(pickFresh("idle", IDLE), 2800);
          }
        }
        idleLoop();
      }, 9000 + 7000 * Math.random());
    idleLoop();

    const sleepWatch = setInterval(() => {
      if (moodNow === "idle" && !drag && !travel && Date.now() - lastActivity > 40_000) {
        hush();
        setMood("sleep");
        go(sy, 0.96);
        later(() => go(sy, 1), 400);
      }
    }, 3000);

    // Sapaan pertama / kembali.
    later(
      () => {
        if (drag?.moved) return;
        const first = !readFlag(SEEN_KEY);
        writeFlag(SEEN_KEY, true);
        setMood("happy", 2200);
        say(first ? pickFresh("first", FIRST_VISIT) : pickFresh("returning", RETURNING));
        motion.hop();
      },
      reduce ? 400 : 1400,
    );

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onWindowMove, { passive: true });
    window.addEventListener(SAY_EVENT, onSay);

    return () => {
      handlers.current = null;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scrollFrame);
      clearInterval(sleepWatch);
      clearTimeout(moodTimer);
      clearTimeout(bubbleTimer);
      clearTimeout(followTimer);
      for (const id of timers) clearTimeout(id);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener(SAY_EVENT, onSay);
    };
  }, []);

  return (
    <div
      ref={root}
      data-mascot
      className="pointer-events-none fixed left-0 top-0 z-40 select-none"
      style={{ opacity: 0 }}
    >
      {bubble && (
        <div
          key={bubble.key}
          className={`absolute z-10 flex flex-col ${bubble.right ? "right-0 items-end" : "left-0 items-start"} ${
            bubble.below ? "top-full -mt-1" : "bottom-[calc(100%-6px)]"
          }`}
          style={{ width: "max-content", maxWidth: 220 }}
        >
          <div className="relative rounded-2xl border border-line bg-background px-3.5 py-2.5 text-[13px] font-medium leading-snug text-foreground shadow-lg">
            {bubble.text}
            <span
              aria-hidden
              className={`absolute h-[9px] w-[9px] rotate-45 border-line bg-background ${
                bubble.below ? "-top-[5px] border-l border-t" : "-bottom-[5px] border-b border-r"
              } ${bubble.right ? "right-8" : "left-8"}`}
            />
          </div>
        </div>
      )}
      <div
        ref={body}
        role="button"
        tabIndex={0}
        aria-label="Supplio, maskot Supplio. Klik untuk menyapa, seret untuk memindahkan."
        onPointerDown={(e) => handlers.current?.down(e)}
        onPointerMove={(e) => handlers.current?.move(e)}
        onPointerUp={(e) => handlers.current?.up(e)}
        onPointerCancel={(e) => handlers.current?.up(e)}
        onPointerEnter={(e) => e.pointerType === "mouse" && handlers.current?.enter()}
        onKeyDown={(e) => handlers.current?.key(e)}
        className={`pointer-events-auto relative h-full w-full touch-none rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          transformOrigin: "50% 85%",
          filter: `drop-shadow(0 8px 12px rgba(5, 49, 130, ${mood === "sleep" ? 0.12 : 0.22}))`,
        }}
      >
        <MascotArt mood={mood} blink={blink} lookRef={look} className="block h-full w-full overflow-visible" />
      </div>
      <button
        type="button"
        onClick={onHide}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Sembunyikan Supplio"
        title="Sembunyikan Supplio"
        className="pointer-events-auto absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-line bg-background text-[11px] leading-none text-muted-foreground opacity-60 transition hover:opacity-100 focus-visible:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
