import fs from "fs";
import path from "path";

const envPath = path.resolve("c:/Users/Admin/Desktop/Project/grade-galaxy-sync-main/.env");
const envText = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = m[2] || "";
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
}

const keyId = env.RAZORPAY_KEY_ID;
const keySecret = env.RAZORPAY_KEY_SECRET;

console.log("Testing Razorpay with Key ID:", keyId);

const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

try {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: 10000, // 100 INR in paise
      currency: "INR",
      receipt: "receipt_test_verification",
    }),
  });

  const body = await res.text();
  console.log("Razorpay Response Status:", res.status);
  console.log("Razorpay Response Body:", body);
} catch (e) {
  console.error("Fetch error:", e);
}
