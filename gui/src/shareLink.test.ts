import { describe, expect, it } from "vitest";
import {
  buildCliReceiveCommand,
  buildReceiveUrl,
  normalizeCodePhrase,
  parseReceiveInput,
  relayHandshakeErrorMessage,
  sanitizeCodePhrase,
} from "./shareLink";

describe("buildReceiveUrl", () => {
  it("encodes code for getcroc.com", () => {
    expect(buildReceiveUrl("cement-galaxy-alpha")).toBe(
      "https://getcroc.com/?code=cement-galaxy-alpha",
    );
  });

  it("includes relay and pass when set", () => {
    const url = buildReceiveUrl("my-code-phrase", {
      relay: "relay.example:9009",
      relayPass: "secret",
    });
    expect(url).toContain("code=my-code-phrase");
    expect(url).toContain("relay=relay.example%3A9009");
    expect(url).toContain("pass=secret");
  });
});

describe("parseReceiveInput", () => {
  it("parses getcroc.com URLs", () => {
    expect(
      parseReceiveInput("https://getcroc.com/?code=mango-lake-42"),
    ).toEqual({ code: "mango-lake-42" });
  });

  it("parses getcroc URLs with relay and pass", () => {
    expect(
      parseReceiveInput(
        "https://getcroc.com/?code=my-code&relay=relay.example%3A9009&pass=secret",
      ),
    ).toEqual({
      code: "my-code",
      relay: "relay.example:9009",
      relayPass: "secret",
    });
  });

  it("parses CLI paste", () => {
    expect(
      parseReceiveInput("CROC_SECRET='cement-galaxy-alpha' croc --yes"),
    ).toEqual({ code: "cement-galaxy-alpha" });
  });
});

describe("normalizeCodePhrase", () => {
  it("extracts code from getcroc link", () => {
    expect(normalizeCodePhrase("https://getcroc.com/?code=word-word-99")).toBe(
      "word-word-99",
    );
  });
});

describe("sanitizeCodePhrase", () => {
  it("lowercases valid codes", () => {
    expect(sanitizeCodePhrase("Mango-Lake-42")).toEqual({
      code: "mango-lake-42",
      changed: true,
    });
  });
});

describe("relayHandshakeErrorMessage", () => {
  it("maps croc decode errors", () => {
    expect(
      relayHandshakeErrorMessage(
        "problem with decoding: invalid character 'ä' looking for beginning of value",
      ),
    ).toContain("getcroc.com");
  });
});

describe("buildCliReceiveCommand", () => {
  it("builds a CROC_SECRET receive command for croc v10+", () => {
    expect(buildCliReceiveCommand("cement-galaxy-alpha")).toBe(
      "CROC_SECRET='cement-galaxy-alpha' croc --yes",
    );
  });

  it("includes relay flags", () => {
    expect(
      buildCliReceiveCommand("my-code", {
        relay: "relay.example:9009",
        relayPass: "secret",
        local: true,
      }),
    ).toBe(
      "CROC_SECRET='my-code' croc --local --pass secret --relay relay.example:9009 --yes",
    );
  });
});
