use serde::Serialize;

#[derive(Debug, Clone, Serialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgress {
    pub percent: Option<u8>,
    pub bytes_done: Option<u64>,
    pub bytes_total: Option<u64>,
    pub speed: Option<String>,
    pub phase: Option<String>,
    pub label: Option<String>,
}

/// Strip common ANSI escape sequences and leading carriage returns from croc output.
pub fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\u{1b}' {
            if chars.next_if_eq(&'[').is_some() {
                for c in chars.by_ref() {
                    if ('@'..='~').contains(&c) {
                        break;
                    }
                }
            }
            continue;
        }
        if ch == '\r' {
            continue;
        }
        out.push(ch);
    }
    out.trim().to_string()
}

/// Parse human-readable byte sizes (e.g. `10 MB`, `1.5 GiB`) into bytes.
pub fn parse_human_bytes(raw: &str) -> Option<u64> {
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }
    let mut end = 0usize;
    for (idx, ch) in s.char_indices() {
        if ch.is_ascii_digit() || ch == '.' {
            end = idx + ch.len_utf8();
        } else {
            break;
        }
    }
    if end == 0 {
        return None;
    }
    let num_part = s[..end].trim();
    let unit_part = s[end..].trim();
    let value: f64 = num_part.parse().ok()?;
    if !value.is_finite() || value < 0.0 {
        return None;
    }
    let unit = unit_part.to_ascii_lowercase();
    let multiplier: f64 = match unit.as_str() {
        "" | "b" => 1.0,
        "kb" | "k" => 1_000.0,
        "mb" => 1_000_000.0,
        "gb" => 1_000_000_000.0,
        "tb" => 1_000_000_000_000.0,
        "kib" | "ki" => 1_024.0,
        "mib" | "mi" => 1_048_576.0,
        "gib" | "gi" => 1_073_741_824.0,
        "tib" | "ti" => 1_099_511_627_776.0,
        _ => return None,
    };
    Some((value * multiplier).round() as u64)
}

fn extract_percent(cleaned: &str) -> Option<u8> {
    let idx = cleaned.find('%')?;
    let before = cleaned[..idx].trim_end();
    let digits: String = before
        .chars()
        .rev()
        .take_while(|c| c.is_ascii_digit())
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    if digits.is_empty() {
        return None;
    }
    let n: u16 = digits.parse().ok()?;
    if n > 100 {
        return None;
    }
    Some(n as u8)
}

fn parse_parens_content(content: &str) -> (Option<u64>, Option<u64>, Option<String>) {
    let parts: Vec<&str> = content.split(',').map(str::trim).collect();
    let mut bytes_done = None;
    let mut bytes_total = None;
    let mut speed = None;

    if let Some(first) = parts.first() {
        if let Some((left, right)) = first.split_once('/') {
            bytes_done = parse_human_bytes(left);
            bytes_total = parse_human_bytes(right);
        } else if first.ends_with("/s") {
            speed = Some(first.to_string());
        } else {
            bytes_done = parse_human_bytes(first);
        }
    }
    if parts.len() > 1 {
        let second = parts[1];
        if second.ends_with("/s") {
            speed = Some(second.to_string());
        }
    }
    (bytes_done, bytes_total, speed)
}

fn infer_phase(
    cleaned: &str,
    percent: Option<u8>,
    bytes_done: Option<u64>,
    bytes_total: Option<u64>,
) -> Option<String> {
    let lower = cleaned.to_ascii_lowercase();
    if lower.contains("checking") {
        return Some("checking".into());
    }
    if lower.contains("securing") {
        return Some("connecting".into());
    }
    if is_near_complete(percent, bytes_done, bytes_total) {
        return Some("finishing".into());
    }
    if lower.contains("receiv") {
        return Some("receiving".into());
    }
    if lower.contains("send") {
        return Some("sending".into());
    }
    if lower.contains("connect") || lower.contains("waiting") {
        return Some("connecting".into());
    }
    if lower.contains("hash") {
        return Some("preparing".into());
    }
    match percent {
        Some(100) => Some("finishing".into()),
        Some(_) => Some("transferring".into()),
        None => None,
    }
}

/// Croc's progressbar often stays at 99% while hashing / waiting for relay ack.
fn is_near_complete(
    percent: Option<u8>,
    bytes_done: Option<u64>,
    bytes_total: Option<u64>,
) -> bool {
    if percent == Some(100) {
        return true;
    }
    if percent == Some(99) {
        return true;
    }
    if let (Some(done), Some(total)) = (bytes_done, bytes_total) {
        if total > 0 && done >= total.saturating_sub(total / 100).max(1) {
            return true;
        }
    }
    false
}

/// Prefer transfer stats after `%` — croc descriptions include file size in parens
/// e.g. `Sending 'file.zip' (96 MB)  99% |...| (95 MB/96 MB, 5 MB/s)`.
fn extract_progress_bytes(cleaned: &str) -> (Option<u64>, Option<u64>, Option<String>) {
    if let Some(pct_idx) = cleaned.find('%') {
        let after = &cleaned[pct_idx..];
        if let Some((d, t, s)) = parse_paren_group(after) {
            if d.is_some() || t.is_some() || s.is_some() {
                return (d, t, s);
            }
        }
    }

    for (idx, _) in cleaned.match_indices('(') {
        let slice = &cleaned[idx..];
        if let Some((d, t, s)) = parse_paren_group(slice) {
            if t.is_some() || slice.contains('/') {
                return (d, t, s);
            }
        }
    }

    parse_paren_group(cleaned).unwrap_or((None, None, None))
}

fn parse_paren_group(s: &str) -> Option<(Option<u64>, Option<u64>, Option<String>)> {
    let start = s.find('(')?;
    let end = s[start + 1..].find(')')?;
    let inner = &s[start + 1..start + 1 + end];
    Some(parse_parens_content(inner))
}

fn extract_label(cleaned: &str, percent_idx: Option<usize>) -> Option<String> {
    let end = percent_idx.unwrap_or(cleaned.len());
    let prefix = cleaned[..end].trim();
    if prefix.is_empty() {
        return None;
    }
    // Drop spinner glyphs and bar fragments before the description.
    let label = prefix
        .trim_start_matches(|c: char| {
            c == '|' || c == '█' || c == '░' || c == '▓' || c == '▒' || c == '■' || c == '□'
        })
        .trim();
    if label.len() < 2 {
        return None;
    }
    Some(label.to_string())
}

/// Parse croc stderr/stdout progress lines (schollz/progressbar format).
pub fn parse_progress_line(line: &str) -> Option<TransferProgress> {
    let cleaned = strip_ansi(line);
    if cleaned.is_empty() {
        return None;
    }

    let percent = extract_percent(&cleaned);
    let percent_idx = cleaned.find('%');

    let (bytes_done, bytes_total, mut speed) = extract_progress_bytes(&cleaned);

    // Speed can also appear outside parens: `5 MB/s`
    if speed.is_none() {
        for token in cleaned.split_whitespace() {
            if token.ends_with("/s") && token.len() > 2 {
                speed = Some(token.to_string());
                break;
            }
        }
    }

    let phase = infer_phase(&cleaned, percent, bytes_done, bytes_total);
    let label = extract_label(&cleaned, percent_idx);

    if percent.is_none() && bytes_done.is_none() && speed.is_none() && phase.is_none() {
        return None;
    }

    Some(TransferProgress {
        percent,
        bytes_done,
        bytes_total,
        speed,
        phase,
        label,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_human_bytes_units() {
        assert_eq!(parse_human_bytes("10 MB"), Some(10_000_000));
        assert_eq!(parse_human_bytes("1.5 GiB"), Some(1_610_612_736));
        assert_eq!(parse_human_bytes("500 kB"), Some(500_000));
    }

    #[test]
    fn parse_progress_percent_and_bytes() {
        let line = "Sending archive.zip   45% |████████          | (10 MB/50 MB, 5 MB/s)";
        let p = parse_progress_line(line).unwrap();
        assert_eq!(p.percent, Some(45));
        assert_eq!(p.bytes_done, Some(10_000_000));
        assert_eq!(p.bytes_total, Some(50_000_000));
        assert_eq!(p.speed.as_deref(), Some("5 MB/s"));
        assert_eq!(p.phase.as_deref(), Some("sending"));
    }

    #[test]
    fn parse_progress_with_ansi_and_carriage_return() {
        let line = "\u{1b}[36m\rReceiving data   12% |██                | (1.2 MB/10 MB, 800 kB/s)";
        let p = parse_progress_line(line).unwrap();
        assert_eq!(p.percent, Some(12));
        assert_eq!(p.phase.as_deref(), Some("receiving"));
    }

    #[test]
    fn parse_progress_checking_phase() {
        let line = "Checking big.iso  67% |███████           | (6.7 GiB/10 GiB, 120 MB/s)";
        let p = parse_progress_line(line).unwrap();
        assert_eq!(p.percent, Some(67));
        assert_eq!(p.phase.as_deref(), Some("checking"));
    }

    #[test]
    fn parse_progress_connecting_without_percent() {
        let line = "waiting for recipient to connect";
        let p = parse_progress_line(line).unwrap();
        assert_eq!(p.phase.as_deref(), Some("connecting"));
        assert!(p.percent.is_none());
    }

    #[test]
    fn non_progress_line_returns_none() {
        assert!(parse_progress_line("Code is: mango-lake-42").is_none());
        assert!(parse_progress_line("").is_none());
    }

    #[test]
    fn parse_croc_style_description_with_file_size_parens() {
        let line = "Sending 'croc-send-1784836459526.zip' (96.2 MB)  99% |██████████████████| (96.1 MB/96.2 MB, 12 MB/s)";
        let p = parse_progress_line(line).unwrap();
        assert_eq!(p.percent, Some(99));
        assert_eq!(p.bytes_done, Some(96_100_000));
        assert_eq!(p.bytes_total, Some(96_200_000));
        assert_eq!(p.phase.as_deref(), Some("finishing"));
        assert!(p.label.unwrap().contains("croc-send"));
    }

    #[test]
    fn parse_near_complete_without_trailing_bytes() {
        let line = "Sending 'archive.zip' (10 MB)  99% |██████████████████|";
        let p = parse_progress_line(line).unwrap();
        assert_eq!(p.percent, Some(99));
        assert_eq!(p.phase.as_deref(), Some("finishing"));
    }

    #[test]
    fn parse_progress_at_one_hundred_percent() {
        let line = "Sending 'archive.zip' (10 MB) 100% |████████████████████| (10 MB/10 MB)";
        let p = parse_progress_line(line).unwrap();
        assert_eq!(p.percent, Some(100));
        assert_eq!(p.phase.as_deref(), Some("finishing"));
    }

    #[test]
    fn parse_securing_channel_phase() {
        let line = "securing channel...";
        let p = parse_progress_line(line).unwrap();
        assert_eq!(p.phase.as_deref(), Some("connecting"));
    }
}
