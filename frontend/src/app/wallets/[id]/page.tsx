"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, formatMinor, Transaction, Wallet } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { usePageTitle } from "@/lib/usePageTitle";
import { Empty, ErrorState, Loading } from "@/components/States";

export default function WalletDetailPage({
  params,
}: {
  params: { id: string };
}) {
  usePageTitle("Wallet detail");

  const walletId = params.id;

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [type, setType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    try {
      const [walletData, txData] = await Promise.all([
        api.get<Wallet>(`/wallets/${walletId}`),
        api.get<Transaction[]>(`/wallets/${walletId}/transactions`),
      ]);
      setWallet(walletData);
      setTransactions(txData);
      setLoadError("");
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [walletId]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormMessage(null);
    try {
      await api.post<Transaction>(`/wallets/${walletId}/${type}`, {
        amount,
        referenceId,
        description: description || undefined,
      });
      setFormMessage({
        ok: true,
        text: `${type === "credit" ? "Credit" : "Debit"} applied`,
      });
      setAmount("");
      setReferenceId("");
      setDescription("");
      await loadWallet();
    } catch (err) {
      setFormMessage({ ok: false, text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading />;
  if (loadError) return <ErrorState message={loadError} onRetry={loadWallet} />;
  if (!wallet) return null;

  return (
    <div>
      <h1>Wallet detail</h1>

      <div className="cards">
        <div className="card">
          <div className="stat__label">Balance</div>
          <div className="stat__value">
            {formatAmount(wallet.balance)} {wallet.currency}
          </div>
        </div>
        <div className="card">
          <div className="stat__label">Status</div>
          <div className="stat__value">{wallet.status}</div>
        </div>
        <div className="card">
          <div className="stat__label">Wallet ID</div>
          <div style={{ fontSize: 13, marginTop: 6, wordBreak: "break-all" }}>
            {wallet.id}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Credit / Debit</h2>
        <form onSubmit={onSubmit}>
          <label>
            Operation
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "credit" | "debit")}
            >
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>
          </label>
          <label>
            Amount
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              required
            />
          </label>
          <label>
            Reference ID
            <input
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="unique-id-per-operation"
              required
            />
          </label>
          <label>
            Description (optional)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Processing…" : "Submit"}
          </button>
          {formMessage && (
            <span className={formMessage.ok ? "msg--ok" : "msg--err"}>
              {formMessage.text}
            </span>
          )}
        </form>
      </div>

      <div className="card">
        <h2>Transactions</h2>
        {transactions.length === 0 ? (
          <Empty message="No transactions yet." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Before</th>
                <th>After</th>
                <th>Reference</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    <span className={`tag tag--${tx.type}`}>{tx.type}</span>
                  </td>
                  <td>{formatAmount(formatMinor(tx.amountMinor))}</td>
                  <td>{formatAmount(formatMinor(tx.balanceBeforeMinor))}</td>
                  <td>{formatAmount(formatMinor(tx.balanceAfterMinor))}</td>
                  <td>{tx.referenceId}</td>
                  <td>{new Date(tx.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
