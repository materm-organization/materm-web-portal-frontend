import Link from "next/link";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

interface CtaLinkProps extends Omit<ComponentProps<typeof Link>, "children"> {
  children: React.ReactNode;
}

// Dark-green rectangular call to action: shadcn `Button` (variant="site",
// size="site") rendered `asChild` as a next/link. Use for "EXPLORE
// EXPEDITIONS", "VIEW ALL POSTS >>", "VIEW MORE".
export function CtaLink({ children, className, ...linkProps }: CtaLinkProps) {
  return (
    <Button asChild variant="site" size="site" className={className}>
      <Link {...linkProps}>{children}</Link>
    </Button>
  );
}
