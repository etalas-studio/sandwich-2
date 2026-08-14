import { strict as assert } from "node:assert";
import { describe, it, afterEach } from "node:test";
import { sendEmail } from "./email.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

describe("sendEmail", () => {
  it("throws when config is missing", async () => {
    delete process.env.RESEND_API_KEY;
    await assert.rejects(
      () => sendEmail({ to: "a@b.com", subject: "s", text: "t" }),
      /RESEND_API_KEY/,
    );
  });

  it("POSTs to Resend with bearer auth and correct body", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "no-reply@example.com";
    let captured: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = (async (url: any, init: any) => {
      captured = { url, init };
      return new Response(JSON.stringify({ id: "x" }), { status: 200 });
    }) as any;
    await sendEmail({ to: "user@example.com", subject: "Hi", text: "Body" });
    assert.equal(captured!.url, "https://api.resend.com/emails");
    const headers = captured!.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer re_test");
    const body = JSON.parse(captured!.init.body as string);
    assert.equal(body.from, "no-reply@example.com");
    assert.equal(body.to, "user@example.com");
    assert.equal(body.subject, "Hi");
  });

  it("throws on non-2xx", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "no-reply@example.com";
    globalThis.fetch = (async () => new Response("boom", { status: 422 })) as any;
    await assert.rejects(
      () => sendEmail({ to: "u@b.com", subject: "s", text: "t" }),
      /Resend 422/,
    );
  });
});
