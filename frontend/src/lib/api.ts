// Thin wrapper around fetch so every call shares the same base URL and error
// handling. The backend returns errors as { statusCode, error, message }.

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...options,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : (data?.message ?? "Request failed");
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: "credit" | "debit";
  amountMinor: string;
  balanceBeforeMinor: string;
  balanceAfterMinor: string;
  referenceId: string;
  description: string | null;
  createdAt: string;
}

export interface Overview {
  totalWallets: number;
  totalBalance: string;
  totalCredits: string;
  totalDebits: string;
  transactionCount: number;
}

export interface DailySummary {
  date: string;
  totalCredits: string;
  totalDebits: string;
  transactionCount: number;
  activeWallets: number;
}

// Transaction amounts come back as minor units; format them for display.
export function formatMinor(minor: string): string {
  const value = BigInt(minor);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}
