export type TabId = "board" | "queue" | "review" | "metrics" | "settings";

const TABS: Array<[TabId, string]> = [
  ["board", "Board"],
  ["queue", "Queue"],
  ["review", "Review"],
  ["metrics", "Metrics"],
  ["settings", "Settings"],
];

interface NavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  reviewCount: number;
}

export default function Nav({ active, onChange, reviewCount }: NavProps) {
  return (
    <nav>
      {TABS.map(([id, label]) => (
        <button key={id} className={active === id ? "on" : ""} onClick={() => onChange(id)}>
          {label}
          {id === "review" && reviewCount > 0 ? <span className="pill">{reviewCount}</span> : null}
        </button>
      ))}
    </nav>
  );
}
