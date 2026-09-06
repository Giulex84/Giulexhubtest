const PI_API_BASE = "https://api.minepi.com/v2";
const PREMIUM_AMOUNT = 1;
const PREMIUM_MEMO = "Arena Test Premium Unlock";
const PREMIUM_PRODUCT = "arena_test_premium_v1";
const REWARD_AMOUNT = 0.3;
const REWARD_MEMO = "Arena Test Triple Combo Reward";

function getServerApiKey() {
  const key = process.env.PI_API_KEY;
  if (!key) throw new Error("PI_API_KEY not configured");
  return key;
}

function bearerFromRequest(req) {
  const value = req.headers.authorization;
  if (!value || !value.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

async function verifyAccessToken(accessToken) {
  const response = await fetch(`${PI_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unauthorized");
  const user = await response.json();
  if (!user?.uid) throw new Error("Invalid Pi user response");
  return user;
}

async function getPayment(paymentId) {
  const response = await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Key ${getServerApiKey()}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Could not fetch payment");
  return data;
}

async function piPost(path, body) {
  const response = await fetch(`${PI_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${getServerApiKey()}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function validatePremiumPayment(payment, expectedUid) {
  if (!payment?.identifier || !payment.user_uid) return "Malformed payment";
  if (expectedUid && payment.user_uid !== expectedUid) return "Payment does not belong to authenticated user";
  if (payment.direction !== "user_to_app") return "Unexpected payment direction";
  if (payment.network !== "Pi Testnet") return "Unexpected payment network";
  if (Number(payment.amount) !== PREMIUM_AMOUNT) return "Unexpected payment amount";
  if (payment.memo !== PREMIUM_MEMO) return "Unexpected payment memo";
  if (payment.metadata?.product !== PREMIUM_PRODUCT) return "Unexpected payment product";
  if (payment.status?.cancelled || payment.status?.user_cancelled) return "Payment is cancelled";
  return null;
}

function validateRewardPayment(payment, expectedUid) {
  if (!payment?.identifier || !payment.user_uid) return "Malformed reward payment";
  if (expectedUid && payment.user_uid !== expectedUid) return "Reward does not belong to authenticated user";
  if (payment.direction !== "app_to_user") return "Unexpected reward direction";
  if (payment.network !== "Pi Testnet") return "Unexpected reward network";
  if (Number(payment.amount) !== REWARD_AMOUNT) return "Unexpected reward amount";
  if (payment.memo !== REWARD_MEMO) return "Unexpected reward memo";
  if (payment.metadata?.event !== "triple_combo") return "Unexpected reward metadata";
  if (payment.status?.cancelled || payment.status?.user_cancelled) return "Reward payment is cancelled";
  return null;
}

module.exports = {
  PI_API_BASE,
  PREMIUM_AMOUNT,
  PREMIUM_MEMO,
  PREMIUM_PRODUCT,
  REWARD_AMOUNT,
  REWARD_MEMO,
  bearerFromRequest,
  verifyAccessToken,
  getPayment,
  piPost,
  validatePremiumPayment,
  validateRewardPayment,
  getServerApiKey,
};
