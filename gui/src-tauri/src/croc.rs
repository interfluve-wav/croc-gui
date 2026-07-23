use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferOptions {
    pub custom_code: Option<String>,
    pub relay: Option<String>,
    pub port: Option<u16>,
    pub overwrite: bool,
    pub yes: bool,
    /// Send-only: pass `croc send --zip` (zip folder before sending).
    #[serde(default)]
    pub zip: bool,
    /// Receive-only: after a successful receive, zip newly created items in out_dir.
    #[serde(default)]
    pub zip_after_receive: bool,
    /// Global: force LAN-only connections (`croc --local`), no public relay.
    #[serde(default)]
    pub local: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TransferMode {
    Send,
    Receive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartTransferRequest {
    pub mode: TransferMode,
    pub paths: Vec<String>,
    pub code: Option<String>,
    pub out_dir: Option<String>,
    pub options: TransferOptions,
}

pub fn resolve_croc_bin(resource_dir: Option<&Path>) -> Result<PathBuf, String> {
    if let Ok(override_path) = std::env::var("CROC_BIN") {
        let path = PathBuf::from(override_path);
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!(
            "CROC_BIN is set but not a file: {}",
            path.display()
        ));
    }

    let binary_name = if cfg!(windows) { "croc.exe" } else { "croc" };

    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Some(dir) = resource_dir {
        candidates.push(dir.join("bin").join(binary_name));
        candidates.push(dir.join("resources").join("bin").join(binary_name));
        candidates.push(dir.join(binary_name));
    }

    // macOS .app: Contents/MacOS/<exe> → Contents/Resources/bin/croc
    if let Ok(exe) = std::env::current_exe() {
        if let Some(macos_dir) = exe.parent() {
            if let Some(contents) = macos_dir.parent() {
                let resources = contents.join("Resources");
                candidates.push(resources.join("bin").join(binary_name));
                candidates.push(resources.join("resources").join("bin").join(binary_name));
            }
            // Dev: binary next to debug/release exe or under src-tauri/bin
            candidates.push(macos_dir.join(binary_name));
            candidates.push(macos_dir.join("bin").join(binary_name));
        }
    }

    // Dev fallback: src-tauri/bin relative to CARGO_MANIFEST_DIR at compile time
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin").join(binary_name));

    for candidate in &candidates {
        if candidate.is_file() {
            return Ok(candidate.clone());
        }
    }

    Err(format!(
        "Bundled croc binary not found. Tried: {}. Run `npm run bundle:croc` then rebuild.",
        candidates
            .iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    ))
}

pub fn build_args(req: &StartTransferRequest) -> Result<Vec<String>, String> {
    let mut args: Vec<String> = Vec::new();
    let opts = &req.options;

    if opts.yes {
        args.push("--yes".into());
    }
    if opts.overwrite {
        args.push("--overwrite".into());
    }
    if opts.local {
        args.push("--local".into());
    }
    if let Some(relay) = opts.relay.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        args.push("--relay".into());
        args.push(relay.to_string());
    }

    match req.mode {
        TransferMode::Send => {
            if req.paths.is_empty() {
                return Err("Select at least one file or folder to send".into());
            }
            args.push("send".into());
            if opts.zip {
                args.push("--zip".into());
            }
            if let Some(code) = opts
                .custom_code
                .as_ref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
            {
                if code.chars().count() < 6 {
                    return Err("Custom code must be at least 6 characters".into());
                }
                args.push("--code".into());
                args.push(code.to_string());
            }
            if let Some(port) = opts.port {
                args.push("--port".into());
                args.push(port.to_string());
            }
            for path in &req.paths {
                let trimmed = path.trim();
                if trimmed.is_empty() {
                    continue;
                }
                args.push(trimmed.to_string());
            }
            if args.last().map(|s| s.as_str()) == Some("send") {
                return Err("Select at least one file or folder to send".into());
            }
        }
        TransferMode::Receive => {
            let code = req
                .code
                .as_ref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .ok_or_else(|| "Enter a receive code phrase".to_string())?;
            if opts.zip_after_receive {
                let out = req
                    .out_dir
                    .as_ref()
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty());
                if out.is_none() {
                    return Err(
                        "Choose a download folder when “Zip after receive” is enabled".into(),
                    );
                }
            }
            if let Some(out) = req
                .out_dir
                .as_ref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
            {
                args.push("--out".into());
                args.push(out.to_string());
            }
            args.push(code.to_string());
        }
    }

    Ok(args)
}

pub fn list_top_level_names(dir: &Path) -> Result<HashSet<String>, String> {
    let mut names = HashSet::new();
    if !dir.exists() {
        return Ok(names);
    }
    let entries = fs::read_dir(dir).map_err(|e| format!("Cannot read {}: {e}", dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Cannot read entry in {}: {e}", dir.display()))?;
        if let Some(name) = entry.file_name().to_str() {
            names.insert(name.to_string());
        }
    }
    Ok(names)
}

/// Zip top-level items in `out_dir` that were not present in `before`.
/// Returns the created zip path, or `Ok(None)` if nothing new appeared.
pub fn zip_new_entries(
    out_dir: &Path,
    before: &HashSet<String>,
) -> Result<Option<PathBuf>, String> {
    let after = list_top_level_names(out_dir)?;
    let mut new_names: Vec<String> = after
        .difference(before)
        .filter(|name| !(name.starts_with("croc-received-") && name.ends_with(".zip")))
        .cloned()
        .collect();
    new_names.sort();
    if new_names.is_empty() {
        return Ok(None);
    }

    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let zip_name = format!("croc-received-{secs}.zip");
    let zip_path = out_dir.join(&zip_name);

    let file = File::create(&zip_path)
        .map_err(|e| format!("Cannot create {}: {e}", zip_path.display()))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    for name in &new_names {
        let path = out_dir.join(name);
        add_path_to_zip(&mut zip, out_dir, &path, options)?;
    }

    zip.finish()
        .map_err(|e| format!("Failed to finish zip {}: {e}", zip_path.display()))?;
    Ok(Some(zip_path))
}

fn path_to_zip_name(base: &Path, path: &Path) -> Result<String, String> {
    let rel = path
        .strip_prefix(base)
        .map_err(|_| format!("{} is not under {}", path.display(), base.display()))?;
    let mut name = rel.to_string_lossy().replace('\\', "/");
    if path.is_dir() && !name.ends_with('/') {
        name.push('/');
    }
    Ok(name)
}

fn add_path_to_zip(
    zip: &mut ZipWriter<File>,
    base: &Path,
    path: &Path,
    options: SimpleFileOptions,
) -> Result<(), String> {
    let meta = fs::metadata(path).map_err(|e| format!("Cannot stat {}: {e}", path.display()))?;
    if meta.is_dir() {
        let dir_name = path_to_zip_name(base, path)?;
        zip.add_directory(&dir_name, options)
            .map_err(|e| format!("Cannot add directory {dir_name}: {e}"))?;
        let entries = fs::read_dir(path)
            .map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
        let mut kids: Vec<_> = entries
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Cannot list {}: {e}", path.display()))?;
        kids.sort_by_key(|e| e.file_name());
        for entry in kids {
            add_path_to_zip(zip, base, &entry.path(), options)?;
        }
        return Ok(());
    }

    if !meta.is_file() {
        return Ok(());
    }

    let name = path_to_zip_name(base, path)?;
    zip.start_file(&name, options)
        .map_err(|e| format!("Cannot add file {name}: {e}"))?;
    let mut input =
        File::open(path).map_err(|e| format!("Cannot open {}: {e}", path.display()))?;
    let mut buf = Vec::new();
    input
        .read_to_end(&mut buf)
        .map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    zip.write_all(&buf)
        .map_err(|e| format!("Cannot write {name} into zip: {e}"))?;
    Ok(())
}

pub fn extract_code_phrase(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if let Some(rest) = trimmed.strip_prefix("Code is:") {
        let code = rest.trim();
        if !code.is_empty() {
            return Some(code.to_string());
        }
    }
    // Fallback: "croc some-code-phrase" alone on a line
    if let Some(rest) = trimmed.strip_prefix("croc ") {
        let candidate = rest.trim();
        if !candidate.is_empty()
            && !candidate.starts_with('-')
            && candidate.split_whitespace().count() == 1
        {
            return Some(candidate.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opts() -> TransferOptions {
        TransferOptions {
            custom_code: None,
            relay: None,
            port: None,
            overwrite: false,
            yes: false,
            zip: false,
            zip_after_receive: false,
            local: false,
        }
    }

    #[test]
    fn send_basic_paths() {
        let req = StartTransferRequest {
            mode: TransferMode::Send,
            paths: vec!["/tmp/a.txt".into(), "/tmp/b".into()],
            code: None,
            out_dir: None,
            options: opts(),
        };
        let args = build_args(&req).unwrap();
        assert_eq!(args, vec!["send", "/tmp/a.txt", "/tmp/b"]);
    }

    #[test]
    fn send_with_zip_flag() {
        let mut options = opts();
        options.zip = true;
        let req = StartTransferRequest {
            mode: TransferMode::Send,
            paths: vec!["/tmp/folder".into()],
            code: None,
            out_dir: None,
            options,
        };
        let args = build_args(&req).unwrap();
        assert_eq!(args, vec!["send", "--zip", "/tmp/folder"]);
    }

    #[test]
    fn send_with_options() {
        let mut options = opts();
        options.yes = true;
        options.overwrite = true;
        options.relay = Some("relay.example:9009".into());
        options.custom_code = Some("secret-code".into());
        options.port = Some(9010);
        options.zip = true;
        let req = StartTransferRequest {
            mode: TransferMode::Send,
            paths: vec!["file.txt".into()],
            code: None,
            out_dir: None,
            options,
        };
        let args = build_args(&req).unwrap();
        assert_eq!(
            args,
            vec![
                "--yes",
                "--overwrite",
                "--relay",
                "relay.example:9009",
                "send",
                "--zip",
                "--code",
                "secret-code",
                "--port",
                "9010",
                "file.txt"
            ]
        );
    }

    #[test]
    fn send_with_local_flag() {
        let mut options = opts();
        options.local = true;
        let req = StartTransferRequest {
            mode: TransferMode::Send,
            paths: vec!["/tmp/a.txt".into()],
            code: None,
            out_dir: None,
            options,
        };
        let args = build_args(&req).unwrap();
        assert_eq!(args, vec!["--local", "send", "/tmp/a.txt"]);
    }

    #[test]
    fn receive_with_local_flag() {
        let mut options = opts();
        options.local = true;
        let req = StartTransferRequest {
            mode: TransferMode::Receive,
            paths: vec![],
            code: Some("mango-lake-42".into()),
            out_dir: Some("/tmp/inbox".into()),
            options,
        };
        let args = build_args(&req).unwrap();
        assert_eq!(
            args,
            vec!["--local", "--out", "/tmp/inbox", "mango-lake-42"]
        );
    }

    #[test]
    fn send_rejects_short_code() {
        let mut options = opts();
        options.custom_code = Some("abc".into());
        let req = StartTransferRequest {
            mode: TransferMode::Send,
            paths: vec!["file.txt".into()],
            code: None,
            out_dir: None,
            options,
        };
        assert!(build_args(&req).is_err());
    }

    #[test]
    fn send_requires_paths() {
        let req = StartTransferRequest {
            mode: TransferMode::Send,
            paths: vec![],
            code: None,
            out_dir: None,
            options: opts(),
        };
        assert!(build_args(&req).is_err());
    }

    #[test]
    fn receive_with_out_dir() {
        let req = StartTransferRequest {
            mode: TransferMode::Receive,
            paths: vec![],
            code: Some("alpha-bravo".into()),
            out_dir: Some("/tmp/inbox".into()),
            options: opts(),
        };
        let args = build_args(&req).unwrap();
        assert_eq!(args, vec!["--out", "/tmp/inbox", "alpha-bravo"]);
    }

    #[test]
    fn receive_zip_after_requires_out_dir() {
        let mut options = opts();
        options.zip_after_receive = true;
        let req = StartTransferRequest {
            mode: TransferMode::Receive,
            paths: vec![],
            code: Some("alpha-bravo".into()),
            out_dir: None,
            options,
        };
        assert!(build_args(&req).is_err());
    }

    #[test]
    fn receive_requires_code() {
        let req = StartTransferRequest {
            mode: TransferMode::Receive,
            paths: vec![],
            code: Some("  ".into()),
            out_dir: None,
            options: opts(),
        };
        assert!(build_args(&req).is_err());
    }

    #[test]
    fn extract_code_from_croc_output() {
        assert_eq!(
            extract_code_phrase("Code is: mango-lake-42"),
            Some("mango-lake-42".into())
        );
        assert_eq!(
            extract_code_phrase("  croc mango-lake-42  "),
            Some("mango-lake-42".into())
        );
        assert_eq!(extract_code_phrase("sending file"), None);
    }

    #[test]
    fn zip_new_entries_packs_only_new_files() {
        let tmp = std::env::temp_dir().join(format!("croc-gui-zip-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        fs::write(tmp.join("old.txt"), b"old").unwrap();
        let before = list_top_level_names(&tmp).unwrap();
        fs::write(tmp.join("new.txt"), b"hello").unwrap();
        fs::create_dir_all(tmp.join("subdir")).unwrap();
        fs::write(tmp.join("subdir").join("nested.txt"), b"nest").unwrap();

        let zip_path = zip_new_entries(&tmp, &before).unwrap().expect("zip created");
        assert!(zip_path.is_file());
        assert!(zip_path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("croc-received-"));

        let file = File::open(&zip_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let mut names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .collect();
        names.sort();
        assert!(names.iter().any(|n| n == "new.txt"));
        assert!(names.iter().any(|n| n == "subdir/" || n.starts_with("subdir/")));
        assert!(!names.iter().any(|n| n == "old.txt"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn resolve_checks_nested_resources_layout() {
        let tmp = std::env::temp_dir().join(format!("croc-gui-test-{}", std::process::id()));
        let nested = tmp.join("resources").join("bin");
        std::fs::create_dir_all(&nested).unwrap();
        let bin_name = if cfg!(windows) { "croc.exe" } else { "croc" };
        let bin_path = nested.join(bin_name);
        std::fs::write(&bin_path, b"fake").unwrap();
        // Clear CROC_BIN so override does not short-circuit the test.
        let prev = std::env::var_os("CROC_BIN");
        std::env::remove_var("CROC_BIN");
        let resolved = resolve_croc_bin(Some(&tmp)).unwrap();
        assert_eq!(resolved, bin_path);
        match prev {
            Some(v) => std::env::set_var("CROC_BIN", v),
            None => std::env::remove_var("CROC_BIN"),
        }
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn resolve_prefers_flat_bin_over_nested() {
        let tmp = std::env::temp_dir().join(format!("croc-gui-flat-{}", std::process::id()));
        let flat = tmp.join("bin");
        let nested = tmp.join("resources").join("bin");
        std::fs::create_dir_all(&flat).unwrap();
        std::fs::create_dir_all(&nested).unwrap();
        let bin_name = if cfg!(windows) { "croc.exe" } else { "croc" };
        let flat_path = flat.join(bin_name);
        let nested_path = nested.join(bin_name);
        std::fs::write(&flat_path, b"flat").unwrap();
        std::fs::write(&nested_path, b"nested").unwrap();
        let prev = std::env::var_os("CROC_BIN");
        std::env::remove_var("CROC_BIN");
        let resolved = resolve_croc_bin(Some(&tmp)).unwrap();
        assert_eq!(resolved, flat_path);
        match prev {
            Some(v) => std::env::set_var("CROC_BIN", v),
            None => std::env::remove_var("CROC_BIN"),
        }
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
