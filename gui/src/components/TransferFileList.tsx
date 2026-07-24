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
    <ul className="transfer-file-list" aria-live="polite">
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
              isActive ? "transfer-file-active" : "",
              isDone ? "transfer-file-done" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {showCheckmarks && (
              <span className="transfer-file-check" aria-hidden>
                {isDone ? "✓" : "·"}
              </span>
            )}
            <span className="path-name" title={p}>
              {name}
            </span>
            {sizeText && (
              <span className="transfer-file-size">{sizeText}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
