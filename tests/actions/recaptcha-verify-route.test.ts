import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/recaptcha/verify/route";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("POST /api/recaptcha/verify", () => {
  it("bypasses verification in development when secret is missing", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_RECAPTCHA_SECRET_KEY;

    const request = new Request("http://localhost/api/recaptcha/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "token", action: "login_password" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { success?: boolean; bypassed?: boolean };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.bypassed).toBe(true);
  });

  it("returns missing-secret error in production when secret is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_RECAPTCHA_SECRET_KEY;

    const request = new Request("http://localhost/api/recaptcha/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "token", action: "login_password" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { success?: boolean; reason?: string };

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.reason).toBe("missing-secret");
  });

  it("bypasses low score/action mismatch in development", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_RECAPTCHA_SECRET_KEY = "secret";
    process.env.RECAPTCHA_MIN_SCORE = "0.5";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, score: 0.1, action: "wrong_action" }),
    } as Response);

    const request = new Request("http://localhost/api/recaptcha/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "token", action: "login_password" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { success?: boolean; bypassed?: boolean };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.bypassed).toBe(true);
  });
});
