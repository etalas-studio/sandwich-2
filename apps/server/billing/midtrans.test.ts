import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  createSnapTransaction,
  verifyNotificationSignature,
} from "./midtrans.js";

const SERVER_KEY = "SB-Mid-server-test-key";

function sign(orderId: string, statusCode: string, grossAmount: string): string {
  return createHash("sha512")
    .update(orderId + statusCode + grossAmount + SERVER_KEY)
    .digest("hex");
}

async function withServerKey(
  value: string | undefined,
  fn: () => Promise<void> | void,
): Promise<void> {
  const prev = process.env.MIDTRANS_SERVER_KEY;
  if (value === undefined) delete process.env.MIDTRANS_SERVER_KEY;
  else process.env.MIDTRANS_SERVER_KEY = value;
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env.MIDTRANS_SERVER_KEY;
    else process.env.MIDTRANS_SERVER_KEY = prev;
  }
}

describe("verifyNotificationSignature", () => {
  it("accepts a correctly signed notification", async () => {
    await withServerKey(SERVER_KEY, () => {
      const orderId = "starter-u1-1700000000000-abc123";
      const statusCode = "200";
      const grossAmount = "50000.00";
      assert.equal(
        verifyNotificationSignature({
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          signature_key: sign(orderId, statusCode, grossAmount),
        }),
        true,
      );
    });
  });

  it("rejects a tampered signature", async () => {
    await withServerKey(SERVER_KEY, () => {
      const orderId = "pro-u2-1700000000000-xyz789";
      assert.equal(
        verifyNotificationSignature({
          order_id: orderId,
          status_code: "200",
          gross_amount: "100000.00",
          signature_key: "0".repeat(128),
        }),
        false,
      );
    });
  });

  it("hashes the raw gross_amount string, not a reformatted number", async () => {
    await withServerKey(SERVER_KEY, () => {
      const orderId = "starter-u3-1700000000000-def456";
      // Signature computed over the exact provider string "50000.00".
      const raw = "50000.00";
      const signature = sign(orderId, "200", raw);
      assert.equal(
        verifyNotificationSignature({
          order_id: orderId,
          status_code: "200",
          gross_amount: raw,
          signature_key: signature,
        }),
        true,
      );
      // Reformatted amount ("50000") must NOT verify with the same signature.
      assert.equal(
        verifyNotificationSignature({
          order_id: orderId,
          status_code: "200",
          gross_amount: "50000",
          signature_key: signature,
        }),
        false,
      );
    });
  });

  it("throws when MIDTRANS_SERVER_KEY is not set", async () => {
    await withServerKey(undefined, () => {
      assert.throws(() =>
        verifyNotificationSignature({
          order_id: "o",
          status_code: "200",
          gross_amount: "1.00",
          signature_key: "x",
        }),
      );
    });
  });
});

describe("createSnapTransaction", () => {
  it("fails fast when the server key is missing (no network call)", async () => {
    await withServerKey(undefined, async () => {
      await assert.rejects(
        createSnapTransaction({
          orderId: "starter-u4-1700000000000-ghi012",
          grossAmount: 50000,
          itemName: "Spectr Starter",
        }),
        /MIDTRANS_SERVER_KEY is not set/,
      );
    });
  });
});
