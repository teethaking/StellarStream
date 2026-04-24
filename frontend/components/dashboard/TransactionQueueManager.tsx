"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, ChevronUp, ChevronDown, Loader2, CheckCircle2, XCircle, ListTodo } from "lucide-react";
import { useTransactionQueue } from "@/lib/providers/TransactionQueueProvider";
import type { TransactionEntry } from "@/lib/providers/TransactionQueueProvider";

const TYPE_LABELS: Record<string, string> = {
  migration: "Migration",
  withdrawal: "Withdrawal",
  cancellation: "Cancellation",
  stream_created: "Stream Created",
  stream_paused: "Paused",
  stream_resumed: "Resumed",
  approval: "Approval",
  transfer: "Transfer",
};

function truncateHash(hash: string): string {
  if (!hash) return "";
  if (hash.length <= 10) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function TransactionEntryRow({ entry }: { entry: TransactionEntry }) {
  const { dismiss } = useTransactionQueue();
  const isTerminal = entry.status === "confirmed" || entry.status === "failed";

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
      {/* Status icon */}
      <div className="mt-0.5 shrink-0">
        {entry.status === "pending" && (
          <Loader2 size={14} className="animate-spin text-cyan-400" />
        )}
        {entry.status === "confirmed" && (
          <CheckCircle2 size={14} className="text-green-400" />
        )}
        {entry.status === "failed" && (
          <XCircle size={14} className="text-red-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-white truncate">
            {TYPE_LABELS[entry.type] ?? entry.type}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
            entry.status === "confirmed" ? "bg-green-400/20 text-green-400" :
            entry.status === "failed" ? "bg-red-400/20 text-red-400" :
            "bg-cyan-400/20 text-cyan-400"
          }`}>
            {entry.status}
          </span>
        </div>

        {entry.amount && entry.token && (
          <p className="text-[11px] text-white/60 mt-0.5 font-mono">
            {parseFloat(entry.amount).toLocaleString()} {entry.token}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1">
          {entry.hash ? (
            <a
              href={`https://stellar.expert/explorer/public/tx/${entry.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
            >
              {truncateHash(entry.hash)}
              <ExternalLink size={10} />
            </a>
          ) : (
            <span className="text-[10px] text-white/30 font-mono">awaiting hash…</span>
          )}

          {entry.pollFailureCount >= 3 && entry.status === "pending" && (
            <span className="text-[10px] text-yellow-400">poll failed</span>
          )}
        </div>
      </div>

      {/* Dismiss button for terminal entries */}
      {isTerminal && (
        <button
          onClick={() => dismiss(entry.id)}
          aria-label="Dismiss transaction"
          className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
        >
          <X size={12} className="text-white/40 hover:text-white/80" />
        </button>
      )}
    </div>
  );
}

interface TransactionQueueManagerProps {
  collapsed?: boolean;
}

export function TransactionQueueManager({ collapsed = false }: TransactionQueueManagerProps) {
  const { entries, dismissAllCompleted } = useTransactionQueue();
  const [expanded, setExpanded] = useState(false);
  const announcerRef = useRef<HTMLDivElement>(null);
  const prevEntriesRef = useRef<TransactionEntry[]>([]);

  const pendingCount = entries.filter((e) => e.status === "pending").length;
  const hasCompleted = entries.some((e) => e.status === "confirmed" || e.status === "failed");

  // ARIA live region announcements on status change
  useEffect(() => {
    const prev = prevEntriesRef.current;
    for (const entry of entries) {
      const prevEntry = prev.find((e) => e.id === entry.id);
      if (prevEntry && prevEntry.status !== entry.status && (entry.status === "confirmed" || entry.status === "failed")) {
        if (announcerRef.current) {
          announcerRef.current.textContent = `${TYPE_LABELS[entry.type] ?? entry.type} ${entry.status}`;
        }
      }
    }
    prevEntriesRef.current = entries;
  }, [entries]);

  // Render nothing when queue is empty
  if (entries.length === 0) return null;

  const sortedEntries = [...entries].sort((a, b) => b.timestamp - a.timestamp);

  // Icon-only mode when sidebar is collapsed
  if (collapsed) {
    return (
      <div className="relative flex items-center justify-center mt-3">
        <div className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10">
          <ListTodo size={16} className="text-cyan-400" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 text-[8px] font-bold text-black px-1">
              {pendingCount}
            </span>
          )}
        </div>
        {/* ARIA announcer */}
        <div ref={announcerRef} aria-live="polite" aria-atomic="true" className="sr-only" />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* ARIA announcer */}
      <div ref={announcerRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      {/* Header / toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
        aria-expanded={expanded}
        aria-label="Transaction queue"
      >
        <div className="flex items-center gap-2">
          <ListTodo size={14} className="text-cyan-400 shrink-0" />
          <span className="text-xs font-medium text-white/80">In-Flight</span>
          {pendingCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 text-[9px] font-bold text-black px-1 shadow-[0_0_6px_rgba(0,245,255,0.5)]">
              {pendingCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasCompleted && !expanded && (
            <button
              onClick={(e) => { e.stopPropagation(); dismissAllCompleted(); }}
              className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
              aria-label="Dismiss all completed"
            >
              clear
            </button>
          )}
          {expanded ? (
            <ChevronDown size={14} className="text-white/40" />
          ) : (
            <ChevronUp size={14} className="text-white/40" />
          )}
        </div>
      </button>

      {/* Expanded list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-1.5 max-h-64 overflow-y-auto">
              {sortedEntries.map((entry) => (
                <TransactionEntryRow key={entry.id} entry={entry} />
              ))}
              {hasCompleted && (
                <button
                  onClick={dismissAllCompleted}
                  className="w-full text-[10px] text-white/40 hover:text-white/70 py-1 transition-colors"
                >
                  Dismiss all completed
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TransactionQueueManager;
