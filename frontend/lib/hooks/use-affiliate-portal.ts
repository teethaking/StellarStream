import { useEffect, useState } from "react";

export interface AffiliateSplit {
  splitId: string;
  totalAmount: string;
  affiliateEarned: string;
  token: string;
  sender: string;
  createdAt: string;
  status: string;
}

export interface AffiliateEarnings {
  pendingClaim: string;
  totalEarned: string;
  claimedAt: string | null;
}

export function useAffiliatePortal(address: string | null) {
  const [splits, setSplits] = useState<AffiliateSplit[]>([]);
  const [earnings, setEarnings] = useState<AffiliateEarnings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/v2/affiliate/earnings?address=${address}`).then((r) => r.json()),
      fetch(`/api/v2/affiliate/splits?address=${address}`).then((r) => r.json()),
    ])
      .then(([earningsRes, splitsRes]) => {
        if (earningsRes.success) setEarnings(earningsRes.earnings);
        if (splitsRes.success) setSplits(splitsRes.splits);
      })
      .catch(() => setError("Failed to load affiliate data"))
      .finally(() => setLoading(false));
  }, [address]);

  return { splits, earnings, loading, error };
}
