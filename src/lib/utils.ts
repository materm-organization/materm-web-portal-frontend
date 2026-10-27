// Re-exports the class-name merge helper used by generated `components/ui/*`
// primitives (which import `cn` directly from the `cn` package — shadcn's
// current codegen output) so the rest of the app can consistently import it
// from `@/lib/utils`.
export { cn } from "cn";
