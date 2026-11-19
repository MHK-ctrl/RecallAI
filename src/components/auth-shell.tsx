import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_0.92fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between">
          <Brand />
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-10">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={13} /> Back to RecallAI
          </Link>
          <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-ink">{title}</h1>
          <p className="mt-2 text-[13.5px] leading-6 text-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6 text-[13px] text-muted">{footer}</div> : null}
        </div>

        <p className="text-[11px] text-muted">Private by default · Your documents stay yours</p>
      </div>

      <aside className="hidden border-l border-line bg-surface-2 p-10 lg:flex lg:flex-col lg:justify-center">
        <div className="mx-auto max-w-md">
          <p className="eyebrow">Why people use RecallAI</p>
          <p className="mt-3 text-[26px] font-medium leading-[1.25] tracking-[-0.02em] text-ink">
            “The information was always there. It was just spread across forty folders and three
            apps.”
          </p>
          <div className="mt-8 space-y-4">
            {[
              "Upload notes, PDFs, slides and screenshots",
              "Search with natural language, not filenames",
              "Answers that cite the page they came from",
              "Delete a document and everything derived from it",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="text-[13.5px] leading-6 text-ink-2">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 flex items-start gap-2.5 rounded-lg border border-line bg-surface p-4">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-[12px] leading-5 text-muted">
              Each account is a separate knowledge base. Every query, file download and conversation
              is verified against the signed-in user on the server.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
