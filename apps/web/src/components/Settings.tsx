import { useState, useEffect } from "react";
import { apiUrl } from "../api/base";
import { useLanguage, type Lang } from "../lib/i18n";
import AccountSection from "./AccountSection";
import type { Account } from "./AccountSection";

interface SettingsProps {
  onPurge?: () => void;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#111827",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "1rem",
  padding: "1.25rem",
  display: "flex",
  flexDirection: "column",
};

function GhostBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
      style={{
        backgroundColor: "rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.5)",
      }}
    >
      {children}
    </button>
  );
}

function DarkBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-40"
      style={{ backgroundColor: "#f91814" }}
    >
      {children}
    </button>
  );
}

function LanguageCard() {
  const { lang, setLang, t } = useLanguage();
  const OPTIONS: { value: Lang; label: string }[] = [
    { value: "en", label: "English" },
    { value: "id", label: "Bahasa Indonesia" },
  ];
  return (
    <div style={cardStyle}>
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        {t("settings_language")}
      </p>
      <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
        {t("settings_language_desc")}
      </p>
      <div
        className="flex rounded-lg overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLang(opt.value)}
            className="flex-1 px-3 py-2 text-xs font-medium transition-colors"
            style={
              lang === opt.value
                ? { backgroundColor: "#f91814", color: "#ffffff" }
                : {
                    backgroundColor: "transparent",
                    color: "rgba(255,255,255,0.5)",
                  }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Inline API key input for Groq ──
function GroqApiKeyInput({
  onConnect,
  connecting,
  error,
}: {
  onConnect: (key: string) => void;
  connecting: boolean;
  error: string | null;
}) {
  const [key, setKey] = useState("");

  return (
    <div>
      <input
        type="password"
        placeholder="gsk_..."
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-xs mb-2"
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.85)",
        }}
      />
      {error && (
        <p className="text-xs mb-2" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}
      <DarkBtn
        onClick={() => key.trim() && onConnect(key.trim())}
        disabled={connecting || !key.trim()}
      >
        {connecting ? "Connecting…" : "Save key"}
      </DarkBtn>
    </div>
  );
}

// ── Main Settings ──
export default function Settings({ onPurge }: SettingsProps) {
  const [account, setAccount] = useState<Account | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [groqConnected, setGroqConnected] = useState(false);
  const [groqLoading, setGroqLoading] = useState(true);
  const [groqError, setGroqError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/account"), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => setAccount(a as Account | null))
      .catch(() => {})
      .finally(() => setAccountLoading(false));
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/integrations"), { credentials: "include" })
      .then((r) => r.json())
      .then((list) => {
        const groq = (list as Array<{ id: string; connected: boolean }>).find(
          (i) => i.id === "groq",
        );
        setGroqConnected(groq?.connected ?? false);
      })
      .catch(() => {})
      .finally(() => setGroqLoading(false));
  }, []);

  const connectGroq = async (key: string) => {
    setConnecting(true);
    setGroqError(null);
    try {
      const res = await fetch(apiUrl("/api/integrations/groq/connect"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const body = (await res.json()) as { ok?: boolean; message?: string };
      if (body.ok) {
        setGroqConnected(true);
      } else {
        setGroqError(body.message ?? "Connection failed");
      }
    } catch {
      setGroqError("Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const disconnectGroq = async () => {
    setConnecting(true);
    try {
      const res = await fetch(apiUrl("/api/integrations/groq/disconnect"), {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as { ok?: boolean };
      if (body.ok) setGroqConnected(false);
    } catch {
      /* ignore */
    } finally {
      setConnecting(false);
    }
  };

  const handleChangePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    const res = await fetch(apiUrl("/api/account/password"), {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? "Failed to change password");
    }
  };

  return (
    <div
      className="h-full overflow-y-auto p-8"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "#111827" }}
        >
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
          Manage account and integrations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <LanguageCard />

        {/* Account */}
        {accountLoading ? (
          <div style={cardStyle}>
            <div
              className="h-32 rounded-lg animate-pulse"
              style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
            />
          </div>
        ) : account ? (
          <AccountSection
            account={account}
            onChangePassword={handleChangePassword}
            onPurge={onPurge}
          />
        ) : null}

        {/* Groq */}
        <div style={cardStyle}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <iconify-icon
                  icon="simple-icons:groq"
                  width="18"
                  style={{
                    color: groqConnected
                      ? "#4ade80"
                      : "rgba(255,255,255,0.6)",
                  }}
                />
              </div>
              <h4
                className="text-sm font-semibold"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                Groq
              </h4>
            </div>
            <span
              className={`w-2 h-2 rounded-full mt-1 shrink-0 ${groqConnected ? "animate-pulse" : ""}`}
              style={{
                backgroundColor: groqConnected
                  ? "#4ade80"
                  : connecting
                    ? "#f59e0b"
                    : "rgba(255,255,255,0.2)",
              }}
            />
          </div>

          <p
            className="text-xs leading-relaxed mb-4 flex-1"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Fast inference for SANDWICH — Qwen3, Llama, and more. Get your API
            key at{" "}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              console.groq.com
            </a>
            .
          </p>

          {groqLoading ? (
            <div
              className="h-10 rounded-lg animate-pulse"
              style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
            />
          ) : groqConnected ? (
            <GhostBtn onClick={disconnectGroq} disabled={connecting}>
              Disconnect
            </GhostBtn>
          ) : (
            <GroqApiKeyInput
              onConnect={connectGroq}
              connecting={connecting}
              error={groqError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
