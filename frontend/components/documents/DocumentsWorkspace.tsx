"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DocumentChat } from "./DocumentChat";
import { DocumentLibrary } from "./DocumentLibrary";
import type { UserDocument } from "./types";

function errorDetail(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function DocumentsWorkspace() {
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  const refresh = useCallback(async () => {
    const next = await api.getMyDocuments() as UserDocument[];
    setDocuments(next);
    setSelectedId((current) => current && next.some((doc) => doc.id === current) ? current : next.find((doc) => doc.status === "completed")?.id || next[0]?.id || null);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    if (authLoading) return () => { active = false; };
    if (!user) {
      setAuthRequired(true);
      setLoading(false);
      return () => { active = false; };
    }
    user.getIdToken().then((token) => { api.setToken(token); return api.getMyDocuments(); }).then((next: UserDocument[]) => {
      if (!active) return;
      setDocuments(next);
      setSelectedId(next.find((doc) => doc.status === "completed")?.id || next[0]?.id || null);
    }).catch((error: unknown) => {
      if (active) toast.error(errorDetail(error));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, user]);

  const selectedDocument = useMemo(() => documents.find((doc) => doc.id === selectedId) || null, [documents, selectedId]);

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    setUploadProgress(0);
    let completed = 0;
    let latest: UserDocument | null = null;
    try {
      for (const file of files) {
        latest = await api.uploadMyDocument(file, {}, (value) => setUploadProgress(Math.round((completed + value / 100) / files.length * 100))) as UserDocument;
        completed += 1;
        setUploadProgress(Math.round(completed / files.length * 100));
      }
      const next = await refresh();
      if (latest) setSelectedId(latest.id);
      toast.success(`${files.length} ${files.length === 1 ? "document" : "documents"} added to your private library.`);
      if (!next.length) setSelectedId(null);
    } catch (error: unknown) {
      toast.error(errorDetail(error));
      await refresh().catch(() => undefined);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const reprocess = async (id: string) => {
    setReprocessingId(id);
    try {
      await api.reprocessMyDocument(id);
      await refresh();
      toast.success("Document re-indexed and ready for document chat.");
    } catch (error: unknown) {
      toast.error(errorDetail(error));
    } finally {
      setReprocessingId(null);
    }
  };

  const remove = async (id: string) => {
    const doc = documents.find((item) => item.id === id);
    if (!window.confirm(`Delete “${doc?.title || "this document"}” and its indexed chunks?`)) return;
    try {
      await api.deleteMyDocument(id);
      setDocuments((current) => current.filter((item) => item.id !== id));
      setSelectedId((current) => current === id ? null : current);
      toast.success("Document deleted from your private library.");
    } catch (error: unknown) {
      toast.error(errorDetail(error));
    }
  };

  return <AppLayout className="bg-[#FAF8F5]"><main className="flex h-screen min-h-[640px] flex-col overflow-hidden text-[#1E293B]">
    <header className="flex items-center justify-between border-b border-[#EAE6DE] bg-white px-6 py-4 md:px-8">
      <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#E76F51]">Private knowledge workspace</p><h1 className="mt-1 font-heading text-2xl font-semibold">Document chat</h1></div>
      <div className="hidden items-center gap-2 rounded-full bg-[#EEF4EF] px-3 py-2 text-[11px] font-medium text-[#1C4A2A] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />Separate from trip planning</div>
    </header>
    {authRequired ? <div className="flex flex-1 items-center justify-center p-8"><div className="max-w-sm rounded-3xl border border-[#EAE6DE] bg-white p-8 text-center shadow-sm"><h2 className="font-heading text-2xl font-semibold">Sign in to use your document library</h2><p className="mt-2 text-sm leading-6 text-slate-500">Your uploads and document conversations are private to your account.</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-[#1C4A2A] px-5 py-3 text-sm font-semibold text-white">Sign in</Link></div></div> : <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <DocumentLibrary documents={documents} selectedId={selectedId} busy={uploading} uploadProgress={uploadProgress} reprocessingId={reprocessingId} onSelect={setSelectedId} onUpload={uploadFiles} onReprocess={reprocess} onDelete={remove} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        {loading ? <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading your private documents…</div> : <DocumentChat key={selectedId || "no-document"} document={selectedDocument} />}
      </div>
    </div>}
  </main></AppLayout>;
}
