import { useState } from "react";

interface SetupFormProps {
  onSubmit: (username: string, email: string, password: string) => void;
  error: string | null;
  isPending: boolean;
  onBack: () => void;
  onSwitchToLogin: () => void;
}

export default function SetupForm({
  onSubmit,
  error,
  isPending,
  onBack,
  onSwitchToLogin,
}: SetupFormProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) return;
    onSubmit(username.trim(), email.trim(), password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center ds-bg">
      <div
        className="w-full max-w-sm p-6 rounded-xl"
        style={{
          backgroundColor: "#111827",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={onBack}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <iconify-icon icon="solar:arrow-left-linear" width="18" />
          </button>
          <h1
            className="text-lg font-bold"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            Create Account
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
            }}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
            }}
          />

          {error && (
            <p className="text-xs" style={{ color: "#ef4444" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "#f91814" }}
          >
            {isPending ? "Creating…" : "Create Account"}
          </button>
        </form>

        <p
          className="text-xs text-center mt-4"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Already have an account?{" "}
          <button
            onClick={onSwitchToLogin}
            className="underline hover:text-white/60 transition-colors"
            style={{ color: "#f91814" }}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
