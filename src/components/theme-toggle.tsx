"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The active theme lives on <html data-theme>, set before paint by an inline
 * script in the root layout. The button reads that attribute on click, so there
 * is no state to hydrate and no flash of the wrong icon.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("recallai-theme", next);
    } catch {
      // private mode: the choice just will not persist
    }
  };

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      onClick={toggle}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md border border-line text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink",
        className,
      )}
    >
      <Sun size={15} className="hidden dark:block" />
      <Moon size={15} className="block dark:hidden" />
    </button>
  );
}
