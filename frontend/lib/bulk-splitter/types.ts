// lib/bulk-splitter/types.ts

export interface Voter {
  address: string;
  governance_score: bigint;
  /** Optional internal Tax ID / note — stored backend-only, never on-chain. */
  taxId?: string;
}

/** Memo types supported by the Stellar network */
export type MemoType = "none" | "text" | "id";

export interface Recipient {
  address: string;
  amount: bigint;
  /** Optional internal Tax ID / note — stored backend-only, never on-chain. */
  taxId?: string;
  // Issue #779 — Memo-Batcher
  /** Memo type for exchange recipients (e.g. Binance requires a numeric ID memo) */
  memoType?: MemoType;
  /** Memo value — text (≤28 bytes) or numeric string for ID type */
  memo?: string;
}
