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
};

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
      className={`transfer-progress-block${hero ? " transfer-progress-hero" : ""}`}
      aria-live="polite"
    >
      {showHeader && (
        <div className="panel-head transfer-progress-head">
          <span className="transfer-progress-label">Progress</span>
          {badge && <span className="count">{badge}</span>}
        </div>
      )}
      <div
        className={`progress-track${
          barPercent == null ? " progress-track--indeterminate" : ""
        }`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={barPercent ?? undefined}
        aria-label={statusLine}
      >
        <div
          className={`progress-fill${
            barPercent == null ? " progress-fill--indeterminate" : ""
          }`}
          style={
            barPercent != null ? { width: `${barPercent}%` } : undefined
          }
        />
      </div>
      <p className="progress-detail progress-detail-primary">{statusLine}</p>
      {detail && (
        <p className="progress-detail progress-detail-secondary">{detail}</p>
      )}
      {stall === "hint" && (
        <p className="progress-stall-hint">
          Croc is still working — verifying data and waiting on the network.
          Large files can pause here for a minute or more.
        </p>
      )}
    </div>
  );
}
