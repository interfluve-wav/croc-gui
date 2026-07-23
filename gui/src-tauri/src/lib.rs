mod croc;
mod progress;

use croc::{
    extract_code_phrase, list_top_level_names, prepare_send_zip_archive, resolve_croc_bin,
    resolve_relay_options, sanitize_code_phrase, zip_new_entries, StartTransferRequest,
    TransferMode, DEFAULT_RELAY,
};
use progress::parse_progress_line;
use serde::Serialize;
use std::collections::HashSet;
use std::io::{BufReader, Read};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(unix)]
use std::os::unix::process::CommandExt;

struct PendingZip {
    out_dir: PathBuf,
    before: HashSet<String>,
}

struct TransferState {
    child: Mutex<Option<Child>>,
    pending_zip: Mutex<Option<PendingZip>>,
    /// Temp dir holding staged files + the zip we send (cleaned after transfer).
    send_zip_workdir: Mutex<Option<PathBuf>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TransferLinePayload {
    stream: String,
    line: String,
    code: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TransferExitPayload {
    code: Option<i32>,
    cancelled: bool,
}

fn emit_transfer_output(app: &AppHandle, stream: &str, raw_line: &str) {
    let line = raw_line.trim();
    if line.is_empty() {
        return;
    }
    let code = extract_code_phrase(line);
    if let Some(progress) = parse_progress_line(line) {
        let _ = app.emit("transfer-progress", progress);
    }
    let _ = app.emit(
        "transfer-line",
        TransferLinePayload {
            stream: stream.to_string(),
            line: line.to_string(),
            code,
        },
    );
}

fn pump_stream<R: Read + Send + 'static>(reader: R, app: AppHandle, stream: String) {
    std::thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut buffer = Vec::new();
        let mut chunk = [0u8; 4096];
        loop {
            match reader.read(&mut chunk) {
                Ok(0) => break,
                Ok(n) => {
                    for &byte in &chunk[..n] {
                        if byte == b'\n' || byte == b'\r' {
                            if !buffer.is_empty() {
                                if let Ok(line) = String::from_utf8(buffer.clone()) {
                                    emit_transfer_output(&app, &stream, &line);
                                }
                                buffer.clear();
                            }
                        } else if byte == b'\t' || byte >= 0x20 {
                            buffer.push(byte);
                        }
                    }
                }
                Err(_) => break,
            }
        }
        if !buffer.is_empty() {
            if let Ok(line) = String::from_utf8(buffer) {
                emit_transfer_output(&app, &stream, &line);
            }
        }
    });
}

#[tauri::command]
fn croc_bin_status(app: AppHandle) -> Result<String, String> {
    let resource_dir = app.path().resource_dir().ok();
    let path = resolve_croc_bin(resource_dir.as_deref())?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn croc_version(app: AppHandle) -> Result<String, String> {
    let resource_dir = app.path().resource_dir().ok();
    let path = resolve_croc_bin(resource_dir.as_deref())?;
    let output = Command::new(&path)
        .arg("-v")
        .output()
        .map_err(|e| format!("Failed to run croc -v: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let text = if !stdout.is_empty() {
        stdout
    } else if !stderr.is_empty() {
        stderr
    } else {
        return Err("croc -v produced no output".into());
    };
    Ok(text)
}

fn resolve_receive_out_dir(
    app: &AppHandle,
    request: &mut StartTransferRequest,
) -> Result<(), String> {
    if !matches!(request.mode, TransferMode::Receive) {
        return Ok(());
    }
    let has_out = request
        .out_dir
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .is_some();
    if has_out {
        return Ok(());
    }
    let downloads = app
        .path()
        .download_dir()
        .map_err(|e| format!("Could not resolve Downloads folder: {e}"))?;
    if downloads.as_os_str().is_empty() {
        return Err(
            "Choose a download folder — Croc could not find your Downloads directory.".into(),
        );
    }
    request.out_dir = Some(downloads.display().to_string());
    Ok(())
}

fn ensure_out_dir_writable(path: &str) -> Result<PathBuf, String> {
    let out = PathBuf::from(path);
    if !out.exists() {
        std::fs::create_dir_all(&out)
            .map_err(|e| format!("Cannot create download folder {}: {e}", out.display()))?;
    }
    let probe = out.join(".croc-gui-write-test");
    std::fs::write(&probe, b"").map_err(|e| {
        format!(
            "Download folder is not writable ({}). Choose another folder.",
            e
        )
    })?;
    let _ = std::fs::remove_file(&probe);
    Ok(out)
}

#[tauri::command]
fn start_transfer(
    app: AppHandle,
    state: State<'_, TransferState>,
    request: StartTransferRequest,
) -> Result<(), String> {
    // Clear any stale croc child before starting (e.g. receive still listening).
    let _ = stop_transfer_child(&state, None);

    let resource_dir = app.path().resource_dir().ok();
    let program = resolve_croc_bin(resource_dir.as_deref())?;

    // Zip-before-send: stage any mix of files/folders into one archive, then send that .zip.
    let mut request = request;
    let send_zip_workdir = if matches!(request.mode, TransferMode::Send) && request.options.zip {
        let _ = app.emit(
            "transfer-line",
            TransferLinePayload {
                stream: "stdout".into(),
                line: "Zipping all selected items into one archive…".into(),
                code: None,
            },
        );
        let (workdir, zip_path) = prepare_send_zip_archive(&request.paths)?;
        let _ = app.emit(
            "transfer-line",
            TransferLinePayload {
                stream: "stdout".into(),
                line: format!("Created zip: {}", zip_path.display()),
                code: None,
            },
        );
        request.paths = vec![zip_path.display().to_string()];
        request.options.zip = false;
        Some(workdir)
    } else {
        None
    };
    {
        let mut work_guard = state.send_zip_workdir.lock().map_err(|e| e.to_string())?;
        *work_guard = send_zip_workdir.clone();
    }

    resolve_receive_out_dir(&app, &mut request)?;
    if matches!(request.mode, TransferMode::Receive) {
        if let Some(code) = request.code.as_ref() {
            request.code = Some(sanitize_code_phrase(code)?);
        }
        if let Some(out) = request
            .out_dir
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            ensure_out_dir_writable(out)?;
        }
    }

    let args = match croc::build_args(&request) {
        Ok(args) => args,
        Err(err) => {
            clear_send_zip_workdir(&state);
            return Err(err);
        }
    };

    // Prepare post-receive zip snapshot before spawn so we only pack new items.
    let pending_zip = if matches!(request.mode, TransferMode::Receive)
        && request.options.zip_after_receive
    {
        let out = request
            .out_dir
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| {
                "Choose a download folder when “Zip after receive” is enabled".to_string()
            })?;
        let out_dir = PathBuf::from(out);
        if !out_dir.exists() {
            std::fs::create_dir_all(&out_dir)
                .map_err(|e| format!("Cannot create download folder {}: {e}", out_dir.display()))?;
        }
        let before = list_top_level_names(&out_dir)?;
        Some(PendingZip { out_dir, before })
    } else {
        None
    };

    {
        let mut zip_guard = state.pending_zip.lock().map_err(|e| e.to_string())?;
        *zip_guard = pending_zip;
    }

    if matches!(request.mode, TransferMode::Send) {
        if let Some(code) = request
            .options
            .custom_code
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            let _ = app.emit(
                "transfer-line",
                TransferLinePayload {
                    stream: "stdout".into(),
                    line: format!("Code is: {code}"),
                    code: Some(code.to_string()),
                },
            );
        }
    } else if matches!(request.mode, TransferMode::Receive) {
        let relay_hint = if request.options.local {
            "LAN only".to_string()
        } else if request
            .options
            .relay
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .is_some()
        {
            request
                .options
                .relay
                .as_ref()
                .map(|s| s.trim().to_string())
                .unwrap_or_default()
        } else {
            format!("{DEFAULT_RELAY} (getcroc.com)")
        };
        let _ = app.emit(
            "transfer-line",
            TransferLinePayload {
                stream: "stdout".into(),
                line: format!("Connecting to relay {relay_hint}…"),
                code: None,
            },
        );
        if let Some(out) = request.out_dir.as_ref() {
            let _ = app.emit(
                "transfer-line",
                TransferLinePayload {
                    stream: "stdout".into(),
                    line: format!("Saving received files to {}", out.trim()),
                    code: None,
                },
            );
        }
    }

    let mut command = Command::new(&program);
    command
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(unix)]
    unsafe {
        command.pre_exec(|| {
            libc::setpgid(0, 0);
            Ok(())
        });
    }

    if matches!(request.mode, TransferMode::Receive) {
        if let Some(code) = request
            .code
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            // croc v10+ secure receive mode — positional codes exit 0 without transferring.
            command.env("CROC_SECRET", code);
            if !request.options.local {
                let (_, relay_pass) = resolve_relay_options(&request.options, &request.mode);
                if let Some(pass) = relay_pass {
                    command.env("CROC_PASS", pass);
                }
            }
        } else {
            clear_send_zip_workdir(&state);
            if let Ok(mut zip_guard) = state.pending_zip.lock() {
                *zip_guard = None;
            }
            return Err("Receive code is missing — paste the phrase from getcroc.com.".into());
        }
    }

    if let Some(out) = request
        .out_dir
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        command.current_dir(out);
    }

    let mut child = command.spawn().map_err(|e| {
        // Clear pending state if spawn fails
        if let Ok(mut zip_guard) = state.pending_zip.lock() {
            *zip_guard = None;
        }
        clear_send_zip_workdir(&state);
        format!(
            "Failed to start croc ({}): {e}. Check the bundled binary.",
            program.display()
        )
    })?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    {
        let mut guard = state.child.lock().map_err(|e| e.to_string())?;
        *guard = Some(child);
    }

    let app_out = app.clone();
    if let Some(out) = stdout {
        pump_stream(out, app_out, "stdout".into());
    }

    let app_err = app.clone();
    if let Some(err) = stderr {
        pump_stream(err, app_err, "stderr".into());
    }

    let app_wait = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(100));
        let state = app_wait.state::<TransferState>();
        let mut guard = match state.child.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        match guard.as_mut() {
            Some(child) => match child.try_wait() {
                Ok(Some(status)) => {
                    let code = status.code();
                    *guard = None;
                    drop(guard);

                    if code == Some(0) {
                        maybe_zip_after_receive(&app_wait);
                    } else if let Ok(mut zip_guard) = state.pending_zip.lock() {
                        *zip_guard = None;
                    }
                    clear_send_zip_workdir(&state);

                    let _ = app_wait.emit(
                        "transfer-exit",
                        TransferExitPayload {
                            code,
                            cancelled: false,
                        },
                    );
                    return;
                }
                Ok(None) => {}
                Err(_) => {
                    *guard = None;
                    drop(guard);
                    if let Ok(mut zip_guard) = state.pending_zip.lock() {
                        *zip_guard = None;
                    }
                    clear_send_zip_workdir(&state);
                    let _ = app_wait.emit(
                        "transfer-exit",
                        TransferExitPayload {
                            code: None,
                            cancelled: false,
                        },
                    );
                    return;
                }
            },
            None => return,
        }
    });

    Ok(())
}

fn maybe_zip_after_receive(app: &AppHandle) {
    let state = app.state::<TransferState>();
    let pending = match state.pending_zip.lock() {
        Ok(mut guard) => guard.take(),
        Err(_) => return,
    };
    let Some(job) = pending else {
        return;
    };

    let _ = app.emit(
        "transfer-line",
        TransferLinePayload {
            stream: "stdout".into(),
            line: "Zipping newly received files…".into(),
            code: None,
        },
    );

    match zip_new_entries(&job.out_dir, &job.before) {
        Ok(Some(path)) => {
            let _ = app.emit(
                "transfer-line",
                TransferLinePayload {
                    stream: "stdout".into(),
                    line: format!("Created zip: {}", path.display()),
                    code: None,
                },
            );
        }
        Ok(None) => {
            let _ = app.emit(
                "transfer-line",
                TransferLinePayload {
                    stream: "stdout".into(),
                    line: "Zip skipped: no new files found in download folder.".into(),
                    code: None,
                },
            );
        }
        Err(err) => {
            let _ = app.emit(
                "transfer-line",
                TransferLinePayload {
                    stream: "stderr".into(),
                    line: format!("Zip after receive failed: {err}"),
                    code: None,
                },
            );
        }
    }
}

fn clear_send_zip_workdir(state: &TransferState) {
    let dir = match state.send_zip_workdir.lock() {
        Ok(mut guard) => guard.take(),
        Err(_) => return,
    };
    if let Some(dir) = dir {
        let _ = std::fs::remove_dir_all(&dir);
    }
}

fn clear_pending_zip(state: &TransferState) {
    if let Ok(mut zip_guard) = state.pending_zip.lock() {
        *zip_guard = None;
    }
}

fn kill_child_tree(child: &mut Child) -> Option<i32> {
    let pid = child.id();
    #[cfg(unix)]
    {
        let pgid = pid as i32;
        unsafe {
            libc::killpg(pgid, libc::SIGTERM);
        }
        std::thread::sleep(Duration::from_millis(120));
    }
    let _ = child.kill();
    child.wait().ok().and_then(|s| s.code())
}

/// Stop croc if running. Returns exit code when a child was stopped.
fn stop_transfer_child(
    state: &TransferState,
    emit: Option<(&AppHandle, bool)>,
) -> Option<Option<i32>> {
    clear_pending_zip(state);
    clear_send_zip_workdir(state);

    let mut guard = match state.child.lock() {
        Ok(g) => g,
        Err(_) => return None,
    };
    let Some(mut child) = guard.take() else {
        return None;
    };
    let code = kill_child_tree(&mut child);

    if let Some((app, cancelled)) = emit {
        let exit_code = if cancelled {
            None
        } else {
            code.or(Some(0))
        };
        let _ = app.emit(
            "transfer-exit",
            TransferExitPayload {
                code: exit_code,
                cancelled,
            },
        );
    }

    Some(code)
}

#[tauri::command]
fn cancel_transfer(app: AppHandle, state: State<'_, TransferState>) -> Result<(), String> {
    if stop_transfer_child(&state, Some((&app, true))).is_some() {
        return Ok(());
    }
    Ok(())
}

#[tauri::command]
fn reset_transfer(_app: AppHandle, state: State<'_, TransferState>) -> Result<(), String> {
    let _ = stop_transfer_child(&state, None);
    Ok(())
}

/// Kill a still-running croc after the UI considers the transfer done (e.g. receive listener).
#[tauri::command]
fn finish_transfer(app: AppHandle, state: State<'_, TransferState>) -> Result<(), String> {
    if stop_transfer_child(&state, Some((&app, false))).is_some() {
        return Ok(());
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(TransferState {
            child: Mutex::new(None),
            pending_zip: Mutex::new(None),
            send_zip_workdir: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            croc_bin_status,
            croc_version,
            start_transfer,
            cancel_transfer,
            reset_transfer,
            finish_transfer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
