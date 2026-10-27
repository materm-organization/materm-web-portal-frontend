import * as React from "react"
import { cn } from "cn"

// Flat, square, 1 px bordered field (public-site look). Focus = outline, never
// glow. Uses the `site-*` tokens (scoped to the `.site` wrapper).
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-none border border-site-line bg-white px-4 text-base text-site-ink transition-colors selection:bg-site-green-900 selection:text-white file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-site-ink placeholder:text-site-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-green-700",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
