import * as React from "react"
import { cn } from "cn"

// Same flat, square look as `Input`; grows with its content from 160 px.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-40 w-full rounded-none border border-site-line bg-white px-4 py-3 text-base text-site-ink transition-colors selection:bg-site-green-900 selection:text-white placeholder:text-site-muted disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-green-700",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
