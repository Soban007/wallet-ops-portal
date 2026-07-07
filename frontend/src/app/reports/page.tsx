"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, DailySummary } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { usePageTitle } from "@/lib/usePageTitle";
import { ErrorState, Loading } from "@/components/States";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  usePageTitle("Reports");

  const [date, setDate] = useState(today());
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(forDate: string) {
    setLoading(true);
    setError("");
    try {
      setSummary(
        await api.get<DailySummary>(`/reports/daily-summary?date=${forDate}`),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(today());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    load(date);
  }

  return (
    <div>
      <h1>Daily summary</h1>

      <div className="card">
        <form
          onSubmit={onSubmit}
          style={{ flexDirection: "row", alignItems: "flex-end" }}
        >
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button type="submit">View</button>
        </form>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(date)} />
      ) : summary ? (
        <div className="cards">
          <div className="card">
            <div className="stat__label">Date</div>
            <div className="stat__value">{summary.date}</div>
          </div>
          <div className="card">
            <div className="stat__label">Total credits</div>
            <div className="stat__value">{formatAmount(summary.totalCredits)}</div>
          </div>
          <div className="card">
            <div className="stat__label">Total debits</div>
            <div className="stat__value">{formatAmount(summary.totalDebits)}</div>
          </div>
          <div className="card">
            <div className="stat__label">Transactions</div>
            <div className="stat__value">{summary.transactionCount}</div>
          </div>
          <div className="card">
            <div className="stat__label">Active wallets</div>
            <div className="stat__value">{summary.activeWallets}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
