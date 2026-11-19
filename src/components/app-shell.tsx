"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  FolderClosed,
  History,
  LayoutGrid,
  Library,
  LogOut,
  Menu,
  MessagesSquare,
  Plus,
  Search,
  Settings,
  UploadCloud,
  X,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn, initials } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/search", label: "Search", icon: Search },
  { href: "/ask", label: "Ask your memories", icon: MessagesSquare },
  { href: "/library", label: "My memories", icon: Library },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/collections", label: "Collections", icon: FolderClosed },
  { href: "/timeline", label: "Timeline", icon: History },
];

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label="Main">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent-ink"
                : "text-ink-2 hover:bg-surface-3 hover:text-ink",
            )}
          >
            <item.icon
              size={16}
              strokeWidth={1.8}
              className={cn(active ? "text-accent" : "text-muted group-hover:text-ink-2")}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarBody = (
    <div className="flex h-full flex-col gap-5 px-3 py-4">
      <div className="flex items-center justify-between px-1.5">
        <Brand href="/dashboard" />
        <ThemeToggle />
      </div>
      <Link
        href="/upload"
        className="mx-0.5 flex items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2"
      >
        <Plus size={14} /> Add memories
      </Link>
      {nav}
      <div className="mt-auto space-y-1 border-t border-line pt-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors",
            pathname === "/settings"
              ? "bg-surface-3 text-ink"
              : "text-ink-2 hover:bg-surface-3 hover:text-ink",
          )}
        >
          <Settings size={16} strokeWidth={1.8} className="text-muted" /> Settings & privacy
        </Link>
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-ink-2">
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
            <span className="block truncate text-[11px] text-muted">{user.email}</span>
          </span>
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas md:grid md:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface-2 md:block">
        {sidebarBody}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="absolute inset-y-0 left-0 w-[276px] animate-fade border-r border-line bg-surface-2 shadow-xl"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) setMobileOpen(false);
            }}
          >
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-3"
            >
              <X size={16} />
            </button>
            {sidebarBody}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur md:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-md border border-line bg-surface text-ink-2"
          >
            <Menu size={17} />
          </button>
          <Brand href="/dashboard" />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/upload"
              aria-label="Upload documents"
              className="grid h-8 w-8 place-items-center rounded-md bg-accent text-white dark:text-[#0b1512]"
            >
              <Plus size={16} />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          {children}
        </main>

        <footer className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-8 text-[11px] text-muted sm:px-6 lg:px-10">
          <span>RecallAI · private by default</span>
          <Link href="/settings" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/demo" className="inline-flex items-center gap-0.5 hover:text-ink">
            Demo workspace <ArrowUpRight size={11} />
          </Link>
        </footer>
      </div>
    </div>
  );
}
