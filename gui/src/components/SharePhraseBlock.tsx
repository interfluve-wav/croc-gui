import { useState } from "react";

type CopiedKind = "link" | "phrase" | "command" | null;

type SharePhraseBlockProps = {
  phrase: string;
  receiveUrl: string | null;
  qrDataUrl: string | null;
  cliReceiveCommand: string | null;
  variant: "prominent" | "compact";
  copied: CopiedKind;
  onCopy: (kind: Exclude<CopiedKind, null>, text: string) => void;
  onOpenUrl: (url: string) => void;
};

export function SharePhraseBlock({
  phrase,
  receiveUrl,
  qrDataUrl,
  cliReceiveCommand,
  variant,
  copied,
  onCopy,
  onOpenUrl,
}: SharePhraseBlockProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);
  const prominent = variant === "prominent";

  return (
    <>
      <div
        className={`share-phrase share-phrase-${variant}`}
        aria-live="polite"
      >
        {prominent && (
          <p className="share-phrase-lead">
            Share this code so the receiver can download your files
          </p>
        )}
        <div className="phrase-layout">
          <div className="phrase-main">
            <div className="phrase-row">
              <code>{phrase}</code>
            </div>
            {prominent && receiveUrl && (
              <p className="receive-link">
                <a
                  href={receiveUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenUrl(receiveUrl);
                  }}
                >
                  {receiveUrl}
                </a>
              </p>
            )}
            <div className="phrase-actions">
              <button
                type="button"
                className={`primary-copy${copied === "link" ? " copied" : ""}`}
                onClick={() => receiveUrl && onCopy("link", receiveUrl)}
                disabled={!receiveUrl}
              >
                {copied === "link" ? "Copied link" : "Copy receive link"}
              </button>
              {!prominent && (
                <button
                  type="button"
                  className={`ghost${copied === "phrase" ? " copied" : ""}`}
                  onClick={() => onCopy("phrase", phrase)}
                >
                  {copied === "phrase" ? "Copied" : "Copy code"}
                </button>
              )}
              {prominent && (
                <>
                  <button
                    type="button"
                    className={`ghost${copied === "phrase" ? " copied" : ""}`}
                    onClick={() => onCopy("phrase", phrase)}
                  >
                    {copied === "phrase" ? "Copied code" : "Copy code only"}
                  </button>
                  {cliReceiveCommand && (
                    <button
                      type="button"
                      className={`ghost${copied === "command" ? " copied" : ""}`}
                      onClick={() => onCopy("command", cliReceiveCommand)}
                    >
                      {copied === "command" ? "Copied" : "Copy CLI command"}
                    </button>
                  )}
                </>
              )}
              {!prominent && cliReceiveCommand && (
                <>
                  <button
                    type="button"
                    className="ghost share-more-toggle"
                    onClick={() => setMoreOpen((v) => !v)}
                    aria-expanded={moreOpen}
                  >
                    {moreOpen ? "Less" : "More"}
                  </button>
                  {moreOpen && (
                    <button
                      type="button"
                      className={`ghost${copied === "command" ? " copied" : ""}`}
                      onClick={() => onCopy("command", cliReceiveCommand)}
                    >
                      {copied === "command" ? "Copied" : "Copy CLI command"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {qrDataUrl && (
            <button
              type="button"
              className="qr qr-button"
              onClick={() => setQrExpanded(true)}
              title="Enlarge QR code"
              aria-label="Enlarge QR code"
            >
              <img
                src={qrDataUrl}
                alt={`QR code to receive at getcroc.com with code ${phrase}`}
              />
              {prominent && (
                <span className="qr-caption">Tap to enlarge</span>
              )}
            </button>
          )}
        </div>
      </div>

      {qrExpanded && qrDataUrl && (
        <div
          className="qr-modal-backdrop"
          role="presentation"
          onClick={() => setQrExpanded(false)}
        >
          <div
            className="qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <h2 id="qr-modal-title">Scan to receive</h2>
              <button
                type="button"
                className="ghost"
                onClick={() => setQrExpanded(false)}
              >
                Close
              </button>
            </div>
            <p className="qr-modal-code">
              <code>{phrase}</code>
            </p>
            <img
              className="qr-modal-img"
              src={qrDataUrl}
              alt={`Large QR code for ${phrase}`}
            />
            <p className="qr-modal-hint">Scan to open getcroc.com</p>
            <div className="phrase-actions qr-modal-actions">
              <button
                type="button"
                className={`primary-copy${copied === "link" ? " copied" : ""}`}
                onClick={() => receiveUrl && onCopy("link", receiveUrl)}
                disabled={!receiveUrl}
              >
                {copied === "link" ? "Copied link" : "Copy receive link"}
              </button>
              <button
                type="button"
                className={`ghost${copied === "phrase" ? " copied" : ""}`}
                onClick={() => onCopy("phrase", phrase)}
              >
                {copied === "phrase" ? "Copied code" : "Copy code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
