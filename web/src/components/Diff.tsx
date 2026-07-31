interface DiffProps {
  patch: string;
}

export default function Diff({ patch }: DiffProps) {
  const lines = patch.split("\n").slice(0, 600);
  return (
    <div className="diff">
      {lines.map((line, i) => {
        const cls = line.startsWith("+") && !line.startsWith("+++")
          ? "a"
          : line.startsWith("-") && !line.startsWith("---")
            ? "d"
            : line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index ")
              ? "h"
              : "";
        return (
          <div className={cls} key={i}>
            {line || " "}
          </div>
        );
      })}
    </div>
  );
}
