import { describe, expect, it } from "vitest";
import {
  getActiveFileBasename,
  getProgressBadge,
  getProgressBarPercent,
  getProgressDetail,
  getProgressStatus,
  getTransferUiPhase,
  getUnifiedStatusLine,
  isBytesComplete,
  isNearComplete,
  parseFileFromCrocLabel,
  simplifyCrocLabel,
} from "./progressDisplay";

const empty = {
  percent: null,
  bytesDone: null,
  bytesTotal: null,
  speed: null,
  phase: null,
  label: null,
};

describe("isNearComplete", () => {
  it("treats 99% as near complete", () => {
    expect(isNearComplete({ ...empty, percent: 99 })).toBe(true);
  });

  it("treats finishing phase as near complete", () => {
    expect(
      isNearComplete({ ...empty, percent: 45, phase: "finishing" }),
    ).toBe(true);
  });
});

describe("getTransferUiPhase", () => {
  it("returns preparing for checking phase", () => {
    expect(
      getTransferUiPhase({ ...empty, phase: "checking" }, false, null, true),
    ).toBe("preparing");
  });

  it("returns waiting when connecting without bytes", () => {
    expect(
      getTransferUiPhase({ ...empty, phase: "connecting" }, false, null, true),
    ).toBe("waiting");
  });

  it("returns transferring when percent is present", () => {
    expect(
      getTransferUiPhase(
        { ...empty, percent: 25, phase: "sending" },
        true,
        null,
        true,
      ),
    ).toBe("transferring");
  });

  it("returns finishing when near complete", () => {
    expect(
      getTransferUiPhase({ ...empty, percent: 99, phase: "finishing" }, true, null, true),
    ).toBe("finishing");
  });
});

describe("getUnifiedStatusLine", () => {
  it("shows waiting copy on send", () => {
    expect(
      getUnifiedStatusLine(
        { ...empty, phase: "connecting" },
        "send",
        "waiting",
        null,
        null,
      ),
    ).toBe("Waiting for receiver — share the code");
  });

  it("shows sending with percent during transfer", () => {
    expect(
      getUnifiedStatusLine(
        { ...empty, percent: 25, phase: "sending" },
        "send",
        "transferring",
        null,
        25,
      ),
    ).toBe("Sending · 25%");
  });

  it("shows verifying during finishing", () => {
    expect(
      getUnifiedStatusLine(
        { ...empty, percent: 99, phase: "finishing" },
        "send",
        "finishing",
        null,
        99,
      ),
    ).toBe("Verifying…");
  });
});

describe("getProgressStatus", () => {
  it("uses upload-complete wording at 99% on send via finishing phase", () => {
    const status = getProgressStatus(
      {
        percent: 99,
        bytesDone: 96_100_000,
        bytesTotal: 96_200_000,
        speed: "12 MB/s",
        phase: "finishing",
        label: "Sending 'file.zip' (96 MB)  99%",
      },
      "send",
      null,
      "finishing",
      99,
    );
    expect(status).toBe("Verifying…");
  });

  it("shows waiting after stall hint on send", () => {
    expect(
      getProgressStatus(
        { ...empty, percent: 99, bytesDone: 10, bytesTotal: 10, phase: "finishing" },
        "send",
        "hint",
        "finishing",
        99,
      ),
    ).toBe("Upload complete — waiting for the receiver");
  });

  it("shows sending with percent during active send", () => {
    expect(
      getProgressStatus(
        { ...empty, percent: 45, bytesDone: 5, bytesTotal: 10, phase: "sending" },
        "send",
        null,
        "transferring",
        45,
      ),
    ).toBe("Sending · 45%");
  });
});

describe("getProgressBadge", () => {
  it("shows Finishing instead of 99%", () => {
    expect(
      getProgressBadge(
        { ...empty, percent: 99, phase: "finishing" },
        "send",
        null,
      ),
    ).toBe("Finishing");
  });

  it("shows percent during active transfer", () => {
    expect(
      getProgressBadge(
        { ...empty, percent: 45, phase: "sending" },
        "send",
        null,
      ),
    ).toBe("45%");
  });
});

describe("getProgressBarPercent", () => {
  it("snaps bar to 100 when near complete", () => {
    expect(
      getProgressBarPercent({ ...empty, percent: 99, phase: "finishing" }, 99),
    ).toBe(100);
  });
});

describe("parseFileFromCrocLabel", () => {
  it("extracts name and size from croc label", () => {
    expect(
      parseFileFromCrocLabel(
        "Sending 'archive.zip' (96.2 MB)  99% |████|",
      ),
    ).toEqual({ name: "archive.zip", sizeText: "96.2 MB" });
  });

  it("returns null for unparseable label", () => {
    expect(parseFileFromCrocLabel("Connecting…")).toBeNull();
  });
});

describe("getActiveFileBasename", () => {
  it("returns basename from quoted path", () => {
    expect(
      getActiveFileBasename("Sending 'folder/file.zip' (10 MB)"),
    ).toBe("file.zip");
  });
});

describe("simplifyCrocLabel", () => {
  it("strips percent from croc labels", () => {
    expect(simplifyCrocLabel("Sending 'foo.gif' (10 MB)  99% |████|")).toBe(
      "Uploading…",
    );
  });
});

describe("getProgressDetail", () => {
  it("says all data uploaded when bytes complete on send", () => {
    expect(
      getProgressDetail(
        { ...empty, percent: 99, bytesDone: 100, bytesTotal: 100, speed: "5 MB/s" },
        "send",
        (n) => `${n} B`,
      ),
    ).toBe("All data uploaded");
  });

  it("isBytesComplete", () => {
    expect(
      isBytesComplete({ ...empty, percent: 99, bytesDone: 100, bytesTotal: 100 }),
    ).toBe(true);
  });
});
