"use client";

import { useMemo, useRef, useState } from "react";
import { Database, FileText, FileJson, FileSpreadsheet, FileType, Loader2, Plus, RefreshCw, Search, Trash2, UploadCloud, X } from "lucide-react";
import type { UserDocument } from "./types";

interface DocumentLibraryProps {
  documents: UserDocument[];
  selectedId: string | null;
  busy: boolean;
  uploadProgress: number;
  reprocessingId: string | null;
  onSelect: (id: string) => void;
  onUpload: (files: File[]) => void;
  onReprocess: (id: string) => void;
  onDelete: (id: string) => void;
}

function FileIcon({ type }: { type: string }) {
  if (["csv", "xlsx", "xls"].includes(type.toLowerCase())) return <FileSpreadsheet size={18} />;
  if (type.toLowerCase() === "json") return <FileJson size={18} />;
  if (["md", "markdown", "txt"].includes(type.toLowerCase())) return <FileType size={18} />;
  return <FileText size={18} />;
}

const accept = ".pdf,.txt,.docx,.json,.csv,.md,.markdown";

export function DocumentLibrary({ documents, selectedId, busy, uploadProgress, reprocessingId, onSelect, onUpload, onReprocess, onDelete }: DocumentLibraryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const types = useMemo(() => [...new Set(documents.map((doc) => doc.file_type.toLowerCase()).filter(Boolean))].sort(), [documents]);
  const visibleDocuments = useMemo(() => documents.filter((doc) => {
    const matchesQuery = `${doc.title} ${doc.original_filename} ${doc.description || ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (typeFilter === "all" || doc.file_type.toLowerCase() === typeFilter) && (statusFilter === "all" || doc.status === statusFilter);
  }), [documents, query, statusFilter, typeFilter]);

  const uploadQueued = () => {
    if (!queuedFiles.length || busy) return;
    onUpload(queuedFiles);
    setQueuedFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-[#EAE6DE] bg-white lg:w-[350px] lg:flex-none">
      <div className="border-b border-[#F0EDE8] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-[#1E293B]">Your documents</h2>
            <p className="mt-1 text-xs text-slate-500">{documents.length} private {documents.length === 1 ? "file" : "files"}</p>
          </div>
          <button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-[#1C4A2A] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#163b22]">
            <Plus size={15} /> Upload
          </button>
          <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={(event) => setQueuedFiles(Array.from(event.target.files || []))} />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#EAE6DE] px-3 py-2.5 focus-within:border-[#1C4A2A]">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles and filenames" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
          {query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} className="text-slate-400" /></button>}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select aria-label="Filter by file type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-lg border border-[#EAE6DE] bg-white px-2.5 py-2 text-xs text-slate-600 outline-none">
            <option value="all">All file types</option>{types.map((type) => <option key={type} value={type}>{type.toUpperCase()}</option>)}
          </select>
          <select aria-label="Filter by processing status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-[#EAE6DE] bg-white px-2.5 py-2 text-xs text-slate-600 outline-none">
            <option value="all">All statuses</option><option value="completed">Ready</option><option value="processing">Processing</option><option value="failed">Failed</option><option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {queuedFiles.length > 0 && <div className="border-b border-[#F0EDE8] bg-[#FAF8F5] p-4">
        <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-[#1E293B]">Ready to upload ({queuedFiles.length})</p><button onClick={() => setQueuedFiles([])} aria-label="Clear selected files"><X size={15} className="text-slate-500" /></button></div>
        <div className="mb-3 max-h-20 space-y-1 overflow-auto">{queuedFiles.map((file) => <p key={`${file.name}-${file.size}`} className="truncate text-[11px] text-slate-500">{file.name}</p>)}</div>
        <button disabled={busy} onClick={uploadQueued} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1C4A2A] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? <><Loader2 size={14} className="animate-spin" /> Uploading {uploadProgress}%</> : <><UploadCloud size={14} /> Add to library</>}
        </button>
      </div>}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {visibleDocuments.length ? <div className="space-y-1">{visibleDocuments.map((doc) => {
          const selected = doc.id === selectedId;
          return <div key={doc.id} className={`group rounded-xl border p-3 transition-colors ${selected ? "border-[#B8CABB] bg-[#EEF4EF]" : "border-transparent hover:bg-[#FAF8F5]"}`}>
            <button onClick={() => onSelect(doc.id)} className="flex w-full min-w-0 items-start gap-3 text-left">
              <span className={`mt-0.5 rounded-lg p-2 ${selected ? "bg-white text-[#1C4A2A]" : "bg-[#F4F2EE] text-slate-500"}`}><FileIcon type={doc.file_type} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#1E293B]">{doc.title}</span>
                <span className="mt-1 block truncate text-[11px] text-slate-500">{doc.original_filename}</span>
                <span className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400"><span>{doc.total_chunks} {doc.total_chunks === 1 ? "chunk" : "chunks"}</span><span>·</span><span className={doc.status === "completed" ? "font-semibold text-emerald-700" : doc.status === "failed" ? "font-semibold text-rose-600" : "text-amber-700"}>{doc.status === "completed" ? "Ready" : doc.status}</span></span>
              </span>
            </button>
            <div className="mt-2 flex justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
              <button title="Re-index document" aria-label={`Re-index ${doc.title}`} disabled={reprocessingId === doc.id || doc.status !== "completed"} onClick={() => onReprocess(doc.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-white disabled:opacity-40">{reprocessingId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
              <button title="Delete document" aria-label={`Delete ${doc.title}`} onClick={() => onDelete(doc.id)} className="rounded-md p-1.5 text-rose-500 hover:bg-white"><Trash2 size={14} /></button>
            </div>
          </div>;
        })}</div> : <div className="px-3 py-12 text-center"><Database size={25} className="mx-auto text-[#1C4A2A]" /><p className="mt-3 text-sm font-semibold text-[#1E293B]">{documents.length ? "No matching documents" : "Your library is empty"}</p><p className="mt-1 text-xs leading-5 text-slate-500">{documents.length ? "Try a different search or filter." : "Upload a guide, booking, or travel file to start."}</p></div>}
      </div>
    </aside>
  );
}
