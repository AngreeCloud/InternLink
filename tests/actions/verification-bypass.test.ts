import { afterEach, describe, expect, it, vi } from "vitest";
import { bypassVerification, isVerificationBypassEnabled } from "@/lib/verification";

describe("verification bypass configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("matches the toggle value in local development", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(isVerificationBypassEnabled()).toBe(bypassVerification);
  });

  it("stays disabled outside local development", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(isVerificationBypassEnabled()).toBe(false);
  });
});