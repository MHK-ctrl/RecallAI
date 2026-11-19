import { Database, HardDrive, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { requirePageUser } from "@/lib/api";
import { storageUsage } from "@/lib/documents";
import { activeEmbeddingModel, env, isEmbeddingProviderConfigured, isLlmConfigured } from "@/lib/env";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { DataControls, PasswordForm, ProfileForm } from "@/components/settings-forms";
import { formatBytes } from "@/lib/utils";

export const metadata = { title: "Settings & privacy" };

export default async function SettingsPage() {
  const user = await requirePageUser("/settings");
  const usage = await storageUsage(user.id);

  return (
    <div>
      <PageHeader
        title="Settings & privacy"
        description="Your account, your data, and exactly which services process it."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Documents" value={usage.documents} />
        <Stat label="Storage" value={formatBytes(usage.bytes)} hint={`Allowance ${env.storageQuotaMb} MB`} />
        <Stat
          label="Chat model"
          value={isLlmConfigured() ? "Configured" : "None"}
          hint={isLlmConfigured() ? env.llm.model : "Extractive answers"}
        />
        <Stat
          label="Embeddings"
          value={isEmbeddingProviderConfigured() ? "Provider" : "Local"}
          hint={activeEmbeddingModel()}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <ProfileForm initialName={user.name} email={user.email} />
          <PasswordForm />
          <DataControls />
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-accent" />
              <h2 className="text-[13px] font-semibold text-ink">How your data is handled</h2>
            </div>
            <ul className="mt-3 space-y-3 text-[11.5px] leading-5 text-muted">
              <li className="flex gap-2">
                <Database size={13} className="mt-0.5 shrink-0 text-ink-2" />
                <span>
                  <span className="font-medium text-ink-2">PostgreSQL (yours).</span> Original files,
                  extracted passages, embeddings, collections and conversations are stored in this
                  deployment&apos;s database. Every query is filtered by your user id on the server.
                </span>
              </li>
              <li className="flex gap-2">
                <Sparkles size={13} className="mt-0.5 shrink-0 text-ink-2" />
                <span>
                  <span className="font-medium text-ink-2">AI provider.</span>{" "}
                  {isLlmConfigured()
                    ? "When you ask a question, only the handful of retrieved excerpts and your question are sent to the configured chat model. Full documents are never sent."
                    : "No chat model is configured, so no document text leaves this server for answer generation."}{" "}
                  {isEmbeddingProviderConfigured()
                    ? "Passage text is sent to the configured embedding provider when a document is indexed."
                    : "Embeddings are computed locally with a lexical hashing model."}
                </span>
              </li>
              <li className="flex gap-2">
                <Lock size={13} className="mt-0.5 shrink-0 text-ink-2" />
                <span>
                  <span className="font-medium text-ink-2">Access.</span> Files are served through an
                  authenticated route with a short-lived signed link. Nothing is placed in a public
                  bucket.
                </span>
              </li>
              <li className="flex gap-2">
                <HardDrive size={13} className="mt-0.5 shrink-0 text-ink-2" />
                <span>
                  <span className="font-medium text-ink-2">Deletion.</span> Removing a document
                  cascades to its passages, vectors and collection links in a single database
                  operation.
                </span>
              </li>
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="text-[13px] font-semibold text-ink">Deployment configuration</h2>
            <dl className="mt-2.5 space-y-1.5 text-[11.5px]">
              {[
                ["OCR for images", env.ocrEnabled ? "Enabled" : "Disabled"],
                ["Max file size", `${env.maxUploadMb} MB`],
                ["Max passages per document", String(env.maxChunksPerDocument)],
                ["Search", isEmbeddingProviderConfigured() ? "Hybrid (FTS + provider vectors)" : "Hybrid (FTS + local vectors)"],
                ["Chat answers", isLlmConfigured() ? "LLM with citation validation" : "Extractive quotations"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right text-ink-2">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-line pt-3 text-[11px] leading-5 text-muted">
              To enable written AI answers, set <code className="font-mono text-[10.5px]">LLM_API_KEY</code> and{" "}
              <code className="font-mono text-[10.5px]">LLM_MODEL</code>. To use a real embedding model,
              set <code className="font-mono text-[10.5px]">EMBEDDING_API_KEY</code> and{" "}
              <code className="font-mono text-[10.5px]">EMBEDDING_MODEL</code>, then re-index documents.
            </p>
          </Card>

          <Card className="p-4">
            <h2 className="text-[13px] font-semibold text-ink">What RecallAI will not do</h2>
            <ul className="mt-2 space-y-1.5 text-[11.5px] leading-5 text-muted">
              <li>• Publish or share a document without an explicit action from you.</li>
              <li>• Answer a question from outside your library and present it as your data.</li>
              <li>• Treat instructions inside uploaded documents as commands.</li>
              <li>• Keep a deleted document&apos;s passages or vectors around.</li>
            </ul>
            <Badge tone="outline" className="mt-3">
              {isEmbeddingProviderConfigured() ? "Provider embeddings" : "No external embedding calls"}
            </Badge>
          </Card>
        </div>
      </div>
    </div>
  );
}
