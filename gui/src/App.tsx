import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import QRCode from "qrcode";
import "./App.css";

type Mode = "send" | "receive";

type TransferOptions = {
  customCode: string;
  relay: string;
  port: string;
  overwrite: boolean;
  yes: boolean;
  /** Send: croc send --zip */
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
};

type CopiedKind = "phrase" | "command" | null;

const GUI_VERSION = "0.1.0";
const PREFS_KEY = "croc-gui-prefs-v1";

const defaultOptions = (): TransferOptions => ({
  customCode: "",
  relay: "",
  port: "",
  overwrite: false,
  yes: true,
  zip: false,
  zipAfterReceive: false,
  local: false,
});

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

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { outDir: "", relay: "" };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      outDir: typeof parsed.outDir === "string" ? parsed.outDir : "",
      relay: typeof parsed.relay === "string" ? parsed.relay : "",
    };
  } catch {
    return { outDir: "", relay: "" };
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
  }));
  const [optionsOpen, setOptionsOpen] = useState(false);
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
  const logRef = useRef<HTMLPreElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<number | null>(null);
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
    savePrefs({ outDir, relay: options.relay });
  }, [outDir, options.relay]);

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

    (async () => {
      unlistenLine = await listen<LineEvent>("transfer-line", (event) => {
        const { line, code } = event.payload;
        setLog((prev) => [...prev.slice(-199), line]);
        if (code) {
          setPhrase(code);
        }
      });
      unlistenExit = await listen<ExitEvent>("transfer-exit", (event) => {
        if (event.payload.cancelled) {
          setPhase("cancelled");
        } else if (event.payload.code === 0) {
          setPhase("completed");
        } else {
          setPhase("failed");
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
      unlistenExit?.();
    };
  }, []);

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
    QRCode.toDataURL(phrase, {
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
            port: portNum ?? null,
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
        <div>
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
                    Zip folder before sending (--zip)
                  </label>
                )}
                {mode === "send" && options.zip && (
                  <p className="check-hint">
                    Only applies to folders (Add folder / drop a directory). Individual
                    files are sent as-is — turn Zip off or add a folder.
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
                  <img src={qrDataUrl} alt={`QR code for ${phrase}`} />
                  <figcaption>Scan on phone</figcaption>
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
            {phaseLabel[phase]}
          </span>
        </section>

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
          GUI by{" "}
          <button
            type="button"
            className="linkish"
            onClick={() => void openUrl("https://github.com/interfluve-wav/croc-gui")}
          >
            Suhaas / interfluve-wav
          </button>
          {" · "}
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
                <dt>Bundled croc</dt>
                <dd>{crocVersion ?? "Unknown"}</dd>
              </div>
            </dl>
            <p className="about-blurb">
              <strong>Croc GUI</strong> — built by Suhaas / interfluve-wav.
              Desktop wrapper only; the transfer protocol and CLI remain
              upstream croc by Zack Scholl (schollz), not a reimplementation.
            </p>
            <dl className="about-meta">
              <div>
                <dt>croc (engine)</dt>
                <dd>schollz/croc</dd>
              </div>
              <div>
                <dt>Croc GUI</dt>
                <dd>Suhaas / interfluve-wav</dd>
              </div>
            </dl>
            <div className="row">
              <button
                type="button"
                onClick={() =>
                  void openUrl("https://github.com/interfluve-wav/croc-gui")
                }
              >
                This repo
              </button>
              <button
                type="button"
                onClick={() => void openUrl("https://suhaaschitturi.com")}
              >
                suhaaschitturi.com
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
