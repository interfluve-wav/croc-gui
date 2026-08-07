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
        className="flex flex-col gap-2"
        aria-live="polite"
      >
        {prominent && (
          <p className="text-sm opacity-80">
            Share this code so the receiver can download your files
          </p>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <code className="inline-block w-fit rounded-sm bg-base-300/70 px-3 py-1.5 font-mono text-lg tracking-wide text-base-content">
              {phrase}
            </code>
            {prominent && receiveUrl && (
              <p className="text-xs opacity-80">
                <a
                  href={receiveUrl}
                  className="link link-primary break-all"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenUrl(receiveUrl);
                  }}
                >
                  {receiveUrl}
                </a>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn btn-primary btn-sm${copied === "link" ? " btn-success" : ""}`}
                onClick={() => receiveUrl && onCopy("link", receiveUrl)}
                disabled={!receiveUrl}
              >
                {copied === "link" ? "Copied link" : "Copy receive link"}
              </button>
              {!prominent && (
                <button
                  type="button"
                  className={`btn btn-outline btn-primary btn-sm${copied === "phrase" ? " btn-success" : ""}`}
                  onClick={() => onCopy("phrase", phrase)}
                >
                  {copied === "phrase" ? "Copied" : "Copy code"}
                </button>
              )}
              {prominent && (
                <>
                  <button
                    type="button"
                    className={`btn btn-outline btn-primary btn-sm${copied === "phrase" ? " btn-success" : ""}`}
                    onClick={() => onCopy("phrase", phrase)}
                  >
                    {copied === "phrase" ? "Copied code" : "Copy code only"}
                  </button>
                  {cliReceiveCommand && (
                    <button
                      type="button"
                      className={`btn btn-outline btn-primary btn-sm${copied === "command" ? " btn-success" : ""}`}
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
                    className="btn btn-ghost btn-sm"
                    onClick={() => setMoreOpen((v) => !v)}
                    aria-expanded={moreOpen}
                  >
                    {moreOpen ? "Less" : "More"}
                  </button>
                  {moreOpen && (
                    <button
                      type="button"
                      className={`btn btn-outline btn-primary btn-sm${copied === "command" ? " btn-success" : ""}`}
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
              className="btn btn-ghost p-1"
              onClick={() => setQrExpanded(true)}
              title="Enlarge QR code"
              aria-label="Enlarge QR code"
            >
              <img
                src={qrDataUrl}
                className="h-20 w-20 rounded-sm"
                alt={`QR code to receive at getcroc.com with code ${phrase}`}
              />
            </button>
          )}
        </div>
      </div>

      {qrExpanded && qrDataUrl && (
        <div
          className="modal modal-open"
          role="presentation"
          onClick={() => setQrExpanded(false)}
        >
          <div
            className="modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="qr-modal-title" className="text-lg font-semibold">
                Scan to receive
              </h2>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setQrExpanded(false)}
              >
                Close
              </button>
            </div>
            <p className="my-3 text-center font-mono text-xl">{phrase}</p>
            <img
              className="mx-auto w-56 rounded-sm"
              src={qrDataUrl}
              alt={`Large QR code for ${phrase}`}
            />
            <p className="mt-3 text-center text-sm opacity-70">
              Scan to open getcroc.com
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                className={`btn btn-primary btn-sm${copied === "link" ? " btn-success" : ""}`}
                onClick={() => receiveUrl && onCopy("link", receiveUrl)}
                disabled={!receiveUrl}
              >
                {copied === "link" ? "Copied link" : "Copy receive link"}
              </button>
              <button
                type="button"
                className={`btn btn-outline btn-primary btn-sm${copied === "phrase" ? " btn-success" : ""}`}
                onClick={() => onCopy("phrase", phrase)}
              >
                {copied === "phrase" ? "Copied code" : "Copy code"}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setQrExpanded(false)}
          />
        </div>
      )}
    </>
  );
}
