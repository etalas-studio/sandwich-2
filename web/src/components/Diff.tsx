interface DiffProps {
  patch: string;
  highlightFile?: string | null;
  maxLines?: number;
}

export default function Diff({ patch, highlightFile, maxLines = 800 }: DiffProps) {
  const lines = patch.split("\n").slice(0, maxLines);
  const truncated = patch.split("\n").length > maxLines;

  let currentFile: string | null = null;

  return (
    <div className="diff">
      {lines.map((line, i) => {
        // Track current file from diff headers
        if (line.startsWith("diff --git ")) {
          const match = /^diff --git a\/(.+?) b\//.exec(line);
          if (match) currentFile = match[1] as string;
        }

        const cls =
          line.startsWith("+") && !line.startsWith("+++")
            ? "a"
            : line.startsWith("-") && !line.startsWith("---")
              ? "d"
              : line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index ")
                ? "h"
                : "";

        const isHighlighted = highlightFile && currentFile === highlightFile;

        return (
          <div
            className={cls}
            key={i}
            data-file={currentFile ?? undefined}
            style={isHighlighted ? { background: "var(--warn-bg)" } : undefined}
          >
            {line || " "}
          </div>
        );
      })}
      {truncated && <div className="diff-truncated">Output truncated. View full diff in the run directory.</div>}
    </div>
  );
}
