"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Overview } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { usePageTitle } from "@/lib/usePageTitle";
import { ErrorState, Loading } from "@/components/States";

export default function DashboardPage() {
  usePageTitle("Dashboard");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get<Overview>("/reports/overview")
      .then(setOverview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!overview) return null;

  const stats = [
    { label: "Total wallets", value: overview.totalWallets },
    { label: "Total balance", value: formatAmount(overview.totalBalance) },
    { label: "Total credits", value: formatAmount(overview.totalCredits) },
    { label: "Total debits", value: formatAmount(overview.totalDebits) },
    { label: "Transactions", value: overview.transactionCount },
  ];

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="cards">
        {stats.map((stat) => (
          <div className="card" key={stat.label}>
            <div className="stat__label">{stat.label}</div>
            <div className="stat__value">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
