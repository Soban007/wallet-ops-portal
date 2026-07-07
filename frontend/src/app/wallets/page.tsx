"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, User, Wallet } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { usePageTitle } from "@/lib/usePageTitle";
import { Empty, ErrorState, Loading } from "@/components/States";

export default function WalletsPage() {
  usePageTitle("Wallets");

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [userId, setUserId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [userList, walletList] = await Promise.all([
        api.get<User[]>("/users"),
        api.get<Wallet[]>("/wallets"),
      ]);
      setUsers(userList);
      setWallets(walletList);
      setLoadError("");
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!userId) {
      setFormMessage({ ok: false, text: "Please choose a user" });
      return;
    }
    setSubmitting(true);
    setFormMessage(null);
    try {
      await api.post<Wallet>("/wallets", { userId, currency });
      setFormMessage({ ok: true, text: "Wallet created" });
      setUserId("");
      await loadData();
    } catch (err) {
      setFormMessage({ ok: false, text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Wallets</h1>

      <div className="card">
        <h2>Create wallet</h2>
        <form onSubmit={onSubmit}>
          <label>
            User
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select a user…</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            Currency
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option>USD</option>
              <option>PKR</option>
              <option>EUR</option>
              <option>QAR</option>
            </select>
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Create wallet"}
          </button>
          {formMessage && (
            <span className={formMessage.ok ? "msg--ok" : "msg--err"}>
              {formMessage.text}
            </span>
          )}
        </form>
      </div>

      <div className="card">
        <h2>All wallets</h2>
        {loading ? (
          <Loading />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadData} />
        ) : wallets.length === 0 ? (
          <Empty message="No wallets yet. Create one above." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Wallet</th>
                <th>Currency</th>
                <th>Balance</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((wallet) => (
                <tr key={wallet.id}>
                  <td>{wallet.id.slice(0, 8)}…</td>
                  <td>{wallet.currency}</td>
                  <td>{formatAmount(wallet.balance)}</td>
                  <td>{wallet.status}</td>
                  <td>
                    <Link className="link" href={`/wallets/${wallet.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
