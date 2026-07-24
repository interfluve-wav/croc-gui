import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { downloadDir } from "@tauri-apps/api/path";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import QRCode from "qrcode";
import { applyProxyFieldNormalization } from "./proxyPaste";
import { SharePhraseBlock } from "./components/SharePhraseBlock";
import { TransferFileList } from "./components/TransferFileList";
import { TransferProgressBlock } from "./components/TransferProgressBlock";
import {
  getActiveFileBasename,
  getTransferUiPhase,
} from "./progressDisplay";
import {
  buildCliReceiveCommand,
  buildReceiveUrl,
  GETCROC_RELAY,
  normalizeCodePhrase,
  parseReceiveInput,
  relayHandshakeErrorMessage,
  sanitizeCodePhrase,
} from "./shareLink";
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

type CopiedKind = "link" | "phrase" | "command" | null;

const GUI_VERSION = "0.1.6";
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

function applyReceivePaste(
  raw: string,
  setCodeInput: (code: string) => void,
  setOptions: Dispatch<SetStateAction<TransferOptions>>,
  setRememberRelayPass: (remember: boolean) => void,
  setError: (error: string | null) => void,
): boolean {
  const parsed = parseReceiveInput(raw);
  if (!parsed?.code) return false;
  const sanitized = sanitizeCodePhrase(parsed.code);
  if (!sanitized) {
    setError("Could not read a valid croc code from that paste.");
    return false;
  }
  setCodeInput(sanitized.code);
  if (sanitized.changed) {
    setError("Removed invalid characters from the code phrase.");
  }
  if (parsed.relay !== undefined) {
    setOptions((o) => ({ ...o, relay: parsed.relay ?? "" }));
  }
  if (parsed.relayPass !== undefined) {
    setOptions((o) => ({ ...o, relayPass: parsed.relayPass ?? "" }));
    if (parsed.relayPass) setRememberRelayPass(true);
  }
  if (!sanitized.changed) {
    setError(null);
  }
  return true;
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
  /** Snapshot of send paths when a transfer starts (stable UI during run). */
  const [transferPaths, setTransferPaths] = useState<string[]>([]);
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
  const [completedFiles, setCompletedFiles] = useState<Set<string>>(
    () => new Set(),
  );
  const [logExpanded, setLogExpanded] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const prevActiveFile = useRef<string | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<number | null>(null);
  const lastProgressAt = useRef<number | null>(null);
  const finishTimer = useRef<number | null>(null);
  const modeRef = useRef(mode);
  const runningRef = useRef(false);
  const phaseRef = useRef(phase);
  const aboutOpenRef = useRef(aboutOpen);

  const running = phase === "running";
  modeRef.current = mode;
  runningRef.current = running;
  phaseRef.current = phase;
  aboutOpenRef.current = aboutOpen;

  useEffect(() => {
    if (
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("capture")
    ) {
      return;
    }
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

  /** Dev-only: `?capture=receive|about|options|progress` for docs screenshots (Vite/Playwright). */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const cap = new URLSearchParams(window.location.search).get("capture");
    if (!cap) return;

    const isTauri =
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
    if (!isTauri) {
      setBinPath("bundled");
      setBinError(null);
      setCrocVersion("10.6.0");
    }

    if (cap === "receive") setMode("receive");
    if (cap === "about") setAboutOpen(true);
    if (cap === "options") setOptionsOpen(true);
    if (cap === "send") setMode("send");
    if (cap === "progress") {
      setMode("send");
      const demoPaths = ["/demo/sample-document.pdf"];
      setPaths(demoPaths);
      setTransferPaths(demoPaths);
      setPhrase("demo-lunar-cedar-piano");
      setPhase("running");
      setProgress({
        percent: 42,
        bytesDone: 2_097_152,
        bytesTotal: 5_242_880,
        speed: "1.2 MB/s",
        phase: "transferring",
        label: "Sending demo-document.pdf",
      });
      setLog([
        "Sending 1 files (5.0 MB)",
        "Sending 'demo-document.pdf' (5.0 MB)",
        "Code is: demo-lunar-cedar-piano",
        "On the other computer run:",
        "croc demo-lunar-cedar-piano",
      ]);
    }
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
        const handshakeErr = relayHandshakeErrorMessage(line);
        if (handshakeErr) {
          setError(handshakeErr);
        }
        if (line.includes("On UNIX systems, to receive with croc")) {
          setError(
            "Receive failed: croc needs the code via CROC_SECRET. Rebuild or update the app.",
          );
        }
        if (
          phaseRef.current === "running" &&
          (line.includes("[error]") ||
            line.includes("read-only file system") ||
            handshakeErr != null)
        ) {
          void invoke("finish_transfer").catch(() => undefined);
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
        void invoke("reset_transfer").catch(() => undefined);
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
    if (finishTimer.current != null) {
      window.clearTimeout(finishTimer.current);
      finishTimer.current = null;
    }
    if (phase !== "running") return;
    const atCapacity =
      progress.percent === 100 &&
      progress.bytesTotal != null &&
      progress.bytesDone != null &&
      progress.bytesDone >= progress.bytesTotal;
    if (!atCapacity) return;
    finishTimer.current = window.setTimeout(() => {
      finishTimer.current = null;
      void invoke("finish_transfer").catch(() => undefined);
    }, 2000);
    return () => {
      if (finishTimer.current != null) {
        window.clearTimeout(finishTimer.current);
        finishTimer.current = null;
      }
    };
  }, [phase, progress.percent, progress.bytesDone, progress.bytesTotal]);

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

  const shareLinkOptions = useMemo(
    () => ({
      relay: options.relay,
      relayPass: rememberRelayPass ? options.relayPass : "",
    }),
    [options.relay, options.relayPass, rememberRelayPass],
  );

  const receiveUrl = useMemo(
    () => (phrase ? buildReceiveUrl(phrase, shareLinkOptions) : null),
    [phrase, shareLinkOptions],
  );

  const cliReceiveCommand = useMemo(
    () =>
      phrase
        ? buildCliReceiveCommand(phrase, {
            ...shareLinkOptions,
            local: options.local,
          })
        : null,
    [phrase, shareLinkOptions, options.local],
  );

  useEffect(() => {
    let cancelled = false;
    if (!receiveUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(receiveUrl, {
      width: 360,
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
  }, [receiveUrl]);

  const showProgress =
    running &&
    (progress.percent != null ||
      progress.bytesDone != null ||
      progress.speed != null ||
      progress.phase != null);

  const progressPercent = useMemo(() => {
    if (progress.percent != null) {
      return Math.min(100, Math.max(0, progress.percent));
    }
    if (
      progress.bytesDone != null &&
      progress.bytesTotal != null &&
      progress.bytesTotal > 0
    ) {
      return Math.min(
        100,
        Math.max(0, (progress.bytesDone / progress.bytesTotal) * 100),
      );
    }
    return null;
  }, [progress.percent, progress.bytesDone, progress.bytesTotal]);

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
    if (age >= PROGRESS_STALL_HINT_MS) return "hint" as const;
    if (age >= PROGRESS_FINISHING_MS) return "finishing" as const;
    return null;
  }, [running, progress, progressTick]);

  const transferUiPhase = useMemo(
    () => getTransferUiPhase(progress, showProgress, progressStall, running),
    [progress, showProgress, progressStall, running],
  );

  useEffect(() => {
    if (!running) {
      setCompletedFiles(new Set());
      prevActiveFile.current = null;
      return;
    }
    const active = getActiveFileBasename(progress.label);
    if (
      active &&
      prevActiveFile.current &&
      active !== prevActiveFile.current
    ) {
      setCompletedFiles((prev) => new Set([...prev, prevActiveFile.current!]));
    }
    if (active) {
      prevActiveFile.current = active;
    }
  }, [running, progress.label]);

  useEffect(() => {
    if (phase === "completed") {
      setCompletedFiles(new Set(transferPaths.map(basename)));
    }
  }, [phase, transferPaths]);

  useEffect(() => {
    if (error || phase === "failed") {
      setLogExpanded(true);
    }
  }, [error, phase]);

  const canStart = useMemo(() => {
    if (running || binError) return false;
    if (mode === "send") return paths.length > 0;
    if (!codeInput.trim()) return false;
    if (!outDir.trim()) return false;
    if (options.zipAfterReceive && !outDir.trim()) return false;
    return true;
  }, [running, binError, mode, paths, codeInput, options.zipAfterReceive, outDir]);

  const startButtonTitle = useMemo(() => {
    if (canStart) return "Start transfer (⌘/Ctrl+Enter)";
    if (mode === "send") return "Add files to send";
    if (!outDir.trim()) return "Choose a download folder";
    return "Enter a code phrase";
  }, [canStart, mode, outDir]);

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

  async function promptReceiveFolder(): Promise<boolean> {
    let defaultPath = outDir.trim() || undefined;
    if (!defaultPath) {
      try {
        const downloads = await downloadDir();
        if (downloads) defaultPath = downloads;
      } catch {
        /* browser preview without Tauri path APIs */
      }
    }
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath,
      title: "Save received files to…",
    });
    if (typeof selected === "string") {
      setOutDir(selected);
      setError(null);
      return true;
    }
    return outDir.trim().length > 0;
  }

  function removePath(path: string) {
    setPaths((prev) => prev.filter((p) => p !== path));
  }

  async function onStart() {
    if (mode === "receive" && !outDir.trim()) {
      const picked = await promptReceiveFolder();
      if (!picked) return;
    }
    if (!canStart) return;

    setError(null);
    setLog([]);
    setCopied(null);
    setLogExpanded(false);
    setCompletedFiles(new Set());
    prevActiveFile.current = null;
    setOptionsOpen(false);
    setProgress(
      mode === "send"
        ? { ...emptyProgress(), phase: "waiting", label: "Preparing send…" }
        : { ...emptyProgress(), phase: "connecting", label: "Connecting…" },
    );
    lastProgressAt.current = Date.now();
    if (mode === "send") {
      setTransferPaths([...paths]);
    } else {
      setTransferPaths([]);
    }
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
      setTransferPaths([]);
      return;
    }

    try {
      const receiveCode =
        mode === "receive" ? sanitizeCodePhrase(codeInput.trim())?.code : null;
      if (mode === "receive" && !receiveCode) {
        setError(
          "Enter a valid croc code phrase (letters, numbers, and hyphens only).",
        );
        setPhase("idle");
        setTransferPaths([]);
        return;
      }
      await invoke("start_transfer", {
        request: {
          mode: mode === "send" ? "send" : "receive",
          paths: mode === "send" ? paths : [],
          code: receiveCode,
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
      setTransferPaths([]);
      setError(String(err));
    }
  }

  function clearTransferSelection() {
    setPaths([]);
    setTransferPaths([]);
    setPhrase(null);
    setCodeInput("");
  }

  async function endTransferSession(clearLog: boolean) {
    try {
      // Always kill silently — UI sets idle below; cancel_transfer is for the Cancel button only.
      await invoke("reset_transfer");
    } catch (err) {
      setError(String(err));
    }
    if (clearLog) {
      setLog([]);
    }
    setCopied(null);
    setProgress(emptyProgress());
    lastProgressAt.current = null;
    setPhase("idle");
  }

  async function resetAfterTransfer(opts?: { clearFiles?: boolean }) {
    const clearFiles = opts?.clearFiles ?? true;
    await endTransferSession(true);
    setError(null);
    setOptionsOpen(false);
    setPhrase(null);
    if (clearFiles) {
      clearTransferSelection();
    } else {
      // Keep paths for "Send same files again"; drop the transfer snapshot.
      setTransferPaths([]);
      if (mode === "receive") {
        setCodeInput("");
      }
    }
  }

  async function onStartAnotherTransfer() {
    await resetAfterTransfer({ clearFiles: true });
  }

  /** Keep the same files selected; clear session so a fresh code is generated. */
  async function onSendSameFilesAgain() {
    await resetAfterTransfer({ clearFiles: false });
  }

  async function onClearLog() {
    await resetAfterTransfer({ clearFiles: true });
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

  async function switchMode(next: Mode) {
    if (next === mode) return;
    await endTransferSession(false);
    setError(null);
    setDragOver(false);
    setCodeDragOver(false);
    setOptionsOpen(false);
    if (next === "send") {
      clearTransferSelection();
      setMode("send");
      return;
    }
    setPaths([]);
    setTransferPaths([]);
    setPhrase(null);
    const picked = await promptReceiveFolder();
    if (!picked) return;
    setMode("receive");
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
              onClick={() => void switchMode("send")}
              disabled={running}
            >
              Send
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "receive"}
              className={mode === "receive" ? "active" : ""}
              onClick={() => void switchMode("receive")}
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
      {phase === "completed" && mode === "receive" && (
        <div className="banner success" role="status">
          <span className="success-mark" aria-hidden>
            ✓
          </span>
          <span>Transfer completed successfully.</span>
          <button
            type="button"
            className="banner-action"
            onClick={() => void onStartAnotherTransfer()}
          >
            Start another transfer
          </button>
        </div>
      )}
      {phase === "cancelled" && (
        <div className="banner muted-banner" role="status">
          Transfer cancelled.
        </div>
      )}

      <main className="main">
        {mode === "send" ? (
          <section
            className={`panel send-panel${
              running ? " send-panel-active" : ""
            }${
              phase === "completed"
                ? " send-panel-sent"
                : !running && paths.length > 0
                  ? " send-panel-ready"
                  : ""
            }`}
            aria-labelledby="send-heading"
          >
            {running ? (
              <div className="transfer-stage">
                <div className="panel-head">
                  <h2 id="send-heading">Sending</h2>
                  <span className="count">{transferPaths.length} selected</span>
                </div>

                {phrase && transferUiPhase !== "preparing" && (
                    <SharePhraseBlock
                      phrase={phrase}
                      receiveUrl={receiveUrl}
                      qrDataUrl={qrDataUrl}
                      cliReceiveCommand={cliReceiveCommand}
                      variant={
                        transferUiPhase === "waiting" ? "prominent" : "compact"
                      }
                      copied={copied}
                      onCopy={(kind, text) => void copyText(kind, text)}
                      onOpenUrl={(url) => void openUrl(url)}
                    />
                  )}

                {transferUiPhase !== "waiting" && (
                  <TransferProgressBlock
                    progress={progress}
                    mode="send"
                    stall={progressStall}
                    running={running}
                    showProgress={showProgress}
                    computedPercent={progressPercent}
                    formatBytes={formatBytes}
                    hero={
                      transferUiPhase === "transferring" ||
                      transferUiPhase === "finishing"
                    }
                    uiPhase={transferUiPhase}
                  />
                )}

                <TransferFileList
                  paths={transferPaths}
                  progressLabel={progress.label}
                  completedFiles={completedFiles}
                  transferComplete={false}
                  basename={basename}
                />

                <div className="panel-cta panel-cta-running">
                  <button
                    type="button"
                    className="danger primary-cta"
                    onClick={onCancel}
                    title="Cancel transfer (Esc)"
                  >
                    Cancel transfer
                  </button>
                </div>
              </div>
            ) : phase === "completed" ? (
              <div className="sent-stage">
                <div className="panel-head">
                  <h2 id="send-heading">Files sent</h2>
                  <span className="count success-count">
                    ✓ Transfer complete
                  </span>
                </div>
                <ul className="sent-file-list" aria-live="polite">
                  {(transferPaths.length > 0 ? transferPaths : paths).map(
                    (p) => (
                      <li key={p}>
                        <span className="path-name" title={p}>
                          {basename(p)}
                        </span>
                        <span className="path-full" title={p}>
                          {p}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
                <div className="panel-cta panel-cta-sent">
                  <button
                    type="button"
                    className="primary primary-cta"
                    onClick={() => void onStartAnotherTransfer()}
                  >
                    Start another transfer
                  </button>
                  <button
                    type="button"
                    className="ghost primary-cta-secondary"
                    onClick={() => void onSendSameFilesAgain()}
                    disabled={
                      (transferPaths.length > 0 ? transferPaths : paths)
                        .length === 0
                    }
                  >
                    Send same files again
                  </button>
                </div>
                <p className="sent-hint">
                  Start another for a clean slate, or send the same files with a
                  fresh code.
                </p>
              </div>
            ) : (
              <>
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
                  }`}
                  aria-label="Drop files or folders to send"
                >
                  {paths.length === 0 ? (
                    <div className="drop-empty">
                      <p className="drop-title">Drop files here</p>
                      <p className="drop-sub">
                        Files or folders — or use the buttons below
                      </p>
                      <div className="row">
                        <button type="button" onClick={pickSendPaths}>
                          Add files
                        </button>
                        <button type="button" onClick={pickSendFolder}>
                          Add folder
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row">
                        <button type="button" onClick={pickSendPaths}>
                          Add files
                        </button>
                        <button type="button" onClick={pickSendFolder}>
                          Add folder
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setPaths([])}
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
                              aria-label={`Remove ${basename(p)}`}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="drop-more">Drop more files here</p>
                    </>
                  )}
                </div>

                <div
                  className={`panel-cta${
                    paths.length > 0 ? " panel-cta-ready" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="primary primary-cta"
                    onClick={onStart}
                    disabled={!canStart}
                    title={startButtonTitle}
                  >
                    Start transfer
                  </button>
                  <span className="panel-cta-hint">
                    {paths.length > 0
                      ? `${paths.length} file${paths.length === 1 ? "" : "s"} ready`
                      : "Add files to continue"}
                  </span>
                </div>
              </>
            )}
          </section>
        ) : (
          <section
            className={`panel receive-panel${running ? " receive-panel-active" : ""}`}
            aria-labelledby="receive-heading"
          >
            <h2 id="receive-heading">{running ? "Receiving" : "Receive"}</h2>
            <div className="receive-destination">
              <div className="receive-destination-copy">
                <span className="receive-destination-label">Save to</span>
                <span
                  className="receive-destination-path"
                  title={outDir || undefined}
                >
                  {outDir.trim() ? outDir : "Choose a folder to continue"}
                </span>
              </div>
              {!running && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void promptReceiveFolder()}
                >
                  Change folder
                </button>
              )}
            </div>
            {running ? (
              <div className="transfer-stage">
                <TransferProgressBlock
                  progress={progress}
                  mode="receive"
                  stall={progressStall}
                  running={running}
                  showProgress={showProgress}
                  computedPercent={progressPercent}
                  formatBytes={formatBytes}
                  hero={
                    transferUiPhase === "transferring" ||
                    transferUiPhase === "finishing"
                  }
                  uiPhase={transferUiPhase}
                />

                <div className="panel-cta panel-cta-running">
                  <button
                    type="button"
                    className="danger primary-cta"
                    onClick={onCancel}
                    title="Cancel transfer (Esc)"
                  >
                    Cancel transfer
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                if (
                  applyReceivePaste(
                    text,
                    setCodeInput,
                    setOptions,
                    setRememberRelayPass,
                    setError,
                  )
                ) {
                  return;
                }
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
                  if (
                    applyReceivePaste(
                      text,
                      setCodeInput,
                      setOptions,
                      setRememberRelayPass,
                      setError,
                    )
                  ) {
                    e.preventDefault();
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
            <p className="hint receive-web-hint">
              Start receive here first, then send at{" "}
              <a href="https://getcroc.com/" target="_blank" rel="noreferrer">
                getcroc.com
              </a>{" "}
              with the same code. Uses relay{" "}
              <code>{GETCROC_RELAY}</code> when Options relay is blank.
            </p>
            {mode === "receive" &&
              (options.local ||
                options.relay.trim() ||
                options.relayPass.trim()) && (
                <p className="banner warn" role="status">
                  Custom relay, relay password, or LAN-only is enabled —{" "}
                  <strong>getcroc.com</strong> uses the public relay. Clear those
                  options to receive from the website.
                </p>
              )}

                <div
                  className={`panel-cta${
                    canStart ? " panel-cta-ready" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="primary primary-cta"
                    onClick={onStart}
                    disabled={!canStart}
                    title={startButtonTitle}
                  >
                    Start receive
                  </button>
                  <span className="panel-cta-hint">
                    {!outDir.trim()
                      ? "Choose a folder first"
                      : !codeInput.trim()
                        ? "Enter a code phrase"
                        : "Ready to receive"}
                  </span>
                </div>
              </>
            )}
          </section>
        )}

        {!running && phase !== "completed" && (
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
        )}

        {mode === "receive" && outDir && phase === "completed" && (
          <section className="actions actions-minimal">
            <button type="button" className="primary" onClick={openOutFolder}>
              Open folder
            </button>
            {!running && (
              <span className={`status status-${phase}`} aria-live="polite">
                {phaseLabel[phase]}
              </span>
            )}
          </section>
        )}

        {!running && phase !== "completed" && (
          <p className="workflow-status" aria-live="polite">
            <span className={`status status-${phase}`}>{phaseLabel[phase]}</span>
          </p>
        )}

        <section
          className={`panel log${logExpanded ? "" : " log-collapsed"}`}
          aria-labelledby="log-heading"
        >
          <div className="panel-head log-head">
            <button
              type="button"
              className="log-toggle"
              onClick={() => setLogExpanded((v) => !v)}
              aria-expanded={logExpanded}
            >
              <h2 id="log-heading">Status log</h2>
              {log.length > 0 && (
                <span className="count log-count">
                  {log.length} {log.length === 1 ? "line" : "lines"}
                </span>
              )}
              <span className="chevron" aria-hidden>
                {logExpanded ? "▾" : "▸"}
              </span>
            </button>
            {logExpanded && log.length > 0 && (
              <button
                type="button"
                className="ghost"
                onClick={() => void onClearLog()}
              >
                {phase === "idle" ? "Clear log" : "Clear & reset"}
              </button>
            )}
          </div>
          {logExpanded && (
            <pre ref={logRef}>
              {log.length
                ? log.join("\n")
                : running
                  ? "Waiting for croc output…"
                  : "Output from croc will appear here."}
            </pre>
          )}
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
            interfluve-wav
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
              and maintained by{" "}
              <button
                type="button"
                className="linkish"
                onClick={() =>
                  void openUrl("https://github.com/interfluve-wav")
                }
              >
                interfluve-wav
              </button>
              .
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
