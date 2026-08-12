import { useState, useEffect } from "react";
import { apiUrl } from "../api/base";

interface IntegrationItem {
  id: string;
  name: string;
  connected: boolean;
  authType: "api_key" | "none";
  error?: string;
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  const fetchList = () => {
    setLoading(true);
    fetch(apiUrl("/api/integrations"), { credentials: "include" })
      .then((r) => r.json())
      .then((list) => setIntegrations(list as IntegrationItem[]))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  const connect = async (providerId: string, key: string) => {
    setConnectingId(providerId);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/integrations/${encodeURIComponent(providerId)}/connect`),
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiKey: key }),
        },
      );
      const body = (await res.json()) as { ok?: boolean; message?: string };
      if (body.ok) {
        fetchList();
        setShowKeyInput(false);
        setApiKey("");
      } else {
        setError(body.message ?? "Connection failed");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setConnectingId(null);
    }
  };

  const disconnect = async (providerId: string) => {
    setConnectingId(providerId);
    try {
      const res = await fetch(
        apiUrl(`/api/integrations/${encodeURIComponent(providerId)}/disconnect`),
        { method: "POST", credentials: "include" },
      );
      const body = (await res.json()) as { ok?: boolean };
      if (body.ok) fetchList();
    } catch {
      /* ignore */
    } finally {
      setConnectingId(null);
    }
  };

  const groq = integrations.find((i) => i.id === "groq");
  const connected = groq?.connected ?? false;

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#111827" }}>
          Integrations
        </h1>
        <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
          Connect your Groq API key to enable AI document generation.
        </p>
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm" style={{ color: "#9ca3af" }}>
          Loading…
        </div>
      ) : (
        <div
          className="max-w-md rounded-xl p-5"
          style={{
            backgroundColor: "#111827",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <iconify-icon
                icon="simple-icons:groq"
                width="20"
                style={{
                  color: connected ? "#4ade80" : "rgba(255,255,255,0.5)",
                }}
              />
            </div>
            <div>
              <h3
                className="text-sm font-semibold"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                Groq
              </h3>
              <span
                className={`text-xs ${connected ? "text-green-400" : "text-white/40"}`}
              >
                {connected ? "Connected" : "Not connected"}
              </span>
            </div>
            <span
              className={`ml-auto w-2 h-2 rounded-full ${connected ? "animate-pulse" : ""}`}
              style={{
                backgroundColor: connected ? "#4ade80" : "rgba(255,255,255,0.2)",
              }}
            />
          </div>

          <p
            className="text-xs mb-4"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Fast inference for SANDWICH document generation. Get your key at{" "}
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

          {connected ? (
            <button
              onClick={() => disconnect("groq")}
              disabled={connectingId === "groq"}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
              style={{
                backgroundColor: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {connectingId === "groq" ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : showKeyInput ? (
            <div>
              <input
                type="password"
                placeholder="gsk_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs mb-2"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.85)",
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => apiKey.trim() && connect("groq", apiKey.trim())}
                  disabled={connectingId === "groq" || !apiKey.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: "#f91814" }}
                >
                  {connectingId === "groq" ? "Connecting…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setShowKeyInput(false);
                    setApiKey("");
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowKeyInput(true)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity"
              style={{ backgroundColor: "#f91814" }}
            >
              Add key
            </button>
          )}
        </div>
      )}
    </div>
  );
}
