import { describe, expect, it } from "vitest";
import { normalizeProxyInput } from "./proxyPaste";

describe("normalizeProxyInput", () => {
  it("converts host:port:user:pass to socks5 URL", () => {
    expect(
      normalizeProxyInput(
        "v2.proxyempire.io:5000:r_xxx-sid-yyy:72adfb4c0d",
        "socks5",
      ),
    ).toBe("socks5://r_xxx-sid-yyy:72adfb4c0d@v2.proxyempire.io:5000");
  });

  it("converts host:port:user:pass to http URL", () => {
    expect(
      normalizeProxyInput("proxy.example.com:8080:alice:secret", "http"),
    ).toBe("http://alice:secret@proxy.example.com:8080");
  });

  it("URL-encodes special characters in user and password", () => {
    expect(normalizeProxyInput("host:1080:user@name:pass!word", "socks5")).toBe(
      "socks5://user%40name:pass!word@host:1080",
    );
  });

  it("leaves existing socks5 URLs unchanged", () => {
    const url = "socks5://alice:secret@127.0.0.1:9050";
    expect(normalizeProxyInput(url, "socks5")).toBe(url);
  });

  it("leaves existing http URLs unchanged", () => {
    const url = "http://alice:secret@127.0.0.1:8080";
    expect(normalizeProxyInput(url, "http")).toBe(url);
  });

  it("leaves https URLs unchanged", () => {
    const url = "https://alice:secret@127.0.0.1:8443";
    expect(normalizeProxyInput(url, "http")).toBe(url);
  });

  it("returns empty string for empty input", () => {
    expect(normalizeProxyInput("", "socks5")).toBe("");
    expect(normalizeProxyInput("   ", "http")).toBe("");
  });

  it("returns input unchanged for invalid port", () => {
    expect(normalizeProxyInput("host:0:user:pass", "socks5")).toBe(
      "host:0:user:pass",
    );
    expect(normalizeProxyInput("host:abc:user:pass", "socks5")).toBe(
      "host:abc:user:pass",
    );
    expect(normalizeProxyInput("host:99999:user:pass", "socks5")).toBe(
      "host:99999:user:pass",
    );
  });

  it("returns input unchanged when not exactly four colon parts", () => {
    expect(normalizeProxyInput("host:1080", "socks5")).toBe("host:1080");
    expect(normalizeProxyInput("host:1080:user", "socks5")).toBe(
      "host:1080:user",
    );
    expect(normalizeProxyInput("host:1080:user:pass:extra", "socks5")).toBe(
      "host:1080:user:pass:extra",
    );
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(
      normalizeProxyInput(
        "  proxy.example.com:5000:user:pass  ",
        "socks5",
      ),
    ).toBe("socks5://user:pass@proxy.example.com:5000");
  });
});
