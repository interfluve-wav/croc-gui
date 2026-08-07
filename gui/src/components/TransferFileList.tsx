import {
  getActiveFileBasename,
  parseFileFromCrocLabel,
} from "../progressDisplay";

type TransferFileListProps = {
  paths: string[];
  progressLabel: string | null;
  completedFiles: Set<string>;
  transferComplete: boolean;
  basename: (path: string) => string;
};

export function TransferFileList({
  paths,
  progressLabel,
  completedFiles,
  transferComplete,
  basename,
}: TransferFileListProps) {
  const activeBasename = getActiveFileBasename(progressLabel);
  const parsedLabel = parseFileFromCrocLabel(progressLabel);
  const showCheckmarks =
    paths.length > 1 &&
    (completedFiles.size > 0 || activeBasename != null);

  return (
    <ul className="flex flex-col gap-0.5" aria-live="polite">
      {paths.map((p) => {
        const name = basename(p);
        const isActive = activeBasename === name;
        const isDone = transferComplete || completedFiles.has(name);
        const sizeText =
          isActive && parsedLabel?.sizeText ? parsedLabel.sizeText : null;

        return (
          <li
            key={p}
            className={[
              "flex items-center gap-2 rounded-sm px-2 py-1 text-sm",
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-base-content",
              isDone ? "text-success opacity-80" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {showCheckmarks && (
              <span className="w-4 shrink-0 text-center font-mono" aria-hidden>
                {isDone ? "✓" : "·"}
              </span>
            )}
            <span className="truncate" title={p}>
              {name}
            </span>
            {sizeText && (
              <span className="ml-auto shrink-0 font-mono text-xs opacity-70">
                {sizeText}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
