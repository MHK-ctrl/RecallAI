import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/lib/api";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser("/dashboard");
  return <AppShell user={user}>{children}</AppShell>;
}
