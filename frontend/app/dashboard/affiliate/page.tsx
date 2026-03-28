"use client";

import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, Coins, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useAffiliatePortal } from "@/lib/hooks/use-affiliate-portal";
import { useWallet } from "@/lib/wallet-context";

function formatAmount(raw: string, decimals = 7): string {
  try {
    const n = Number(BigInt(raw)) / 10 ** decimals;
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return "0";
  }
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function AffiliatePortalPage() {
  const { publicKey } = useWallet();
  const { splits, earnings, loading, error } = useAffiliatePortal(publicKey ?? null);

  return (
    <div className="flex-1 p-8 pt-6 space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-heading text-3xl font-bold tracking-tight text-white mb-1">
          Affiliate Portal
        </h2>
        <p className="font-body text-sm text-white/50">
          Track your 0.1% revenue share from splits you referred.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Earned",
            value: earnings ? formatAmount(earnings.totalEarned) : "—",
            icon: TrendingUp,
            color: "text-cyan-400",
          },
          {
            label: "Pending Claim",
            value: earnings ? formatAmount(earnings.pendingClaim) : "—",
            icon: Coins,
            color: "text-emerald-400",
          },
          {
            label: "Referred Splits",
            value: loading ? "…" : splits.length.toString(),
            icon: CheckCircle2,
            color: "text-violet-400",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <span className="text-xs font-bold uppercase tracking-widest text-white/40">
                {label}
              </span>
            </div>
            <p className={`font-heading text-2xl font-bold tabular-nums ${color}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Splits table */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden backdrop-blur-xl">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-bold text-white/70">Referred Splits</span>
          <span className="text-xs text-white/30">{splits.length} total</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-white/30">Loading…</div>
        ) : splits.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Coins className="h-10 w-10 text-white/10 mx-auto" />
            <p className="text-sm text-white/30">No referred splits yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {splits.map((s, i) => (
              <motion.li
                key={s.splitId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-4 text-sm"
              >
                {/* Sender */}
                <div className="min-w-0">
                  <p className="font-mono text-xs text-cyan-400">{shortAddr(s.sender)}</p>
                  <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Status */}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
                    s.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-white/5 text-white/30"
                  }`}
                >
                  {s.status}
                </span>

                {/* Total split */}
                <div className="text-right">
                  <p className="font-mono text-white tabular-nums">
                    {formatAmount(s.totalAmount)}
                  </p>
                  <p className="text-xs text-white/30">{s.token}</p>
                </div>

                {/* Your cut */}
                <div className="text-right">
                  <p className="font-mono text-emerald-400 tabular-nums">
                    +{formatAmount(s.affiliateEarned)}
                  </p>
                  <p className="text-xs text-white/30">your 0.1%</p>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
