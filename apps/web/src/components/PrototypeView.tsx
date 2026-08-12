import { useState, useEffect } from "react";
import { apiUrl } from "../api/base";

interface Prototype {
  id: string;
  shareId: string;
  name: string;
  brief: string;
  status: string;
  createdAt: string;
  previewUrl?: string;
}

function PrototypeForm({ onCreated }: { onCreated: (p: Prototype) => void }) {
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [palette, setPalette] = useState("");
  const [logoData, setLogoData] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !brief.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/prototypes"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brief: brief.trim(),
          palette: palette.trim() || null,
          logoData: logoData.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const proto = (await res.json()) as Prototype;
      onCreated(proto);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6" style={{ backgroundColor: "#F4EBE1", minHeight: "100vh" }}>
      <h1 className="text-3xl mb-6" style={{ fontFamily: "'Bowlby One', system-ui", color: "#111827" }}>
        New Prototype
      </h1>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="My App Prototype"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Brief (describe your product)</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border"
            rows={6}
            placeholder="A SaaS for managing warehouse inventory..."
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Color palette (hex codes, comma-separated)</label>
          <input
            value={palette}
            onChange={(e) => setPalette(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="#f91814, #111827, #F4EBE1"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Logo (URL or description)</label>
          <input
            value={logoData}
            onChange={(e) => setLogoData(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="https://example.com/logo.png or 'a red circle with letter S'"
          />
        </div>
        {error && <p className="text-sm" style={{ color: "#f91814" }}>{error}</p>}
        <button
          onClick={submit}
          disabled={submitting}
          className="px-6 py-3 rounded-full text-white font-semibold"
          style={{ backgroundColor: "#111827", opacity: submitting ? 0.5 : 1 }}
        >
          {submitting ? "Generating..." : "Generate Prototype"}
        </button>
      </div>
    </div>
  );
}

export default function PrototypeView() {
  const [prototypes, setPrototypes] = useState<Prototype[]>([]);
  const [active, setActive] = useState<Prototype | null>(null);
  const [instruction, setInstruction] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/prototypes"), { credentials: "include" })
      .then((r) => r.json())
      .then(setPrototypes)
      .catch(() => {});
  }, []);

  const regenerate = async () => {
    if (!active || !instruction.trim()) return;
    setRefreshing(true);
    try {
      await fetch(apiUrl(`/api/prototypes/${active.id}/regenerate`), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: instruction.trim() }),
      });
      setInstruction("");
      // Reload preview after a delay to let generation finish
      setTimeout(() => {
        const iframe = document.getElementById("prototype-preview") as HTMLIFrameElement | null;
        iframe?.contentWindow?.location.reload();
        setRefreshing(false);
      }, 5000);
    } catch {
      setRefreshing(false);
    }
  };

  if (active) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-3 p-4 border-b" style={{ backgroundColor: "#fff" }}>
          <button onClick={() => setActive(null)} className="text-sm">← Back</button>
          <span className="font-semibold">{active.name}</span>
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: active.status === "done" ? "#dcfce7" : "#fef3c7", color: active.status === "done" ? "#16a34a" : "#b45309" }}>
            {active.status}
          </span>
          <a href={active.previewUrl ?? `/p/${active.shareId}/`} target="_blank" rel="noreferrer" className="text-sm underline ml-auto">Share link</a>
        </div>
        <div className="flex-1 flex">
          <div className="flex-1">
            <iframe
              id="prototype-preview"
              src={active.previewUrl ?? `/p/${active.shareId}/`}
              className="w-full h-full border-0"
              title="prototype preview"
            />
          </div>
          <div className="w-80 border-l p-4 flex flex-col" style={{ backgroundColor: "#F4EBE1" }}>
            <h3 className="font-semibold mb-3">Iterate</h3>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border mb-3"
              rows={4}
              placeholder="Change the dashboard chart to a line chart..."
            />
            <button
              onClick={regenerate}
              disabled={refreshing}
              className="px-4 py-2 rounded-full text-white font-semibold"
              style={{ backgroundColor: "#f91814", opacity: refreshing ? 0.5 : 1 }}
            >
              {refreshing ? "Applying..." : "Apply Change"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#F4EBE1", minHeight: "100vh" }}>
      <PrototypeForm onCreated={(p) => { setPrototypes([p, ...prototypes]); setActive(p); }} />
      {prototypes.length > 0 && (
        <div className="max-w-2xl mx-auto px-6 pb-8">
          <h2 className="text-xl mb-4 font-semibold">Your Prototypes</h2>
          <div className="flex flex-col gap-3">
            {prototypes.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p)}
                className="flex items-center justify-between p-4 rounded-xl bg-white border"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-xs" style={{ color: p.status === "done" ? "#16a34a" : "#b45309" }}>{p.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
