import {
  getProgressBadge,
  getProgressBarPercent,
  getProgressDetail,
  getProgressStatus,
  getTransferUiPhase,
  type ProgressSlice,
  type ProgressStall,
  type TransferMode,
  type TransferUiPhase,
} from "../progressDisplay";

type TransferProgressBlockProps = {
  progress: ProgressSlice;
  mode: TransferMode;
  stall: ProgressStall;
  running: boolean;
  showProgress: boolean;
  computedPercent: number | null;
  formatBytes: (n: number) => string;
  /** Taller bar during active transfer */
  hero?: boolean;
  /** Hide badge in header when embedded in transfer card */
  showHeader?: boolean;
  uiPhase?: TransferUiPhase;
  /** Optional estimated seconds remaining */
  etaSeconds?: number | null;
};

function formatEtaSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 5) return "a moment";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${(m % 60).toString().padStart(2, "0")}m`;
  }
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function TransferProgressBlock({
  progress,
  mode,
  stall,
  running,
  showProgress,
  computedPercent,
  formatBytes,
  hero = false,
  showHeader = false,
  uiPhase: uiPhaseProp,
  etaSeconds,
}: TransferProgressBlockProps) {
  const uiPhase =
    uiPhaseProp ??
    getTransferUiPhase(progress, showProgress, stall, running);
  const statusLine = getProgressStatus(
    progress,
    mode,
    stall,
    uiPhase,
    computedPercent,
  );
  const badge = getProgressBadge(progress, mode, stall);
  const barPercent = getProgressBarPercent(progress, computedPercent);
  const detail = getProgressDetail(progress, mode, formatBytes);

  return (
    <div
      className={`flex flex-col gap-2${hero ? " py-1" : ""}`}
      aria-live="polite"
    >
      {showHeader && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest opacity-70">
            Progress
          </span>
          {badge && <span className="badge badge-sm badge-neutral">{badge}</span>}
        </div>
      )}
      {barPercent == null ? (
        <div
          className="progress progress-primary w-full"
          role="progressbar"
          aria-label={statusLine}
        />
      ) : (
        <progress
          className="progress progress-primary w-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={barPercent}
          aria-label={statusLine}
          value={barPercent}
          max={100}
        />
      )}
      <p className="text-sm font-medium text-base-content">{statusLine}</p>
      {etaSeconds != null && barPercent != null && barPercent < 100 && (
        <p className="text-xs opacity-70">
          ≈ {formatEtaSeconds(etaSeconds)} remaining
        </p>
      )}
      {detail && (
        <p className="text-xs opacity-70">{detail}</p>
      )}
      {stall === "hint" && (
        <p className="text-xs text-warning">
          Croc is still working — verifying data and waiting on the network.
          Large files can pause here for a minute or more.
        </p>
      )}
    </div>
  );
}
