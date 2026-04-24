"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";
import { isSplitterV3EnabledForNetwork } from "@/lib/feature-flags";
import { normalizeNetworkName } from "@/lib/network";
import { buildSimulationWaterfallFromRpc } from "@/lib/simulation-waterfall";
import { SimulationWaterfall } from "@/components/dashboard/simulation-waterfall";

const DEMO_SIMULATION_RESULTS = {
  simulationResults: {
    networkFee: "0.08",
    protocolFee: "3.50",
    recipients: [
      { address: "GDVF...A1", label: "Operations", amount: "720" },
      { address: "GCQH...D9", label: "Growth Fund", amount: "276.42" },
    ],
  },
};

export default function SplitterV3Page() {
  const { network } = useWallet();
  const networkName = normalizeNetworkName(network);
  const enabled = isSplitterV3EnabledForNetwork(network);

  const summary = buildSimulationWaterfallFromRpc({
    simulationResults: DEMO_SIMULATION_RESULTS,
    totalAmount: 1000,
    senderLabel: "Treasury Sender",
    protocolLabel: "Splitter Router",
    fallbackRecipients: [
      { address: "operations", label: "Operations", amount: 720 },
      { address: "growth-fund", label: "Growth Fund", amount: 276.42 },
    ],
  });

  if (!enabled) {
    return (
      <section className="col-span-full rounded-3xl border border-amber-400/20 bg-amber-400/[0.04] p-8">
        <p className="font-body text-[10px] tracking-[0.14em] text-amber-300/80 uppercase">Feature Gated</p>
        <h1 className="font-heading mt-2 text-3xl text-white">Splitter V3 is hidden on this network</h1>
        <p className="font-body mt-4 max-w-2xl text-sm text-white/60">
          This route is controlled by a feature flag and only appears when
          `NEXT_PUBLIC_ENABLE_SPLITTER_V3` is enabled and the connected wallet is on Testnet.
        </p>
        <p className="font-body mt-3 text-sm text-white/45">
          Current wallet network: <span className="text-white/80">{networkName}</span>
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
        >
          Back to dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="col-span-full space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <p className="font-body text-[10px] tracking-[0.14em] text-cyan-400/70 uppercase">Splitter V3</p>
        <h1 className="font-heading mt-2 text-4xl text-white">Testnet-only execution sandbox</h1>
        <p className="font-body mt-4 max-w-3xl text-sm text-white/55">
          This route stays hidden from Mainnet navigation while the team validates multi-recipient
          execution on Testnet. The simulation panel below shows the intended sender → protocol →
          recipient flow, including network and protocol fees.
        </p>
      </div>

      <SimulationWaterfall
        asset="USDC"
        summary={summary}
        description="Parsed from a Stellar RPC-style simulation payload so reviewers can inspect each transfer leg instead of a single aggregate number."
      />
    </section>
  );
}
