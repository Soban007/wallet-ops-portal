"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, User } from "@/lib/api";
import { usePageTitle } from "@/lib/usePageTitle";
import { Empty, ErrorState, Loading } from "@/components/States";

export default function UsersPage() {
  usePageTitle("Users");

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      setUsers(await api.get<User[]>("/users"));
      setLoadError("");
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormMessage(null);
    try {
      await api.post<User>("/users", { name, phone, email });
      setFormMessage({ ok: true, text: "User created" });
      setName("");
      setPhone("");
      setEmail("");
      await loadUsers();
    } catch (err) {
      setFormMessage({ ok: false, text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Users</h1>

      <div className="card">
        <h2>Create user</h2>
        <form onSubmit={onSubmit}>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+923001234567"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Create user"}
          </button>
          {formMessage && (
            <span className={formMessage.ok ? "msg--ok" : "msg--err"}>
              {formMessage.text}
            </span>
          )}
        </form>
      </div>

      <div className="card">
        <h2>All users</h2>
        {loading ? (
          <Loading />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadUsers} />
        ) : users.length === 0 ? (
          <Empty message="No users yet. Create one above." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.phone}</td>
                  <td>{user.email}</td>
                  <td>{user.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
