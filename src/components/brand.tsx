import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-ink text-canvas",
        className,
      )}
      aria-hidden="true"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M4 7.5c0-2 1.8-3.5 4-3.5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M4 12.5c0-2 1.8-3.5 4-3.5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
        <path d="M4 17c0-1.6 1.5-2.8 3.4-2.8H17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
        <circle cx="4" cy="7.5" r="1.7" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">RecallAI</span>
    </Link>
  );
}
