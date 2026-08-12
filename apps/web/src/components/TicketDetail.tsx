import { useEffect } from "react";
import { marked } from "marked";
import { XIcon } from "lucide-react";
import type { Ticket } from "../api/tickets";

type TicketSource = "jira" | "linear" | "github" | "internal";

const SOURCE_CONFIG: Record<
  TicketSource,
  { icon: string; label: string; color: string }
> = {
  jira: { icon: "simple-icons:jira", label: "Jira", color: "text-[#2684FF]" },
  linear: {
    icon: "simple-icons:linear",
    label: "Linear",
    color: "text-[#5E6AD2]",
  },
  github: {
    icon: "simple-icons:github",
    label: "GitHub",
    color: "text-white/70",
  },
  internal: {
    icon: "solar:document-linear",
    label: "Internal",
    color: "text-white/40",
  },
};

function getTicketSource(url: string | null): TicketSource {
  if (!url) return "internal";
  try {
    const host = new URL(url).host;
    if (host.includes("atlassian.net")) return "jira";
    if (host.includes("linear.app")) return "linear";
    if (host.includes("github.com")) return "github";
  } catch {
    /* fall through */
  }
  return "internal";
}

interface TicketDetailProps {
  ticket: Ticket;
  onClose: () => void;
  onDelete?: () => void;
}

export default function TicketDetail({
  ticket,
  onClose,
  onDelete,
}: TicketDetailProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-lg ds-bg border-l border-white/[0.05] z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-6 pb-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-white/40 font-mono">
                  {ticket.key}
                </span>
                {(() => {
                  const src = getTicketSource(ticket.url);
                  const cfg = SOURCE_CONFIG[src];
                  return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                      <iconify-icon
                        icon={cfg.icon}
                        width="10"
                        className={cfg.color}
                      />
                      <span className="text-[10px] text-white/30 font-normal">
                        {cfg.label}
                      </span>
                    </span>
                  );
                })()}
              </div>
              <h2 className="text-xl font-normal text-white ds-text-shadow">
                {ticket.summary || ticket.description}
              </h2>
            </div>
            <button
              className="text-white/40 hover:text-white transition-colors"
              onClick={onClose}
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* URL */}
          {ticket.url && (
            <a
              href={ticket.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-white/40 hover:text-white/70 hover:underline block mb-4 break-all"
            >
              {ticket.url}
            </a>
          )}

          {/* Description */}
          <div className="mb-8">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
              Description
            </div>
            <div
              className="text-base text-white/80 font-light leading-relaxed ticket-description"
              dangerouslySetInnerHTML={{
                __html: marked.parse(ticket.description, {
                  async: false,
                }) as string,
              }}
            />
          </div>

          {/* Generated Output */}
          {ticket.prDescription && (
            <div className="mb-8">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                Generated Output
              </div>
              <div
                className="text-base text-white/80 font-light leading-relaxed ticket-description"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(ticket.prDescription, {
                    async: false,
                  }) as string,
                }}
              />
            </div>
          )}

          {/* Empty state */}
          {ticket.status === "backlog" && (
            <div className="text-xs text-white/40 mb-6">
              Not yet generated.
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="shrink-0 p-4 pt-3 pb-5 border-t border-white/[0.05] bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f] to-[#0a0a0a]">
          <div className="flex gap-2 justify-end">
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center justify-center w-[38px] h-[38px] rounded-lg text-white/50 bg-white/[0.04] border border-white/[0.08] hover:text-[#ff8a8a] hover:border-[#ff8a8a]/30 transition-colors shrink-0"
              >
                <iconify-icon
                  icon="solar:trash-bin-trash-linear"
                  width="16"
                />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
