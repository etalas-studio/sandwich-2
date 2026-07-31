import type { Metrics as MetricsType } from "../types";

function pct(v: number | null): string {
  return v === null || v === undefined ? "—" : `${String(Math.round(v * 100))}%`;
}

function mins(s: number | null): string {
  return s === null || s === undefined ? "—" : `${(s / 60).toFixed(1)} min`;
}

interface MetricsProps {
  metrics: MetricsType;
}

export default function Metrics({ metrics: m }: MetricsProps) {
  return (
    <>
      <div className="cards">
        <div className="kpi">
          <div className="k">Attempts</div>
          <div className="v">{m.total}</div>
        </div>
        <div className="kpi">
          <div className="k">Ready for review</div>
          <div className="v">{m.readyForReview}</div>
        </div>
        <div className="kpi">
          <div className="k">Attempt success</div>
          <div className="v">{pct(m.attemptSuccessRate)}</div>
          <div className="h">Week 3 target: 60%</div>
        </div>
        <div className="kpi">
          <div className="k">Autonomy rate</div>
          <div className="v">{pct(m.autonomyRate)}</div>
          <div className="h">of {m.autonomyDenominator} merged PRs · target 40%</div>
        </div>
        <div className="kpi">
          <div className="k">Median duration</div>
          <div className="v">{mins(m.medianDurationSec)}</div>
        </div>
      </div>
      <div className="two">
        <div className="panel">
          <h4>Outcomes</h4>
          <table>
            <tbody>
              {m.byOutcome.length > 0 ? (
                m.byOutcome.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="n">{v}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>none yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Gate lanes</h4>
          <table>
            <tbody>
              {m.byLane.length > 0 ? (
                m.byLane.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="n">{v}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>none yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="hint">
        Autonomy rate = percent of merged PRs that no human touched at all. What matters is the trend rising week over week,
        not the absolute number — with a dozen-odd attempts, one number doesn't mean much yet.
      </div>
    </>
  );
}
