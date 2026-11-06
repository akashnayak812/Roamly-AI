"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUp, Bot, FileText, Loader2, Paperclip, Sparkles } from "lucide-react";
import api from "@/lib/api";
import type { DocumentCitation, UserDocument } from "./types";

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: DocumentCitation[];
}

interface DocumentChatProps {
  document: UserDocument | null;
}

function responseError(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  // The API client normalizes Axios errors to Error instances, preserving the
  // server message on `message` rather than retaining Axios's `response` field.
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message ? message : "I couldn't search this document right now. Please try again.";
}

export function DocumentChat({ document }: DocumentChatProps) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setQuestion("");
  }, [document?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !document || sending) return;
    setQuestion("");
    setSending(true);
    setMessages((current) => [...current, { id: `${Date.now()}-q`, role: "user", content: trimmed }]);
    try {
      const result = await api.askMyDocument(document.id, trimmed);
      setMessages((current) => [...current, { id: `${Date.now()}-a`, role: "assistant", content: result.answer, citations: result.citations || [] }]);
    } catch (error: unknown) {
      setMessages((current) => [...current, { id: `${Date.now()}-e`, role: "assistant", content: responseError(error) }]);
    } finally {
      setSending(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(question);
  };
  const isReady = document?.status === "completed";

  if (!document) return <section className="flex min-h-[70vh] flex-1 items-center justify-center bg-[#FAF8F5] p-8 text-center">
    <div className="max-w-md"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF2EB] text-[#1C4A2A]"><FileText size={25} /></span><h2 className="mt-5 font-heading text-2xl font-semibold text-[#1E293B]">Choose a document to explore</h2><p className="mt-2 text-sm leading-6 text-slate-500">Select a file from your library. Roamly will search only that document and cite the passages used.</p></div>
  </section>;

  return <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#FAF8F5]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE6DE] bg-white px-6 py-4">
      <div className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-[#EAF2EB] p-2.5 text-[#1C4A2A]"><FileText size={19} /></span><div className="min-w-0"><h1 className="truncate font-heading text-lg font-semibold text-[#1E293B]">{document.title}</h1><p className="truncate text-xs text-slate-500">{document.original_filename} · {document.file_type.toUpperCase()} · {document.total_chunks} indexed {document.total_chunks === 1 ? "chunk" : "chunks"}</p></div></div>
      <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF4EF] px-3 py-1.5 text-[11px] font-semibold text-[#1C4A2A]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />Only this document</div>
    </header>

    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        {messages.length === 0 && <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-[#EAE6DE] bg-white p-7 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FCECE8] text-[#E76F51]"><Sparkles size={22} /></span>
          <h2 className="mt-4 font-heading text-xl font-semibold text-[#1E293B]">{isReady ? "Ask this document" : "Document is not ready yet"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{isReady ? <>Ask a question, find a detail, or request a summary. Roamly grounds its answer in <strong className="font-semibold text-slate-700">{document.title}</strong> and shows the supporting passage.</> : "Wait until processing is complete, then you can ask Roamly about this file."}</p>
          {isReady && <div className="mt-5 flex flex-wrap justify-center gap-2">{["Summarize this document", "What are the key details?", "What should I know before I travel?"].map((suggestion) => <button key={suggestion} onClick={() => void ask(suggestion)} disabled={sending} className="rounded-full border border-[#EAE6DE] px-3.5 py-2 text-xs text-slate-600 transition-colors hover:border-[#B8CABB] hover:bg-[#F5F8F5] disabled:opacity-50">{suggestion}</button>)}</div>}
        </div>}

        {messages.map((message) => message.role === "user" ? <div key={message.id} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#1C4A2A] px-4 py-3 text-sm leading-6 text-white">{message.content}</div></div> : <article key={message.id} className="rounded-2xl border border-[#EAE6DE] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3"><span className="mt-0.5 rounded-lg bg-[#FCECE8] p-2 text-[#E76F51]"><Bot size={17} /></span><div className="min-w-0 flex-1"><p className="whitespace-pre-wrap text-sm leading-7 text-[#1E293B]">{message.content.replace(/\[Source\s+(\d+)(?::[^\]]*)?\]/g, "[$1]")}</p>
            {message.citations && message.citations.length > 0 && <div className="mt-4 border-t border-[#F0EDE8] pt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#1C4A2A]">Found in this document</p><div className="space-y-2">{message.citations.map((citation, index) => <div key={`${citation.document_id}-${index}`} className="rounded-xl bg-[#FAF8F5] px-3.5 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-[#1E293B]"><span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500">[{index + 1}]</span>{citation.source_name}</div>{citation.snippet && <p className="mt-2 border-l-2 border-[#A8B9AA] pl-3 text-xs leading-5 text-slate-600">{citation.snippet}</p>}{citation.document_id && <Link href={`/documents/${citation.document_id}`} className="mt-2 inline-block text-xs font-semibold text-[#1C4A2A] underline">Open document</Link>}</div>)}</div></div>}
          </div></div>
        </article>)}
        {sending && <div className="flex items-center gap-2 pl-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin text-[#1C4A2A]" />Searching only this document with Gemini…</div>}
      </div>
    </div>

    <form onSubmit={submit} className="border-t border-[#EAE6DE] bg-white px-4 py-4 md:px-7">
      <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-[#EAE6DE] bg-[#FAF8F5] p-2.5 focus-within:border-[#9DB4A1] focus-within:ring-2 focus-within:ring-[#1C4A2A]/10">
        <span title="Questions are restricted to the selected document" className="mb-2 ml-1 text-slate-400"><Paperclip size={17} /></span>
        <textarea value={question} disabled={!isReady} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(question); } }} rows={1} placeholder={isReady ? `Ask about ${document.title}…` : "Document indexing in progress…"} className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-1 py-2 text-sm text-[#1E293B] outline-none placeholder:text-slate-400 disabled:cursor-not-allowed" />
        <button type="submit" disabled={!question.trim() || sending || !isReady} aria-label="Ask this document" className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1C4A2A] text-white transition-colors hover:bg-[#163b22] disabled:bg-slate-300"><ArrowUp size={17} /></button>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-slate-400">Answers use only this file. Press Enter to send · Shift + Enter for a new line.</p>
    </form>
  </section>;
}
