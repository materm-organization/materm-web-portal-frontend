import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ContactFieldProps {
  /** `id` of the control; the error paragraph gets `${id}-error`. */
  id: string;
  label: string;
  /** Already translated error message, when the field is invalid. */
  error?: string;
  className?: string;
  /** The control (Input / Textarea). The parent sets `aria-invalid` / `aria-describedby` on it. */
  children: ReactNode;
}

/** Visible label + control + announced error text, stacked. */
export function ContactField({ id, label, error, className, children }: ContactFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
