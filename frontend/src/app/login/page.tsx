"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      // Wait a moment for local storage, then redirect to root
      window.location.href = "/";
    } catch (err) {
      setError("Login failed. Please check your credentials.");
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)", padding: 16 }}>
      <form onSubmit={handleSubmit} style={{ background: "var(--surface)", padding: 40, borderRadius: 16, border: "1px solid var(--border)", width: "100%", maxWidth: 400 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Log In</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
          Enter your credentials to access the UXR platform.
        </p>

        {error && (
          <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid var(--error)", borderRadius: 8, padding: 12, color: "var(--error)", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", outline: "none" }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", outline: "none" }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </main>
  );
}
