import { afterEach, describe, expect, it, vi } from "vitest";

describe("verification bypass configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("matches the toggle value in local development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const verificationModule = await import("../../lib/verification");

    expect(verificationModule.isVerificationBypassEnabled()).toBe(verificationModule.bypassVerification);
  });

  it("stays disabled outside local development", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const verificationModule = await import("../../lib/verification");

    expect(verificationModule.isVerificationBypassEnabled()).toBe(false);
  });
});