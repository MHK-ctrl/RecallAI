import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ResetConfirmForm, ResetRequestForm } from "@/components/auth-forms";

export const metadata = { title: "Reset your password" };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell
      title={token ? "Choose a new password" : "Reset your password"}
      subtitle={
        token
          ? "This link can be used once and expires an hour after it is created."
          : "Enter the email on your account and RecallAI will create a single-use reset link."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {token ? <ResetConfirmForm token={token} /> : <ResetRequestForm />}
    </AuthShell>
  );
}
