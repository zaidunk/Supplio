"use client"

import Link from "next/link"
import { type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { useRef, type ComponentProps } from "react"
import { useJelly, type JellyVariant } from "@/components/motion/use-jelly"
import { buttonVariants } from "./button-variants"

/** Tautan bergaya tombol (pengganti `<Link className={buttonVariants()}>`) dengan gerak kenyal yang sama dengan `Button`. */
export function ButtonLink({
  variant,
  size,
  className,
  motion,
  ...props
}: ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & { motion?: JellyVariant | "none" }) {
  const ref = useRef<HTMLAnchorElement>(null)
  useJelly(ref, motion ?? (variant === "outline" || variant === "secondary" ? "pop" : variant === "ghost" ? "soft" : "jelly"))
  return <Link ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
