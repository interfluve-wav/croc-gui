//! Machine-readable croc event consumer.
//!
//! Reads newline-delimited JSON events from croc's `--json` mode (stderr) and
//! maps them to Tauri-friendly payload structs. Falls back gracefully on
//! non-JSON lines (older croc versions, or pre-handshake status output).
//!
//! Event source: <https://github.com/schollz/croc/pull/1237> (croc v11+).
//!
//! Each event type from croc maps to a Tauri event:
//!   `version`  → `transfer-version` (informational, not currently emitted by Tauri)
//!   `code`     → `transfer-code` (sender only; the secret phrase)
//!   `phase`    → `transfer-phase` (hashing / connecting / transferring / complete)
//!   `progress` → `transfer-progress-v2` (bytesTransferred/bytesTotal/percent/speedBps)
//!   `complete` → `transfer-complete` (file list, success)
//!   `error`    → `transfer-error` (code + message + hint)
//!   `store`    → `transfer-store` (stored-transfer details; not yet surfaced)
//!
//! We keep the old `transfer-progress` (regex-parsed) and `transfer-line` (raw
//! text) events running in parallel so App.tsx can migrate at its own pace
//! and so we have a fallback if `--json` is rejected by an older croc.

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Read};

/// Raw croc event from the wire. Tolerant of extra/missing fields so a
/// future croc release adding a new field doesn't break the parser.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
#[serde(rename_all_fields = "camelCase")]
pub enum CrocEvent {
    Version {
        version: String,
    },
    Code {
        code: String,
    },
    #[serde(alias = "phase")]
    Phase {
        phase: String,
        #[serde(default)]
        message: Option<String>,
    },
    Progress {
        #[serde(default)]
        file: Option<String>,
        bytes_transferred: i64,
        bytes_total: i64,
        percent: f64,
        speed_bps: i64,
    },
    Complete {
        #[serde(default)]
        files: Vec<CompleteFile>,
    },
    Error {
        code: String,
        message: String,
        #[serde(default)]
        hint: Option<String>,
    },
    #[allow(dead_code)]
    Store {
        #[serde(default)]
        url: Option<String>,
        #[serde(default)]
        token: Option<String>,
        #[serde(default)]
        expires_at: Option<String>,
        #[serde(default)]
        revoke_id: Option<String>,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CompleteFile {
    pub name: String,
    pub bytes: i64,
}

/// Tauri-facing payload for `transfer-progress-v2`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgressV2 {
    pub percent: f64,
    pub bytes_done: i64,
    pub bytes_total: i64,
    pub speed_bps: i64,
    pub file: Option<String>,
}

impl From<CrocEvent> for Option<TransferProgressV2> {
    fn from(ev: CrocEvent) -> Self {
        match ev {
            CrocEvent::Progress {
                file,
                bytes_transferred,
                bytes_total,
                percent,
                speed_bps,
            } => Some(TransferProgressV2 {
                percent,
                bytes_done: bytes_transferred,
                bytes_total,
                speed_bps,
                file,
            }),
            _ => None,
        }
    }
}

/// Tauri-facing payload for `transfer-phase`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferPhase {
    pub phase: String,
    pub message: Option<String>,
}

/// Tauri-facing payload for `transfer-error`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferError {
    pub code: String,
    pub message: String,
    pub hint: Option<String>,
}

/// Tauri-facing payload for `transfer-complete`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferComplete {
    pub files: Vec<CompleteFile>,
}

/// Callback invoked for each parsed event. Tauri emission is handled by the
/// caller via this closure so this module stays UI-agnostic.
pub trait EventSink: Send + 'static {
    fn on_code(&mut self, code: String);
    fn on_phase(&mut self, phase: TransferPhase);
    fn on_progress(&mut self, progress: TransferProgressV2);
    fn on_complete(&mut self, complete: TransferComplete);
    fn on_error(&mut self, error: TransferError);
    fn on_unparsed(&mut self, raw_line: String);
}

/// Pump an NDJSON stream from croc's stderr. Each line is parsed as JSON;
/// non-JSON lines are forwarded via `on_unparsed` so the existing log
/// consumer still sees them (covers the brief pre-handshake window where
/// croc may print non-JSON status text).
pub fn pump_json_stream<R: Read + Send + 'static>(reader: R, mut sink: Box<dyn EventSink>) {
    std::thread::spawn(move || {
        pump_json_stream_sync(reader, sink.as_mut());
    });
}

/// Synchronous variant. Useful in tests and for callers that already have
/// a worker thread. Reads the entire stream to EOF, dispatching to `sink`.
pub fn pump_json_stream_sync<R: Read>(reader: R, sink: &mut dyn EventSink) {
    let buf = BufReader::new(reader);
    for line in buf.lines() {
        let Ok(line) = line else { break };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        dispatch(trimmed, sink);
    }
}

fn dispatch(trimmed: &str, sink: &mut dyn EventSink) {
    match serde_json::from_str::<CrocEvent>(trimmed) {
        Ok(ev) => match ev {
            CrocEvent::Code { code } => sink.on_code(code),
            CrocEvent::Phase { phase, message } => {
                sink.on_phase(TransferPhase { phase, message });
            }
            CrocEvent::Progress {
                file,
                bytes_transferred,
                bytes_total,
                percent,
                speed_bps,
            } => sink.on_progress(TransferProgressV2 {
                percent,
                bytes_done: bytes_transferred,
                bytes_total,
                speed_bps,
                file,
            }),
            CrocEvent::Complete { files } => {
                sink.on_complete(TransferComplete { files });
            }
            CrocEvent::Error {
                code,
                message,
                hint,
            } => sink.on_error(TransferError {
                code,
                message,
                hint,
            }),
            CrocEvent::Version { .. } => {
                // Informational only; no Tauri surface yet.
            }
            CrocEvent::Store { .. } => {
                // Stored-transfer details; will surface in a follow-up.
            }
        },
        Err(_) => sink.on_unparsed(trimmed.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use std::sync::{Arc, Mutex};

    /// In-memory sink for tests.
    #[derive(Default, Clone)]
    struct CapturedEvents {
        codes: Arc<Mutex<Vec<String>>>,
        phases: Arc<Mutex<Vec<TransferPhase>>>,
        progresses: Arc<Mutex<Vec<TransferProgressV2>>>,
        completes: Arc<Mutex<Vec<TransferComplete>>>,
        errors: Arc<Mutex<Vec<TransferError>>>,
        unparsed: Arc<Mutex<Vec<String>>>,
    }

    impl EventSink for CapturedEvents {
        fn on_code(&mut self, code: String) {
            self.codes.lock().unwrap().push(code);
        }
        fn on_phase(&mut self, phase: TransferPhase) {
            self.phases.lock().unwrap().push(phase);
        }
        fn on_progress(&mut self, progress: TransferProgressV2) {
            self.progresses.lock().unwrap().push(progress);
        }
        fn on_complete(&mut self, complete: TransferComplete) {
            self.completes.lock().unwrap().push(complete);
        }
        fn on_error(&mut self, error: TransferError) {
            self.errors.lock().unwrap().push(error);
        }
        fn on_unparsed(&mut self, raw_line: String) {
            self.unparsed.lock().unwrap().push(raw_line);
        }
    }

    /// Synchronous version for deterministic test assertions. Drains the
    /// reader inline so the test can immediately inspect the captured
    /// events without sleeping.
    fn run_sync<R: std::io::Read>(reader: R) -> CapturedEvents {
        let mut cap = CapturedEvents::default();
        pump_json_stream_sync(reader, &mut cap);
        cap
    }

    #[test]
    fn parses_full_sender_stream() {
        let input = r#"{"type":"version","version":"11.1.0"}
{"type":"code","code":"mango-lake-42"}
{"type":"phase","phase":"hashing","message":"hashing files"}
{"type":"phase","phase":"connecting","message":"connecting to relay"}
{"type":"phase","phase":"transferring","message":"transferring files"}
{"type":"progress","file":"hello.txt","bytesTransferred":80,"bytesTotal":80,"percent":100.0,"speedBps":0}
{"type":"complete","files":[{"name":"hello.txt","bytes":80}]}
{"type":"phase","phase":"complete","message":"transfer complete"}
"#;
        let cap = run_sync(Cursor::new(input));

        assert_eq!(cap.codes.lock().unwrap().as_slice(), &["mango-lake-42"]);
        let phases = cap.phases.lock().unwrap();
        assert_eq!(phases.len(), 4);
        assert_eq!(phases[0].phase, "hashing");
        assert_eq!(phases[3].phase, "complete");

        let progresses = cap.progresses.lock().unwrap();
        assert_eq!(progresses.len(), 1);
        assert_eq!(progresses[0].bytes_done, 80);
        assert_eq!(progresses[0].bytes_total, 80);
        assert_eq!(progresses[0].file.as_deref(), Some("hello.txt"));

        let completes = cap.completes.lock().unwrap();
        assert_eq!(completes.len(), 1);
        assert_eq!(completes[0].files.len(), 1);
        assert_eq!(completes[0].files[0].name, "hello.txt");
        assert_eq!(completes[0].files[0].bytes, 80);

        assert!(cap.unparsed.lock().unwrap().is_empty());
    }

    #[test]
    fn parses_error_event() {
        let input = r#"{"type":"version","version":"11.1.0"}
{"type":"phase","phase":"connecting","message":"connecting to relay"}
{"type":"error","code":"auth_failed","message":"cipher: message authentication failed","hint":"make sure both sides use the same code phrase and relay password"}
"#;
        let cap = run_sync(Cursor::new(input));

        let errors = cap.errors.lock().unwrap();
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].code, "auth_failed");
        assert_eq!(
            errors[0].hint.as_deref(),
            Some("make sure both sides use the same code phrase and relay password")
        );
    }

    #[test]
    fn non_json_lines_fall_through_to_unparsed() {
        let input = "Connecting to relay...\nthis is not json\n{\"type\":\"phase\",\"phase\":\"transferring\"}\n";
        let cap = run_sync(Cursor::new(input));

        let unparsed = cap.unparsed.lock().unwrap();
        assert_eq!(
            unparsed.as_slice(),
            &["Connecting to relay...", "this is not json"]
        );
        let phases = cap.phases.lock().unwrap();
        assert_eq!(phases.len(), 1);
        assert_eq!(phases[0].phase, "transferring");
    }

    #[test]
    fn empty_lines_are_ignored() {
        let input = "\n\n{\"type\":\"phase\",\"phase\":\"transferring\"}\n\n";
        let cap = run_sync(Cursor::new(input));
        assert_eq!(cap.phases.lock().unwrap().len(), 1);
        assert!(cap.unparsed.lock().unwrap().is_empty());
    }
}
