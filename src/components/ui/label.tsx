"use client"

import * as React from "react"
import { cn } from "cn"
import { Label as LabelPrimitive } from "radix-ui"

// Small spaced uppercase caption, the same look as the site section eyebrows.
const labelClassName =
  "flex items-center gap-2 text-[13px] leading-snug font-medium tracking-[0.2em] text-site-green-600 uppercase select-none sm:text-sm group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(labelClassName, className)}
      {...props}
    />
  )
}

export { Label, labelClassName }
