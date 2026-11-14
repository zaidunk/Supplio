import type { Ref, SVGProps } from "react";
import { BODY_OVER, BODY_UNDER, type BodyPath } from "./mascot-body";
import "./mascot.css";

export type MascotMood =
  | "idle"
  | "happy"
  | "wink"
  | "curious"
  | "excited"
  | "sad"
  | "determined"
  | "sleep"
  | "surprised"
  | "love"
  | "dizzy"
  | "flying"
  | "falling";

const NAVY = "#073383";
const PINK = "#FE7EAD";
const TEAR = "#7CC0FF";

const HEART = "M0 14 C-20 2 -22 -10 -13 -16 C-7 -20 0 -16 0 -9 C0 -16 7 -20 13 -16 C22 -10 20 2 0 14 Z";
const STAR = "M0 -20 L5 -5 L20 0 L5 5 L0 20 L-5 5 L-20 0 L-5 -5 Z";
const SPIRAL = "M0 0 a3 3 0 0 1 6 0 a7 7 0 0 1 -14 0 a11 11 0 0 1 22 0 a15 15 0 0 1 -30 0";

/** Sumbu mata kiri dan kanan ada di y=0 pada bingkai wajah yang sudah dimiringkan sesuai bidang depan kotak. */
const EYE_X = 54;

const stroke = { stroke: NAVY, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

function Body({ paths }: { paths: BodyPath[] }) {
  return (
    <>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill}
          stroke={p.stroke}
          fillRule={p.evenodd ? "evenodd" : undefined}
          clipRule={p.evenodd ? "evenodd" : undefined}
        />
      ))}
    </>
  );
}

function OvalEye({ x, ry = 24, blink }: { x: number; ry?: number; blink: boolean }) {
  return (
    <g
      style={{
        transformBox: "fill-box",
        transformOrigin: "center",
        transform: blink ? "scaleY(0.1)" : "scaleY(1)",
        transition: "transform 90ms",
      }}
    >
      <ellipse cx={x} cy={0} rx={20} ry={ry} fill={NAVY} />
      <ellipse cx={x + 6} cy={-ry * 0.35} rx={5.5} ry={7} fill="#fff" />
    </g>
  );
}

const arcEye = (x: number, sleepy = false) =>
  sleepy ? `M${x - 19} -2 Q${x} 16 ${x + 19} -2` : `M${x - 19} 8 Q${x} -18 ${x + 19} 8`;

function OpenMouth({ wide = false, tongue = true, y = 36 }: { wide?: boolean; tongue?: boolean; y?: number }) {
  const w = wide ? 30 : 24;
  const h = wide ? 32 : 26;
  return (
    <g transform={`translate(-3 ${y})`}>
      <path d={`M${-w} -6 Q0 4 ${w} -6 Q${w - 4} ${h} 0 ${h} Q${-w + 4} ${h} ${-w} -6 Z`} fill={NAVY} />
      {tongue && <path d={`M-11 ${h - 5} Q0 ${h - 16} 11 ${h - 5} Q0 ${h + 2} -11 ${h - 5} Z`} fill={PINK} />}
    </g>
  );
}

function Brows({ left, right, width = 8 }: { left: string; right: string; width?: number }) {
  return (
    <>
      <path d={left} {...stroke} strokeWidth={width} />
      <path d={right} {...stroke} strokeWidth={width} />
    </>
  );
}

const BROWS_IDLE = { left: `M-82 -40 Q-66 -54 -48 -44`, right: `M48 -46 Q66 -58 84 -48` };
const BROWS_UP = { left: `M-82 -50 Q-66 -66 -48 -54`, right: `M48 -54 Q66 -68 84 -56` };

function Face({ mood, blink }: { mood: MascotMood; blink: boolean }) {
  switch (mood) {
    case "happy":
      return (
        <>
          <Brows {...BROWS_UP} />
          <path d={arcEye(-EYE_X)} {...stroke} strokeWidth={9} />
          <path d={arcEye(EYE_X)} {...stroke} strokeWidth={9} />
          <OpenMouth wide />
        </>
      );
    case "wink":
      return (
        <>
          <Brows {...BROWS_IDLE} />
          <path d={arcEye(-EYE_X)} {...stroke} strokeWidth={9} />
          <OvalEye x={EYE_X} blink={false} />
          <OpenMouth />
        </>
      );
    case "curious":
      return (
        <>
          <Brows left={`M-82 -38 Q-66 -50 -48 -42`} right={`M48 -56 Q66 -72 84 -58`} />
          <OvalEye x={-EYE_X} blink={blink} />
          <OvalEye x={EYE_X} blink={blink} />
          <path d="M-9 30 C7 30 7 42 -3 42 C7 42 7 54 -9 54" {...stroke} strokeWidth={5} />
        </>
      );
    case "excited":
      return (
        <>
          <Brows {...BROWS_UP} />
          {[-EYE_X, EYE_X].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy={0} rx={22} ry={25} fill={NAVY} />
              <path d={STAR} transform={`translate(${x} 0) scale(0.8)`} fill="#fff" />
            </g>
          ))}
          <OpenMouth wide />
        </>
      );
    case "sad":
      return (
        <>
          <Brows left={`M-84 -34 Q-66 -40 -46 -54`} right={`M46 -54 Q66 -40 86 -34`} />
          {[-EYE_X, EYE_X].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy={2} rx={20} ry={23} fill={NAVY} />
              <ellipse cx={x + 5} cy={-6} rx={5} ry={7} fill="#fff" />
              <ellipse cx={x} cy={14} rx={14} ry={7} fill={TEAR} />
            </g>
          ))}
          <path d="M-22 56 Q-3 36 16 56" {...stroke} strokeWidth={6} />
        </>
      );
    case "determined":
      return (
        <>
          <Brows left={`M-86 -50 L-40 -32`} right={`M42 -32 L88 -52`} width={10} />
          <OvalEye x={-EYE_X} ry={17} blink={blink} />
          <OvalEye x={EYE_X} ry={17} blink={blink} />
          <path d="M-26 40 Q-2 52 26 36" {...stroke} strokeWidth={5} />
        </>
      );
    case "sleep":
      return (
        <>
          <path d={arcEye(-EYE_X, true)} {...stroke} strokeWidth={7} />
          <path d={arcEye(EYE_X, true)} {...stroke} strokeWidth={7} />
          <path d="M-16 42 Q-3 54 10 42" {...stroke} strokeWidth={5} />
        </>
      );
    case "surprised":
      return (
        <>
          <Brows {...BROWS_UP} />
          {[-EYE_X, EYE_X].map((x) => (
            <g key={x}>
              <circle cx={x} cy={0} r={24} fill="#fff" stroke={NAVY} strokeWidth={5} />
              <circle cx={x} cy={0} r={6} fill={NAVY} />
            </g>
          ))}
          <g transform="translate(-3 52)">
            <ellipse rx={13} ry={17} fill={NAVY} />
            <ellipse cy={8} rx={8} ry={6} fill={PINK} />
          </g>
        </>
      );
    case "love":
      return (
        <>
          <Brows {...BROWS_UP} />
          <path d={HEART} transform={`translate(${-EYE_X} 2) scale(1.45)`} fill={NAVY} />
          <path d={HEART} transform={`translate(${EYE_X} 2) scale(1.45)`} fill={NAVY} />
          <ellipse cx={-76} cy={40} rx={16} ry={9} fill={PINK} opacity={0.5} />
          <ellipse cx={76} cy={40} rx={16} ry={9} fill={PINK} opacity={0.5} />
          <OpenMouth tongue={false} y={34} />
        </>
      );
    case "flying":
      return (
        <>
          <Brows {...BROWS_UP} />
          <path d={arcEye(-EYE_X)} {...stroke} strokeWidth={9} />
          <path d={arcEye(EYE_X)} {...stroke} strokeWidth={9} />
          <OpenMouth tongue={false} />
        </>
      );
    case "falling":
      return (
        <>
          <Brows {...BROWS_UP} />
          {[-EYE_X, EYE_X].map((x) => (
            <g key={x}>
              <circle cx={x} cy={0} r={22} fill="#fff" stroke={NAVY} strokeWidth={5} />
              <circle cx={x} cy={-6} r={6} fill={NAVY} />
            </g>
          ))}
          <g transform="translate(-3 50)">
            <ellipse rx={9} ry={12} fill={NAVY} />
            <ellipse cy={6} rx={5} ry={4} fill={PINK} />
          </g>
        </>
      );
    case "dizzy":
      return (
        <>
          {[-EYE_X, EYE_X].map((x) => (
            <g key={x} transform={`translate(${x} 0) scale(1.1)`}>
              <path d={SPIRAL} className="mascot-spin" {...stroke} strokeWidth={4} />
            </g>
          ))}
          <path d="M-26 48 q6 -8 12 0 t12 0 t12 0" {...stroke} strokeWidth={5} />
        </>
      );
    default:
      return (
        <>
          <Brows {...BROWS_IDLE} />
          <OvalEye x={-EYE_X} blink={blink} />
          <OvalEye x={EYE_X} blink={blink} />
          <OpenMouth tongue={false} />
        </>
      );
  }
}

/** Efek di luar badan: tanda tanya, z, hati, garis semangat, keringat. Koordinat badan (364×350). */
function Effects({ mood }: { mood: MascotMood }) {
  switch (mood) {
    case "curious":
      return (
        <text
          x={338}
          y={26}
          fontSize={64}
          fontWeight={800}
          fill={NAVY}
          textAnchor="middle"
          className="mascot-bob"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          ?
        </text>
      );
    case "sleep":
      return (
        <g fill={NAVY} style={{ fontFamily: "system-ui, sans-serif", fontWeight: 800 }}>
          {[0, 0.6, 1.2].map((delay, i) => (
            <text
              key={i}
              x={290 + i * 22}
              y={46 - i * 8}
              fontSize={30 + i * 8}
              className="mascot-fx"
              style={{ animationDelay: `${delay}s` }}
            >
              z
            </text>
          ))}
        </g>
      );
    case "love":
      return (
        <>
          <path d={HEART} transform="translate(28 40) scale(1.2)" fill={PINK} className="mascot-fx" />
          <path d={HEART} transform="translate(338 20) scale(1.3)" fill={NAVY} className="mascot-fx" style={{ animationDelay: "0.5s" }} />
          <path d={HEART} transform="translate(352 110) scale(0.8)" fill={PINK} className="mascot-fx" style={{ animationDelay: "1s" }} />
        </>
      );
    case "determined":
      return (
        <g {...stroke} strokeWidth={6}>
          {[
            "M20 36 L42 58",
            "M54 10 L66 36",
            "M92 2 L92 28",
            "M340 8 L328 34",
            "M366 40 L342 56",
            "M300 -4 L304 22",
          ].map((d) => (
            <path key={d} d={d} className="mascot-pop" />
          ))}
        </g>
      );
    case "sad":
      return (
        <path
          d="M52 168 C64 188 70 198 52 214 C34 198 40 188 52 168 Z"
          fill="#fff"
          stroke="#9CC4FF"
          strokeWidth={3}
          className="mascot-pop"
        />
      );
    case "excited":
      return (
        <g {...stroke} stroke={NAVY} strokeWidth={5}>
          <path d="M36 300 Q50 320 36 340" className="mascot-pop" />
          <path d="M330 330 Q344 316 360 322" className="mascot-pop" />
        </g>
      );
    case "flying":
      return (
        <>
          <g {...stroke} strokeWidth={6} opacity={0.35}>
            {["M-46 120 H-12", "M-58 176 H-18", "M-40 232 H-8"].map((d, i) => (
              <path key={d} d={d} className="mascot-streak-x" style={{ animationDelay: `${i * 0.25}s` }} />
            ))}
          </g>
          <ellipse cx={180} cy={352} rx={80} ry={10} fill={PINK} className="mascot-glow" />
        </>
      );
    case "falling":
      return (
        <g {...stroke} strokeWidth={6} opacity={0.3}>
          {["M70 -40 V-8", "M180 -52 V-16", "M290 -40 V-8"].map((d, i) => (
            <path key={d} d={d} className="mascot-streak-y" style={{ animationDelay: `${i * 0.25}s` }} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

export type MascotArtProps = Omit<SVGProps<SVGSVGElement>, "ref"> & {
  mood?: MascotMood;
  /** Kedip sesaat (hanya berefek pada mood bermata terbuka). */
  blink?: boolean;
  /** Elemen `<g>` mata/mulut; controller menggesernya agar mata mengikuti kursor. */
  lookRef?: Ref<SVGGElement>;
};

/** Maskot Supplio (Icon.svg) dengan wajah yang bisa berganti mood. Murni tampilan; gerak ada di MascotGuide. */
export function MascotArt({ mood = "idle", blink = false, lookRef, ...props }: MascotArtProps) {
  return (
    <svg viewBox="0 0 364 350" fill="none" xmlns="http://www.w3.org/2000/svg" overflow="visible" {...props}>
      <Body paths={BODY_UNDER} />
      <g ref={lookRef}>
        <g transform="translate(252 206) rotate(-9)">
          <Face mood={mood} blink={blink} />
        </g>
      </g>
      <Body paths={BODY_OVER} />
      <g key={mood}>
        <Effects mood={mood} />
      </g>
    </svg>
  );
}
