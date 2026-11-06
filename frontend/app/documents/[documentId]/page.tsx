"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Suspense } from "react";

type SourceDoc = { title: string; content: string; source_type: string; access_scope: string; category?: string; city?: string; country?: string };
function DocumentPreviewContent() {
  const { documentId } = useParams<{ documentId: string }>();
  const [doc, setDoc] = useState<SourceDoc | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => { api.getAccessibleDocument(documentId).then(setDoc).catch((e: unknown) => setError(e instanceof Error ? e.message : "Document unavailable")); }, 0);
    return () => window.clearTimeout(timer);
  }, [documentId]);
  return <AppLayout className="bg-[#FAF8F5]"><main className="mx-auto max-w-4xl px-6 py-10 text-[#1E293B]">
    <Link href="/plan" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#1C4A2A]"><ArrowLeft size={16}/>Back to Roamly chat</Link>
    {!doc && !error && <div className="flex items-center gap-3 py-20 text-slate-500"><Loader2 className="animate-spin"/>Loading source…</div>}
    {error && <div className="rounded-2xl border border-[#EAE6DE] bg-white p-8"><h1 className="font-heading text-2xl font-semibold">Source unavailable</h1><p className="mt-2 text-sm text-slate-500">{error}</p></div>}
    {doc && <article className="overflow-hidden rounded-3xl border border-[#EAE6DE] bg-white shadow-sm"><div className="border-b border-[#F0EDE8] p-7"><div className="mb-3 inline-flex rounded-xl bg-[#EAF2EB] p-3 text-[#1C4A2A]"><FileText/></div><h1 className="font-heading text-3xl font-bold">{doc.title}</h1><p className="mt-2 text-sm text-slate-500">{doc.access_scope === "private" ? "Personal Document" : "Roamly Knowledge Base"}{doc.category ? ` · ${doc.category}` : ""}{doc.city || doc.country ? ` · ${[doc.city,doc.country].filter(Boolean).join(", ")}` : ""}</p></div><pre className="whitespace-pre-wrap p-7 text-sm leading-7 text-slate-700">{doc.content}</pre></article>}
  </main></AppLayout>;
}

export default function DocumentPreviewPage() {
  return <Suspense fallback={<div className="p-12 text-center text-sm text-slate-500">Loading source…</div>}><DocumentPreviewContent /></Suspense>;
}
