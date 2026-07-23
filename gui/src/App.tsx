import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import QRCode from "qrcode";
import { applyProxyFieldNormalization } from "./proxyPaste";
import "./App.css";

type Mode = "send" | "receive";

type TransferOptions = {
  customCode: string;
  relay: string;
  relayPass: string;
  port: string;
  socks5: string;
  connect: string;
  overwrite: boolean;
  yes: boolean;
  /** Send: stage selection into one zip, then croc send that archive */
  zip: boolean;
  /** Receive: zip newly received items after success */
  zipAfterReceive: boolean;
  /** LAN-only: croc --local (no public relay) */
  local: boolean;
};

type LineEvent = {
  stream: string;
  line: string;
  code: string | null;
};

type ExitEvent = {
  code: number | null;
  cancelled: boolean;
};

type Phase = "idle" | "running" | "completed" | "failed" | "cancelled";

type Prefs = {
  outDir: string;
  relay: string;
  relayPass: string;
  rememberRelayPass: boolean;
  socks5: string;
  connect: string;
  rememberProxies: boolean;
};

type ProgressEvent = {
  percent: number | null;
  bytesDone: number | null;
  bytesTotal: number | null;
  speed: string | null;
  phase: string | null;
  label: string | null;
};

type ProgressState = {
  percent: number | null;
  bytesDone: number | null;
  bytesTotal: number | null;
  speed: string | null;
  phase: string | null;
  label: string | null;
};

type CopiedKind = "phrase" | "command" | null;

const GUI_VERSION = "0.1.1";
const PREFS_KEY = "croc-gui-prefs-v2";
const PREFS_KEY_V1 = "croc-gui-prefs-v1";

const defaultOptions = (): TransferOptions => ({
  customCode: "",
  relay: "",
  relayPass: "",
  port: "",
  socks5: "",
  connect: "",
  overwrite: false,
  yes: true,
  zip: false,
  zipAfterReceive: false,
  local: false,
});

const emptyProgress = (): ProgressState => ({
  percent: null,
  bytesDone: null,
  bytesTotal: null,
  speed: null,
  phase: null,
  label: null,
});

const progressPhaseLabel: Record<string, string> = {
  connecting: "Connecting…",
  preparing: "Preparing…",
  checking: "Checking…",
  sending: "Sending…",
  receiving: "Receiving…",
  transferring: "Transferring…",
  finishing: "Finishing…",
  waiting: "Waiting for receiver…",
};

/** After this long at ≥98% with no new output, show "Finishing…" */
const PROGRESS_FINISHING_MS = 3_000;
/** After this long at ≥98%, show a hint that croc may still be working */
const PROGRESS_STALL_HINT_MS = 30_000;

const phaseLabel: Record<Phase, string> = {
  idle: "Ready",
  running: "Transferring…",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

/** Normalize pasted/dropped text into a croc code phrase. */
function normalizeCodePhrase(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  const firstLine = s.split(/\r?\n/).find((line) => line.trim()) ?? s;
  s = firstLine.trim();
  const crocCmd = s.match(/^croc\s+(.+)$/i);
  if (crocCmd?.[1]) {
    s = crocCmd[1].trim();
  }
  // Prefer the first whitespace-separated token (phrases are usually hyphenated).
  const token = s.split(/\s+/).find((t) => t.length > 0);
  return (token ?? s).replace(/^['"]+|['"]+$/g, "");
}

function normalizeProxyField(
  value: string,
  protocol: "socks5" | "http",
): string {
  return applyProxyFieldNormalization(value, protocol) ?? value;
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = value >= 100 || unit === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function loadPrefs(): Prefs {
  const defaults: Prefs = {
    outDir: "",
    relay: "",
    relayPass: "",
    rememberRelayPass: false,
    socks5: "",
    connect: "",
    rememberProxies: false,
  };
  try {
    const raw =
      localStorage.getItem(PREFS_KEY) ?? localStorage.getItem(PREFS_KEY_V1);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      outDir: typeof parsed.outDir === "string" ? parsed.outDir : "",
      relay: typeof parsed.relay === "string" ? parsed.relay : "",
      relayPass:
        typeof parsed.relayPass === "string" ? parsed.relayPass : "",
      rememberRelayPass: parsed.rememberRelayPass === true,
      socks5: typeof parsed.socks5 === "string" ? parsed.socks5 : "",
      connect: typeof parsed.connect === "string" ? parsed.connect : "",
      rememberProxies: parsed.rememberProxies === true,
    };
  } catch {
    return defaults;
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private mode */
  }
}

function App() {
  const initialPrefs = useMemo(() => loadPrefs(), []);
  const [mode, setMode] = useState<Mode>("send");
  const [paths, setPaths] = useState<string[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [outDir, setOutDir] = useState(initialPrefs.outDir);
  const [options, setOptions] = useState<TransferOptions>(() => ({
    ...defaultOptions(),
    relay: initialPrefs.relay,
    relayPass: initialPrefs.rememberRelayPass ? initialPrefs.relayPass : "",
    socks5: initialPrefs.rememberProxies ? initialPrefs.socks5 : "",
    connect: initialPrefs.rememberProxies ? initialPrefs.connect : "",
  }));
  const [rememberRelayPass, setRememberRelayPass] = useState(
    initialPrefs.rememberRelayPass,
  );
  const [rememberProxies, setRememberProxies] = useState(
    initialPrefs.rememberProxies,
  );
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopiedKind>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [binPath, setBinPath] = useState<string | null>(null);
  const [binError, setBinError] = useState<string | null>(null);
  const [crocVersion, setCrocVersion] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [codeDragOver, setCodeDragOver] = useState(false);
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [progressTick, setProgressTick] = useState(0);
  const logRef = useRef<HTMLPreElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<number | null>(null);
  const lastProgressAt = useRef<number | null>(null);
  const modeRef = useRef(mode);
  const runningRef = useRef(false);
  const aboutOpenRef = useRef(aboutOpen);

  const running = phase === "running";
  modeRef.current = mode;
  runningRef.current = running;
  aboutOpenRef.current = aboutOpen;

  useEffect(() => {
    invoke<string>("croc_bin_status")
      .then((path) => {
        setBinPath(path);
        setBinError(null);
      })
      .catch((err: unknown) => {
        setBinPath(null);
        setBinError(String(err));
      });

    invoke<string>("croc_version")
      .then((v) => setCrocVersion(v))
      .catch(() => setCrocVersion(null));
  }, []);

  useEffect(() => {
    savePrefs({
      outDir,
      relay: options.relay,
      relayPass: rememberRelayPass ? options.relayPass : "",
      rememberRelayPass,
      socks5: rememberProxies ? options.socks5 : "",
      connect: rememberProxies ? options.connect : "",
      rememberProxies,
    });
  }, [
    outDir,
    options.relay,
    options.relayPass,
    options.socks5,
    options.connect,
    rememberRelayPass,
    rememberProxies,
  ]);

  // Tauri 2 file drag-drop → absolute paths (required for croc send).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const webview = getCurrentWebview();
        const win = getCurrentWindow();
        unlisten = await webview.onDragDropEvent(async (event) => {
          if (cancelled) return;
          const payload = event.payload;

          if (payload.type === "leave") {
            setDragOver(false);
            return;
          }

          if (
            modeRef.current !== "send" ||
            runningRef.current ||
            aboutOpenRef.current
          ) {
            setDragOver(false);
            return;
          }

          const zone = dropZoneRef.current;
          let overZone = true;
          if (
            zone &&
            (payload.type === "enter" ||
              payload.type === "over" ||
              payload.type === "drop")
          ) {
            try {
              const factor = await win.scaleFactor();
              const rect = zone.getBoundingClientRect();
              const x = payload.position.x / factor;
              const y = payload.position.y / factor;
              overZone =
                x >= rect.left &&
                x <= rect.right &&
                y >= rect.top &&
                y <= rect.bottom;
            } catch {
              overZone = true;
            }
          }

          if (payload.type === "enter" || payload.type === "over") {
            setDragOver(overZone);
            return;
          }

          if (payload.type === "drop") {
            setDragOver(false);
            if (!overZone) return;
            const next = payload.paths.filter((p) => p.trim().length > 0);
            if (next.length === 0) return;
            setPaths((prev) => Array.from(new Set([...prev, ...next])));
            setError(null);
          }
        });
      } catch (err) {
        console.error("Drag-drop listener failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let unlistenLine: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;

    (async () => {
      unlistenLine = await listen<LineEvent>("transfer-line", (event) => {
        const { line, code } = event.payload;
        setLog((prev) => [...prev.slice(-199), line]);
        if (code) {
          setPhrase(code);
        }
      });
      unlistenProgress = await listen<ProgressEvent>(
        "transfer-progress",
        (event) => {
          const p = event.payload;
          lastProgressAt.current = Date.now();
          setProgress((prev) => ({
            percent: p.percent ?? prev.percent,
            bytesDone: p.bytesDone ?? prev.bytesDone,
            bytesTotal: p.bytesTotal ?? prev.bytesTotal,
            speed: p.speed ?? prev.speed,
            phase: p.phase ?? prev.phase,
            label: p.label ?? prev.label,
          }));
        },
      );
      unlistenExit = await listen<ExitEvent>("transfer-exit", (event) => {
        lastProgressAt.current = null;
        if (event.payload.cancelled) {
          setPhase("cancelled");
          setProgress(emptyProgress());
        } else if (event.payload.code === 0) {
          setPhase("completed");
          setProgress((prev) => ({
            ...prev,
            percent: 100,
            phase: "finishing",
          }));
        } else {
          setPhase("failed");
          setProgress(emptyProgress());
          setError(
            `Transfer failed${
              event.payload.code != null ? ` (exit ${event.payload.code})` : ""
            }. Check the status log.`,
          );
        }
      });
    })();

    return () => {
      unlistenLine?.();
      unlistenProgress?.();
      unlistenExit?.();
    };
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => setProgressTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const el = logRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [log]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current != null) {
        window.clearTimeout(copiedTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!phrase) {
      setQrDataUrl(null);
      return;
    }
    const crocCommand = `croc ${phrase}`;
    QRCode.toDataURL(crocCommand, {
      width: 168,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1c1915", light: "#fffaf2" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [phrase]);

  const showProgress =
    running &&
    (progress.percent != null ||
      progress.bytesDone != null ||
      progress.speed != null ||
      progress.phase != null);

  const progressStall = useMemo(() => {
    void progressTick;
    if (!running || lastProgressAt.current == null) return null;
    const pct = progress.percent;
    const nearComplete =
      pct != null &&
      (pct >= 98 ||
        progress.phase === "finishing" ||
        (progress.bytesDone != null &&
          progress.bytesTotal != null &&
          progress.bytesDone >= progress.bytesTotal * 0.99));
    if (!nearComplete) return null;
    const age = Date.now() - lastProgressAt.current;
    if (age >= PROGRESS_STALL_HINT_MS) return "hint";
    if (age >= PROGRESS_FINISHING_MS) return "finishing";
    return null;
  }, [running, progress, progressTick]);

  const progressStatus = useMemo(() => {
    if (progressStall === "hint") {
      return mode === "send"
        ? "Waiting for receiver…"
        : "Verifying transfer…";
    }
    if (progressStall === "finishing" || progress.phase === "finishing") {
      return "Finishing…";
    }
    if (progress.label) return progress.label;
    if (progress.phase && progressPhaseLabel[progress.phase]) {
      return progressPhaseLabel[progress.phase];
    }
    return phaseLabel[phase];
  }, [progress.label, progress.phase, progressStall, phase, mode]);

  const progressDetail = useMemo(() => {
    const parts: string[] = [];
    if (progress.bytesDone != null && progress.bytesTotal != null) {
      parts.push(
        `${formatBytes(progress.bytesDone)} / ${formatBytes(progress.bytesTotal)}`,
      );
    } else if (progress.bytesDone != null) {
      parts.push(formatBytes(progress.bytesDone));
    }
    if (progress.speed) parts.push(progress.speed);
    return parts.join(" · ");
  }, [progress.bytesDone, progress.bytesTotal, progress.speed]);

  const canStart = useMemo(() => {
    if (running || binError) return false;
    if (mode === "send") return paths.length > 0;
    if (!codeInput.trim()) return false;
    if (options.zipAfterReceive && !outDir.trim()) return false;
    return true;
  }, [running, binError, mode, paths, codeInput, options.zipAfterReceive, outDir]);

  async function pickSendPaths() {
    const selected = await open({
      multiple: true,
      directory: false,
    });
    if (selected == null) return;
    const next = Array.isArray(selected) ? selected : [selected];
    setPaths((prev) => Array.from(new Set([...prev, ...next])));
  }

  async function pickSendFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (typeof selected === "string") {
      setPaths((prev) => Array.from(new Set([...prev, selected])));
    }
  }

  async function pickOutDir() {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (typeof selected === "string") {
      setOutDir(selected);
    }
  }

  function removePath(path: string) {
    setPaths((prev) => prev.filter((p) => p !== path));
  }

  async function onStart() {
    if (!canStart) return;

    setError(null);
    setLog([]);
    setCopied(null);
    setProgress(emptyProgress());
    lastProgressAt.current = Date.now();
    setPhrase(
      mode === "send" && options.customCode.trim()
        ? options.customCode.trim()
        : null,
    );
    setPhase("running");

    const portNum = options.port.trim()
      ? Number(options.port.trim())
      : undefined;
    if (
      options.port.trim() &&
      (!Number.isFinite(portNum) || (portNum ?? 0) <= 0)
    ) {
      setError("Port must be a positive number");
      setPhase("idle");
      return;
    }

    try {
      await invoke("start_transfer", {
        request: {
          mode: mode === "send" ? "send" : "receive",
          paths: mode === "send" ? paths : [],
          code: mode === "receive" ? codeInput.trim() : null,
          outDir: mode === "receive" ? outDir || null : null,
          options: {
            customCode: options.customCode.trim() || null,
            relay: options.relay.trim() || null,
            pass: options.relayPass.trim() || null,
            port: portNum ?? null,
            socks5: options.socks5.trim() || null,
            connect: options.connect.trim() || null,
            overwrite: options.overwrite,
            yes: options.yes,
            zip: options.zip,
            zipAfterReceive: options.zipAfterReceive,
            local: options.local,
          },
        },
      });
    } catch (err) {
      setPhase("idle");
      setError(String(err));
    }
  }

  async function onCancel() {
    try {
      await invoke("cancel_transfer");
    } catch (err) {
      setError(String(err));
    }
  }

  async function copyText(kind: Exclude<CopiedKind, null>, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      if (copiedTimer.current != null) {
        window.clearTimeout(copiedTimer.current);
      }
      copiedTimer.current = window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  async function openOutFolder() {
    if (!outDir) return;
    try {
      await revealItemInDir(outDir);
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;

      if (e.key === "Escape") {
        if (aboutOpen) {
          e.preventDefault();
          setAboutOpen(false);
          return;
        }
        if (running) {
          e.preventDefault();
          void onCancel();
        }
        return;
      }

      if (
        e.key === "Enter" &&
        (e.metaKey || e.ctrlKey) &&
        canStart &&
        !inField &&
        !aboutOpen
      ) {
        e.preventDefault();
        void onStart();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [running, canStart, mode, paths, codeInput, outDir, options, phase, aboutOpen]);

  function switchMode(next: Mode) {
    if (running || next === mode) return;
    setMode(next);
    setError(null);
    setPhase("idle");
    setDragOver(false);
    setCodeDragOver(false);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <h1>Croc</h1>
          <p className="tagline">Send and receive files with a short code</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="ghost about-btn"
            onClick={() => setAboutOpen(true)}
          >
            About
          </button>
          <div className="mode-toggle" role="tablist" aria-label="Mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "send"}
              className={mode === "send" ? "active" : ""}
              onClick={() => switchMode("send")}
              disabled={running}
            >
              Send
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "receive"}
              className={mode === "receive" ? "active" : ""}
              onClick={() => switchMode("receive")}
              disabled={running}
            >
              Receive
            </button>
          </div>
        </div>
      </header>

      {binError && (
        <div className="banner error" role="alert">
          Bundled croc missing. Run <code>npm run bundle:croc</code> and rebuild.
          <span className="banner-detail">{binError}</span>
        </div>
      )}
      {error && (
        <div className="banner error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="banner-dismiss"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}
      {phase === "completed" && (
        <div className="banner success" role="status">
          <span className="success-mark" aria-hidden>
            ✓
          </span>
          Transfer completed successfully.
        </div>
      )}
      {phase === "cancelled" && (
        <div className="banner muted-banner" role="status">
          Transfer cancelled.
        </div>
      )}

      <main className="main">
        {mode === "send" ? (
          <section className="panel" aria-labelledby="send-heading">
            <div className="panel-head">
              <h2 id="send-heading">Files to send</h2>
              {paths.length > 0 && (
                <span className="count">{paths.length} selected</span>
              )}
            </div>

            <div
              ref={dropZoneRef}
              className={`drop-zone${dragOver ? " drag-over" : ""}${
                paths.length === 0 ? " drop-zone-empty" : ""
              }${running ? " drop-zone-disabled" : ""}`}
              aria-label="Drop files or folders to send"
            >
              {paths.length === 0 ? (
                <div className="drop-empty">
                  <p className="drop-title">Drop files here</p>
                  <p className="drop-sub">
                    Files or folders — or use the buttons below
                  </p>
                  <div className="row">
                    <button
                      type="button"
                      onClick={pickSendPaths}
                      disabled={running}
                    >
                      Add files
                    </button>
                    <button
                      type="button"
                      onClick={pickSendFolder}
                      disabled={running}
                    >
                      Add folder
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row">
                    <button
                      type="button"
                      onClick={pickSendPaths}
                      disabled={running}
                    >
                      Add files
                    </button>
                    <button
                      type="button"
                      onClick={pickSendFolder}
                      disabled={running}
                    >
                      Add folder
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setPaths([])}
                      disabled={running}
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="path-list">
                    {paths.map((p) => (
                      <li key={p}>
                        <span className="path-name" title={p}>
                          {basename(p)}
                        </span>
                        <span className="path-full" title={p}>
                          {p}
                        </span>
                        <button
                          type="button"
                          className="ghost path-remove"
                          onClick={() => removePath(p)}
                          disabled={running}
                          aria-label={`Remove ${basename(p)}`}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!running && (
                    <p className="drop-more">Drop more files here</p>
                  )}
                </>
              )}
            </div>
          </section>
        ) : (
          <section className="panel" aria-labelledby="receive-heading">
            <h2 id="receive-heading">Receive</h2>
            <label
              className={`field code-field${codeDragOver ? " drag-over" : ""}`}
              onDragEnter={(e) => {
                if (running) return;
                if (
                  e.dataTransfer.types.includes("text/plain") ||
                  e.dataTransfer.types.includes("text")
                ) {
                  e.preventDefault();
                  setCodeDragOver(true);
                }
              }}
              onDragOver={(e) => {
                if (running) return;
                if (
                  e.dataTransfer.types.includes("text/plain") ||
                  e.dataTransfer.types.includes("text")
                ) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setCodeDragOver(true);
                }
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setCodeDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setCodeDragOver(false);
                if (running) return;
                const text =
                  e.dataTransfer.getData("text/plain") ||
                  e.dataTransfer.getData("text");
                const next = normalizeCodePhrase(text);
                if (next) {
                  setCodeInput(next);
                  setError(null);
                }
              }}
            >
              <span>Code phrase</span>
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Paste or drop a code — e.g. mango-lake-42"
                disabled={running}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  const next = normalizeCodePhrase(text);
                  if (
                    next &&
                    (/^croc\s+/i.test(text.trim()) ||
                      text.includes("\n") ||
                      text.trim() !== next)
                  ) {
                    e.preventDefault();
                    setCodeInput(next);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canStart) {
                    e.preventDefault();
                    void onStart();
                  }
                }}
              />
            </label>
            <label className="field">
              <span>Download folder</span>
              <div className="row grow">
                <input
                  value={outDir}
                  onChange={(e) => setOutDir(e.target.value)}
                  placeholder={
                    options.zipAfterReceive
                      ? "Required when zipping after receive"
                      : "Optional — remembered between launches"
                  }
                  disabled={running}
                />
                <button type="button" onClick={pickOutDir} disabled={running}>
                  Browse
                </button>
              </div>
            </label>
          </section>
        )}

        <section className="panel options-panel">
          <button
            type="button"
            className="options-toggle"
            onClick={() => setOptionsOpen((v) => !v)}
            aria-expanded={optionsOpen}
          >
            <span>Options</span>
            <span className="chevron" aria-hidden>
              {optionsOpen ? "▾" : "▸"}
            </span>
          </button>
          {optionsOpen && (
            <div className="options">
              {mode === "send" && (
                <label className="field">
                  <span>Custom code (min 6 characters)</span>
                  <input
                    value={options.customCode}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, customCode: e.target.value }))
                    }
                    disabled={running}
                    spellCheck={false}
                    placeholder="Leave blank to generate"
                  />
                </label>
              )}
              <label className="field">
                <span>Relay (remembered)</span>
                <input
                  value={options.relay}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, relay: e.target.value }))
                  }
                  placeholder="optional host:port"
                  disabled={running}
                  spellCheck={false}
                />
              </label>
              <label className="field">
                <span>Relay password</span>
                <input
                  type="password"
                  value={options.relayPass}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, relayPass: e.target.value }))
                  }
                  placeholder="optional — for private relays"
                  disabled={running}
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={rememberRelayPass}
                  onChange={(e) => setRememberRelayPass(e.target.checked)}
                  disabled={running}
                />
                Remember relay password with relay host
              </label>
              {mode === "send" && (
                <label className="field">
                  <span>Base port</span>
                  <input
                    value={options.port}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, port: e.target.value }))
                    }
                    placeholder="9009"
                    disabled={running}
                    inputMode="numeric"
                  />
                </label>
              )}
              <div className="checks">
                {mode === "send" && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={options.zip}
                      onChange={(e) =>
                        setOptions((o) => ({ ...o, zip: e.target.checked }))
                      }
                      disabled={running}
                    />
                    Zip all items before sending
                  </label>
                )}
                {mode === "send" && options.zip && (
                  <p className="check-hint">
                    Packs the whole selection (files, folders, or both) into one
                    archive, then sends that zip.
                  </p>
                )}
                {mode === "receive" && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={options.zipAfterReceive}
                      onChange={(e) =>
                        setOptions((o) => ({
                          ...o,
                          zipAfterReceive: e.target.checked,
                        }))
                      }
                      disabled={running}
                    />
                    Zip newly received files after transfer
                  </label>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={options.yes}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, yes: e.target.checked }))
                    }
                    disabled={running}
                  />
                  Auto-confirm prompts (--yes)
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={options.overwrite}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        overwrite: e.target.checked,
                      }))
                    }
                    disabled={running}
                  />
                  Overwrite existing files
                </label>
                <label className="check check-stack">
                  <span className="check-row">
                    <input
                      type="checkbox"
                      checked={options.local}
                      onChange={(e) =>
                        setOptions((o) => ({ ...o, local: e.target.checked }))
                      }
                      disabled={running}
                    />
                    Local-only (--local)
                  </span>
                  <span className="check-hint">
                    LAN discovery only — skips the public relay. Enable on both
                    sides (same network).
                  </span>
                </label>
              </div>
              {mode === "receive" && options.zipAfterReceive && !outDir.trim() && (
                <p className="option-hint">
                  Choose a download folder to enable zip-after-receive.
                </p>
              )}

              <button
                type="button"
                className="options-toggle advanced-toggle"
                onClick={() => setAdvancedOpen((v) => !v)}
                aria-expanded={advancedOpen}
              >
                <span>Advanced network</span>
                <span className="chevron" aria-hidden>
                  {advancedOpen ? "▾" : "▸"}
                </span>
              </button>
              {advancedOpen && (
                <div className="advanced-options">
                  <label className="field">
                    <span>SOCKS5 proxy</span>
                    <input
                      value={options.socks5}
                      onChange={(e) =>
                        setOptions((o) => ({ ...o, socks5: e.target.value }))
                      }
                      onPaste={(e) => {
                        const text = e.clipboardData.getData("text");
                        const next = normalizeProxyField(text, "socks5");
                        if (next !== text.trim()) {
                          e.preventDefault();
                          setOptions((o) => ({ ...o, socks5: next }));
                        }
                      }}
                      onBlur={(e) => {
                        const next = normalizeProxyField(
                          e.target.value,
                          "socks5",
                        );
                        if (next !== e.target.value) {
                          setOptions((o) => ({ ...o, socks5: next }));
                        }
                      }}
                      placeholder="host:port:user:pass or socks5://…"
                      disabled={running}
                      spellCheck={false}
                    />
                  </label>
                  <label className="field">
                    <span>HTTP proxy</span>
                    <input
                      value={options.connect}
                      onChange={(e) =>
                        setOptions((o) => ({ ...o, connect: e.target.value }))
                      }
                      onPaste={(e) => {
                        const text = e.clipboardData.getData("text");
                        const next = normalizeProxyField(text, "http");
                        if (next !== text.trim()) {
                          e.preventDefault();
                          setOptions((o) => ({ ...o, connect: next }));
                        }
                      }}
                      onBlur={(e) => {
                        const next = normalizeProxyField(
                          e.target.value,
                          "http",
                        );
                        if (next !== e.target.value) {
                          setOptions((o) => ({ ...o, connect: next }));
                        }
                      }}
                      placeholder="host:port:user:pass or http://…"
                      disabled={running}
                      spellCheck={false}
                    />
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={rememberProxies}
                      onChange={(e) => setRememberProxies(e.target.checked)}
                      disabled={running}
                    />
                    Remember proxy settings
                  </label>
                  <p className="check-hint">
                    Maps to croc <code>--socks5</code> and <code>--connect</code>.
                    Paste <code>host:port:user:pass</code> or a full proxy URL —
                    credentials are converted on paste or when you leave the field.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {phrase && (
          <section className="panel phrase" aria-live="polite">
            <div className="panel-head">
              <h2>Code phrase</h2>
              <span className="hint">Share this with the receiver</span>
            </div>
            <div className="phrase-layout">
              <div className="phrase-main">
                <div className="phrase-row">
                  <code>{phrase}</code>
                </div>
                <div className="row phrase-actions">
                  <button
                    type="button"
                    className={copied === "phrase" ? "copied" : ""}
                    onClick={() => void copyText("phrase", phrase)}
                  >
                    {copied === "phrase" ? "Copied" : "Copy phrase"}
                  </button>
                  <button
                    type="button"
                    className={copied === "command" ? "copied" : ""}
                    onClick={() => void copyText("command", `croc ${phrase}`)}
                  >
                    {copied === "command" ? "Copied" : "Copy croc command"}
                  </button>
                </div>
              </div>
              {qrDataUrl && (
                <figure className="qr">
                  <img src={qrDataUrl} alt={`QR code for croc ${phrase}`} />
                  <figcaption>Scan for full croc command</figcaption>
                </figure>
              )}
            </div>
          </section>
        )}

        <section className="actions">
          {!running ? (
            <button
              type="button"
              className="primary"
              onClick={onStart}
              disabled={!canStart}
              title={
                canStart
                  ? "Start transfer (⌘/Ctrl+Enter)"
                  : mode === "send"
                    ? "Add files to send"
                    : options.zipAfterReceive && !outDir.trim()
                      ? "Choose a download folder for zip-after-receive"
                      : "Enter a code phrase"
              }
            >
              Start
            </button>
          ) : (
            <button
              type="button"
              className="danger"
              onClick={onCancel}
              title="Cancel transfer (Esc)"
            >
              Cancel
            </button>
          )}
          {mode === "receive" && outDir && phase === "completed" && (
            <button type="button" onClick={openOutFolder}>
              Open folder
            </button>
          )}
          <span className={`status status-${phase}`} aria-live="polite">
            {running && <span className="pulse" aria-hidden />}
            {running && showProgress ? progressStatus : phaseLabel[phase]}
          </span>
        </section>

        {showProgress && (
          <section className="panel progress-panel" aria-live="polite">
            <div className="panel-head">
              <h2>Transfer progress</h2>
              {progress.percent != null && (
                <span className="count">{progress.percent}%</span>
              )}
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent ?? undefined}
              aria-label={progressStatus}
            >
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, progress.percent ?? 0))}%`,
                }}
              />
            </div>
            {progressDetail && (
              <p className="progress-detail">{progressDetail}</p>
            )}
            {progressStall === "hint" && (
              <p className="progress-stall-hint">
                Croc is still working — verifying data and waiting on the
                network. Large files can pause here for a minute or more.
              </p>
            )}
          </section>
        )}

        <section className="panel log" aria-labelledby="log-heading">
          <div className="panel-head">
            <h2 id="log-heading">Status log</h2>
            {log.length > 0 && (
              <button
                type="button"
                className="ghost"
                onClick={() => setLog([])}
                disabled={running}
              >
                Clear log
              </button>
            )}
          </div>
          <pre ref={logRef}>
            {log.length
              ? log.join("\n")
              : running
                ? "Waiting for croc output…"
                : "Output from croc will appear here."}
          </pre>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-meta">
          {binPath ? (
            <span className="muted" title={binPath}>
              Using bundled croc
            </span>
          ) : (
            <span className="muted">croc binary not ready</span>
          )}
          <span className="muted shortcuts">
            {running ? "Esc cancel" : "⌘/Ctrl+Enter start"}
          </span>
        </div>
        <p className="credit">
          Powered by{" "}
          <button
            type="button"
            className="linkish"
            onClick={() => void openUrl("https://github.com/schollz/croc")}
          >
            schollz/croc
          </button>{" "}
          ·{" "}
          <button
            type="button"
            className="linkish"
            onClick={() => void openUrl("https://github.com/sponsors/schollz")}
          >
            Sponsor schollz
          </button>
        </p>
        <p className="credit credit-gui">
          GUI by{" "}
          <button
            type="button"
            className="linkish"
            onClick={() => void openUrl("https://github.com/interfluve-wav")}
          >
            Suhaas (interfluve-wav)
          </button>
          {" · "}
          <button
            type="button"
            className="linkish"
            onClick={() =>
              void openUrl("https://github.com/interfluve-wav/croc-gui")
            }
          >
            croc-gui
          </button>
        </p>
      </footer>

      {aboutOpen && (
        <div
          className="about-backdrop"
          role="presentation"
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="about-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <h2 id="about-title">About Croc GUI</h2>
              <button
                type="button"
                className="ghost"
                onClick={() => setAboutOpen(false)}
              >
                Close
              </button>
            </div>
            <dl className="about-meta">
              <div>
                <dt>GUI version</dt>
                <dd>{GUI_VERSION}</dd>
              </div>
              <div>
                <dt>GUI author</dt>
                <dd>
                  Suhaas /{" "}
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      void openUrl("https://github.com/interfluve-wav")
                    }
                  >
                    interfluve-wav
                  </button>
                </dd>
              </div>
              <div>
                <dt>Bundled croc</dt>
                <dd>{crocVersion ?? "Unknown"}</dd>
              </div>
              <div>
                <dt>Engine</dt>
                <dd>schollz/croc</dd>
              </div>
            </dl>
            <p className="about-blurb">
              Desktop wrapper around upstream croc — transfer protocol and CLI
              by Zack Scholl (schollz), not a reimplementation. This GUI is built
              and maintained by Suhaas (interfluve-wav).
            </p>
            <div className="row">
              <button
                type="button"
                onClick={() =>
                  void openUrl("https://github.com/interfluve-wav/croc-gui")
                }
              >
                croc-gui repo
              </button>
              <button
                type="button"
                onClick={() => void openUrl("https://github.com/schollz/croc")}
              >
                schollz/croc
              </button>
              <button
                type="button"
                onClick={() =>
                  void openUrl("https://github.com/sponsors/schollz")
                }
              >
                Sponsor schollz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
