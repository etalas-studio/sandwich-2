import { useState, useEffect } from "react";
import { apiUrl } from "../api/base";

interface IntegrationItem {
  id: string;
  name: string;
  connected: boolean;
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/integrations"), { credentials: "include" })
      .then((r) => r.json())
      .then((list) => setIntegrations(list as IntegrationItem[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full overflow-y-auto hide-scrollbar p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-normal tracking-tight text-white ds-text-shadow">
            Integrations
          </h1>
          <span className="px-2 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.03] text-[10px] text-white/50">
            read-only
          </span>
        </div>
        <p className="text-sm text-white/50 font-light max-w-xl">
          Engine status is configured via environment variables by the
          instance owner.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-xl">
          {integrations.map((i) => (
            <div key={i.id} className="ds-card-outer">
              <div className="ds-card-inner p-4">
                <div className="absolute inset-0 ds-noise pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${i.connected ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`}
                    />
                    <div>
                      <h3 className="text-sm font-medium text-white ds-text-shadow">
                        {i.name}
                      </h3>
                      <p className="text-xs text-white/40 font-light">
                        {i.connected ? "Connected" : "Not configured"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      i.connected
                        ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
                        : "border-white/[0.06] bg-white/[0.03] text-white/30"
                    }`}
                  >
                    {i.connected ? "active" : "offline"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
