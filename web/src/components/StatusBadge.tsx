import type { Column } from "../apiTypes";
import { COLUMN_LABEL } from "../apiTypes";

const COLUMN_STYLE: Record<Column, string> = {
  backlog:
    "bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] text-white/70 border-white/[0.05]",
  in_progress:
    "bg-gradient-to-b from-[#3a2e1d] to-[#241a10] text-[#f59e0b] border-[#5a4525]",
  blocked: "bg-gradient-to-b from-[#3a1d1d] to-[#241010] text-[#ff8a8a] border-[#522525]",
  ready_for_review:
    "bg-gradient-to-b from-[#1d3a24] to-[#102415] text-[#8affb1] border-[#2b5936]",
};

export default function StatusBadge({ column, label }: { column: Column; label?: string }) {
  return (
    <span
      className={`px-2.5 py-1 rounded text-xs font-normal tracking-wide border ${COLUMN_STYLE[column]}`}
      style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.1)" }}
    >
      {label ?? COLUMN_LABEL[column]}
    </span>
  );
}
