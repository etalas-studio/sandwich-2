import { useEffect, useState } from "react";
import { api } from "../api";
import type { ConfigResponse } from "../types";

export default function Settings() {
  const [cfg, setCfg] = useState<ConfigResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<ConfigResponse>("/api/config")
      .then(setCfg)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <div className="empty">Failed to load settings.</div>;
  if (!cfg) return <div className="empty">Loading…</div>;

  const { limits: L, laneRules: R } = cfg;

  return (
    <>
      <div className="two">
        <div className="panel">
          <h4>Safety limits</h4>
          <table>
            <tbody>
              <tr>
                <td>Files changed</td>
                <td className="n">{L.maxFilesChanged}</td>
              </tr>
              <tr>
                <td>Diff lines</td>
                <td className="n">{L.maxDiffLines}</td>
              </tr>
              <tr>
                <td>Plan timeout</td>
                <td className="n">{L.planTimeoutMs / 60000} min</td>
              </tr>
              <tr>
                <td>Implement timeout</td>
                <td className="n">{L.implementTimeoutMs / 60000} min</td>
              </tr>
              <tr>
                <td>rspec timeout</td>
                <td className="n">{L.rspecTimeoutMs / 60000} min</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Lane rules</h4>
          <table>
            <tbody>
              <tr>
                <td>Lane 1 (no review)</td>
                <td className="n">{R.lane1Enabled ? "ON" : "off"}</td>
              </tr>
              <tr>
                <td>Lane 1 diff limit</td>
                <td className="n">{R.lane1MaxDiffLines}</td>
              </tr>
              <tr>
                <td>Requires new specs</td>
                <td className="n">{R.lane1RequiresNewTests ? "yes" : "no"}</td>
              </tr>
            </tbody>
          </table>
          <div className="hint">
            Lane 1 is deliberately off during the pilot. The asymmetry: auto-merge saves a few hours, one bug slipping through
            in the GL domain can end the pilot.
          </div>
        </div>
      </div>
      <div className="panel">
        <h4>Blocklist · {cfg.blocklist.length} paths</h4>
        <table>
          <tbody>
            {cfg.blocklist.map((b) => (
              <tr key={b.pattern}>
                <td className="key">{b.pattern}</td>
                <td style={{ fontSize: 11, color: "var(--tx2)" }}>{b.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
