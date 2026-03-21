import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestApp } from "../test-app";

const ORIGIN = "http://localhost";
const TEST_ENV = { TURNSTILE_SECRET_KEY: "test-secret" };

function mockTurnstileSuccess() {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function visitRequest() {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ turnstileToken: "test-token" }),
  };
}

describe("POST /api/v1/telemetry/visit", () => {
  let app: ReturnType<typeof createTestApp>["app"];

  beforeEach(() => {
    ({ app } = createTestApp());
    vi.restoreAllMocks();
  });

  it("returns ok", async () => {
    mockTurnstileSuccess();
    const res = await app.request(
      "/api/v1/telemetry/visit",
      visitRequest(),
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("increments count on repeated visits", async () => {
    mockTurnstileSuccess();
    await app.request("/api/v1/telemetry/visit", visitRequest(), TEST_ENV);
    mockTurnstileSuccess();
    await app.request("/api/v1/telemetry/visit", visitRequest(), TEST_ENV);
    mockTurnstileSuccess();
    const res = await app.request(
      "/api/v1/telemetry/visit",
      visitRequest(),
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });

  it("rejects missing origin", async () => {
    const res = await app.request(
      "/api/v1/telemetry/visit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken: "test-token" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("rejects failed turnstile", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    const res = await app.request(
      "/api/v1/telemetry/visit",
      visitRequest(),
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});
