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

fn infer_phase(cleaned: &str, percent: Option<u8>) -> Option<String> {
    let lower = cleaned.to_ascii_lowercase();
    if lower.contains("checking") {
        return Some("checking".into());
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

    let mut bytes_done = None;
    let mut bytes_total = None;
    let mut speed = None;

    if let Some(start) = cleaned.find('(') {
        if let Some(end) = cleaned[start + 1..].find(')') {
            let inner = &cleaned[start + 1..start + 1 + end];
            let (d, t, s) = parse_parens_content(inner);
            bytes_done = d;
            bytes_total = t;
            speed = s;
        }
    }

    // Speed can also appear outside parens: `5 MB/s`
    if speed.is_none() {
        for token in cleaned.split_whitespace() {
            if token.ends_with("/s") && token.len() > 2 {
                speed = Some(token.to_string());
                break;
            }
        }
    }

    let phase = infer_phase(&cleaned, percent);
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
}
