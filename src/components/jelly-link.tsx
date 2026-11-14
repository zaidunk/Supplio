"use client";

import Link from "next/link";
import { useRef, type ComponentProps } from "react";
import { useJelly, type JellyVariant } from "@/components/motion/use-jelly";

/** `next/link` dengan gerak kenyal saat dihover/ditekan. Pilih watak lewat `motion` (lihat use-jelly.ts). */
export function JellyLink({
  motion = "jelly",
  ...props
}: ComponentProps<typeof Link> & { motion?: JellyVariant | "none" }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useJelly(ref, motion);
  return <Link ref={ref} {...props} />;
}
