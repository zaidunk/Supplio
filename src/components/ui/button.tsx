"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { useRef } from "react"
import { useJelly, type JellyVariant } from "@/components/motion/use-jelly"
import { buttonVariants } from "./button-variants"

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Watak gerak kenyal; bawaannya mengikuti varian. Aksi serius memakai "press", `"none"` mematikan. */
    motion?: JellyVariant | "none"
  }

/** Gerak bawaan per varian: utama = kenyal penuh, sekunder = kecil, ghost = lembut, destruktif = tanpa melenting. */
function defaultMotion(variant: ButtonProps["variant"], size: ButtonProps["size"]): JellyVariant | "none" {
  if (size?.startsWith("icon")) return "icon"
  switch (variant) {
    case "destructive":
      return "press"
    case "outline":
    case "secondary":
      return "pop"
    case "ghost":
      return "soft"
    case "link":
      return "none"
    default:
      return "jelly"
  }
}

function Button({
  className,
  variant = "default",
  size = "default",
  motion,
  ref,
  ...props
}: ButtonProps) {
  const own = useRef<HTMLElement>(null)
  useJelly(own, motion ?? defaultMotion(variant, size))
  return (
    <ButtonPrimitive
      ref={(node) => {
        own.current = node
        if (typeof ref === "function") ref(node as HTMLButtonElement | null)
        else if (ref) (ref as { current: HTMLElement | null }).current = node
      }}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
