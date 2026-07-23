import { describe, expect, it } from "vitest";
import { buildCliReceiveCommand, buildReceiveUrl } from "./shareLink";

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

describe("buildCliReceiveCommand", () => {
  it("builds a simple receive command", () => {
    expect(buildCliReceiveCommand("cement-galaxy-alpha")).toBe(
      "croc cement-galaxy-alpha",
    );
  });

  it("includes relay flags", () => {
    expect(
      buildCliReceiveCommand("my-code", {
        relay: "relay.example:9009",
        relayPass: "secret",
        local: true,
      }),
    ).toBe('croc --local --pass secret --relay relay.example:9009 my-code');
  });
});
