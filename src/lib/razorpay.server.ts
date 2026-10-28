import crypto from "node:crypto";

/**
 * Server-only Razorpay configuration and API helpers.
 * Sensitive keys are never passed to the client.
 */

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  isConfigured: boolean;
}

export function getRazorpayConfig(): RazorpayConfig {
  const keyId =
    process.env["RAZORPAY_KEY_ID"] ||
    process.env["VITE_RAZORPAY_KEY_ID"] ||
    "rzp_live_TtEbwUCaxCki6i";
  const keySecret =
    process.env["RAZORPAY_KEY_SECRET"] ||
    "zm6MJYfK7RO7jiBhlahZYyIV";
  const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"] || "";

  return {
    keyId: keyId.trim(),
    keySecret: keySecret.trim(),
    webhookSecret: webhookSecret.trim(),
    isConfigured: keyId.trim().length > 5 && keySecret.trim().length > 5,
  };
}

export interface CreateOrderParams {
  amountInINR: number;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  orderId: string;
  amount: number; // in paise
  currency: string;
  receipt: string;
  status: string;
  keyId: string;
}

/**
 * Creates an order on Razorpay API (or creates a valid test-mode order if keys are pending).
 */
export async function createRazorpayOrder(
  params: CreateOrderParams
): Promise<RazorpayOrderResult> {
  const config = getRazorpayConfig();
  const amountInPaise = Math.round(params.amountInINR * 100);

  if (amountInPaise <= 0) {
    throw new Error("Invalid order amount: must be greater than zero");
  }

  // If live/test Razorpay API credentials are provided:
  if (config.isConfigured) {
    const authHeader = `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: params.receipt,
        notes: params.notes || {},
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      let msg = "Failed to create Razorpay order";
      try {
        const parsed = JSON.parse(errBody);
        msg = parsed.error?.description || msg;
      } catch {
        // use fallback
      }
      throw new Error(`Razorpay API Error (${res.status}): ${msg}`);
    }

    const order = await res.json();
    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      keyId: config.keyId,
    };
  }

  // Local/Test sandbox fallback when keys have not yet been pasted by user
  const mockOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  return {
    orderId: mockOrderId,
    amount: amountInPaise,
    currency: "INR",
    receipt: params.receipt,
    status: "created",
    keyId: config.keyId || "rzp_test_placeholder",
  };
}

/**
 * Verifies the Razorpay payment signature returned on checkout success:
 * Expected signature = HMAC-SHA256(order_id + "|" + payment_id, secret)
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecretOverride?: string
): boolean {
  if (!orderId || !paymentId || !signature) return false;

  const config = getRazorpayConfig();
  const secret = keySecretOverride || config.keySecret;

  if (!secret) {
    // If running in local sandbox test mode without keys, check test convention
    if (orderId.startsWith("order_test_") && paymentId.startsWith("pay_test_")) {
      return signature === "sig_test_valid";
    }
    return false;
  }

  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf-8"),
      Buffer.from(signature, "utf-8")
    );
  } catch {
    return false;
  }
}

/**
 * Verifies Razorpay Webhook signature:
 * Expected = HMAC-SHA256(request_body, webhook_secret)
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecretOverride?: string
): boolean {
  if (!rawBody || !signature) return false;

  const config = getRazorpayConfig();
  const secret = webhookSecretOverride || config.webhookSecret;
  if (!secret) return false;

  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf-8"),
      Buffer.from(signature, "utf-8")
    );
  } catch {
    return false;
  }
}
