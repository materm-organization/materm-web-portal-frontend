import { cn } from "@/lib/utils";

// 1368px content column (180px gutters at 1728); gutters shrink on smaller screens.
export function BlogContainer({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1368px] px-4 md:px-8 min-[1432px]:px-0", className)}
      {...props}
    />
  );
}
