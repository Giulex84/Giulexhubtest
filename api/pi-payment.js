const {
  bearerFromRequest,
  verifyAccessToken,
  getPayment,
  piPost,
  validatePremiumPayment,
} = require("../lib/pi");
const { isStoreConfigured, claimPayment, grantPremium } = require("../lib/store");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isStoreConfigured()) return res.status(503).json({ error: "Premium storage is not configured" });

  const { action, paymentId, txid } = req.body || {};
  if (!paymentId || typeof paymentId !== "string") return res.status(400).json({ error: "Missing paymentId" });

  try {
    if (action === "recover") {
      let payment = await getPayment(paymentId);
      const invalid = validatePremiumPayment(payment);
      if (invalid) return res.status(400).json({ error: invalid });
      await claimPayment(payment.user_uid, paymentId);

      if (!payment.status?.developer_completed) {
        const authoritativeTxid = payment.transaction?.txid || txid;
        if (!authoritativeTxid) return res.status(409).json({ error: "Incomplete payment has no transaction yet" });
        if (payment.transaction?.txid && txid && payment.transaction.txid !== txid) {
          return res.status(400).json({ error: "Transaction does not match payment" });
        }
        const result = await piPost(`/payments/${encodeURIComponent(paymentId)}/complete`, { txid: authoritativeTxid });
        if (!result.response.ok) return res.status(result.response.status).json(result.data);
      }

      payment = await getPayment(paymentId);
      if (!payment.status?.developer_completed || !payment.status?.transaction_verified) {
        return res.status(409).json({ error: "Payment is not fully verified" });
      }
      await grantPremium(payment.user_uid, paymentId);
      return res.status(200).json({ success: true, recovered: true });
    }

    const token = bearerFromRequest(req);
    if (!token) return res.status(401).json({ error: "Missing Pi access token" });
    const user = await verifyAccessToken(token);
    let payment = await getPayment(paymentId);
    const invalid = validatePremiumPayment(payment, user.uid);
    if (invalid) return res.status(400).json({ error: invalid });
    await claimPayment(user.uid, paymentId);

    if (action === "approve") {
      if (payment.status?.developer_approved) return res.status(200).json({ success: true, alreadyApproved: true });
      const result = await piPost(`/payments/${encodeURIComponent(paymentId)}/approve`);
      return res.status(result.response.status).json(result.response.ok ? { success: true } : result.data);
    }

    if (action === "complete") {
      if (!txid || typeof txid !== "string") return res.status(400).json({ error: "Missing txid" });
      if (payment.transaction?.txid && payment.transaction.txid !== txid) {
        return res.status(400).json({ error: "Transaction does not match payment" });
      }

      if (!payment.status?.developer_completed) {
        const result = await piPost(`/payments/${encodeURIComponent(paymentId)}/complete`, { txid });
        if (!result.response.ok) return res.status(result.response.status).json(result.data);
      }

      payment = await getPayment(paymentId);
      const invalidAfter = validatePremiumPayment(payment, user.uid);
      if (invalidAfter) return res.status(400).json({ error: invalidAfter });
      if (!payment.status?.developer_completed || !payment.status?.transaction_verified) {
        return res.status(409).json({ error: "Payment is not fully verified yet" });
      }
      await grantPremium(user.uid, paymentId);
      return res.status(200).json({ success: true, premium: true });
    }

    return res.status(400).json({ error: "Unsupported action" });
  } catch (error) {
    const status = error?.message === "Unauthorized" ? 401 : 500;
    return res.status(status).json({ error: error?.message || "Payment processing failed" });
  }
};
