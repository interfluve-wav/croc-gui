mod croc;

use croc::{
    extract_code_phrase, list_top_level_names, make_send_zip_workdir, resolve_croc_bin,
    zip_new_entries, StartTransferRequest, TransferMode,
};
use serde::Serialize;
use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

struct PendingZip {
    out_dir: PathBuf,
    before: HashSet<String>,
}

struct TransferState {
    child: Mutex<Option<Child>>,
    pending_zip: Mutex<Option<PendingZip>>,
    /// Temp cwd for `croc send --zip` (croc writes FolderName.zip into cwd).
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

#[tauri::command]
fn start_transfer(
    app: AppHandle,
    state: State<'_, TransferState>,
    request: StartTransferRequest,
) -> Result<(), String> {
    {
        let guard = state.child.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Err("A transfer is already running".into());
        }
    }

    let resource_dir = app.path().resource_dir().ok();
    let program = resolve_croc_bin(resource_dir.as_deref())?;
    let args = croc::build_args(&request)?;

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

    // croc --zip writes FolderName.zip into cwd; GUI cwd is often `/` (fails) or
    // reuses a leftover zip name (fails). Use a fresh writable temp dir for send+zip.
    let send_zip_workdir =
        if matches!(request.mode, TransferMode::Send) && request.options.zip {
            Some(make_send_zip_workdir()?)
        } else {
            None
        };
    {
        let mut work_guard = state.send_zip_workdir.lock().map_err(|e| e.to_string())?;
        *work_guard = send_zip_workdir.clone();
    }

    if matches!(request.mode, TransferMode::Send) {
        if request.options.zip {
            let _ = app.emit(
                "transfer-line",
                TransferLinePayload {
                    stream: "stdout".into(),
                    line: "Zip before send enabled — archiving folder(s) via croc --zip…".into(),
                    code: None,
                },
            );
        }
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
    }

    let mut command = Command::new(&program);
    command
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(ref work) = send_zip_workdir {
        command.current_dir(work);
    } else if let Some(out) = request
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
        std::thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines().flatten() {
                let code = extract_code_phrase(&line);
                let _ = app_out.emit(
                    "transfer-line",
                    TransferLinePayload {
                        stream: "stdout".into(),
                        line,
                        code,
                    },
                );
            }
        });
    }

    let app_err = app.clone();
    if let Some(err) = stderr {
        std::thread::spawn(move || {
            let reader = BufReader::new(err);
            for line in reader.lines().flatten() {
                let code = extract_code_phrase(&line);
                let _ = app_err.emit(
                    "transfer-line",
                    TransferLinePayload {
                        stream: "stderr".into(),
                        line,
                        code,
                    },
                );
            }
        });
    }

    let app_wait = app.clone();
    std::thread::spawn(move || {
        loop {
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

#[tauri::command]
fn cancel_transfer(app: AppHandle, state: State<'_, TransferState>) -> Result<(), String> {
    {
        let mut zip_guard = state.pending_zip.lock().map_err(|e| e.to_string())?;
        *zip_guard = None;
    }
    clear_send_zip_workdir(&state);
    let mut guard = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
        drop(guard);
        let _ = app.emit(
            "transfer-exit",
            TransferExitPayload {
                code: None,
                cancelled: true,
            },
        );
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
            cancel_transfer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
