"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const pi_1 = require("../lib/pi");
const store_1 = require("../lib/store");
const metrics_1 = require("../lib/metrics");
async function fulfill(payment) {
    const item = (0, pi_1.productForPayment)(payment);
    if (!item)
        throw new Error("Unexpected payment product");
    if (item.type === "premium") {
        await (0, store_1.grantPremium)(payment.user_uid, payment.identifier);
        await (0, metrics_1.safeRecordMetric)(payment.user_uid, "premium_purchased", payment.identifier);
        return { premium: true, product: item.product };
    }
    const replayCredits = await (0, store_1.grantReplayCredit)(payment.user_uid, payment.identifier);
    await (0, metrics_1.safeRecordMetric)(payment.user_uid, "replay_purchased", payment.identifier);
    return { premium: false, replayCredits, product: item.product };
}
async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST")
        return res.status(405).json({ error: "Method not allowed" });
    if (!(0, store_1.isStoreConfigured)())
        return res.status(503).json({ error: "Purchase storage is not configured" });
    const { action, paymentId, txid } = req.body || {};
    if (!paymentId || typeof paymentId !== "string")
        return res.status(400).json({ error: "Missing paymentId" });
    try {
        if (action === "recover") {
            let payment = await (0, pi_1.getPayment)(paymentId);
            const paymentUid = payment.user_uid;
            let invalid = (0, pi_1.validateStorePayment)(payment);
            if (invalid)
                return res.status(400).json({ error: invalid });
            await (0, store_1.claimPayment)(payment.user_uid, paymentId);
            if (!payment.status?.developer_completed) {
                const authoritativeTxid = payment.transaction?.txid || txid;
                if (!authoritativeTxid)
                    return res.status(409).json({ error: "Incomplete payment has no transaction yet" });
                if (payment.transaction?.txid && txid && payment.transaction.txid !== txid)
                    return res.status(400).json({ error: "Transaction does not match payment" });
                const result = await (0, pi_1.piPost)(`/payments/${encodeURIComponent(paymentId)}/complete`, { txid: authoritativeTxid });
                if (!result.response.ok)
                    return res.status(result.response.status).json(result.data);
            }
            payment = await (0, pi_1.getPayment)(paymentId);
            invalid = (0, pi_1.validateStorePayment)(payment, paymentUid);
            if (invalid)
                return res.status(400).json({ error: invalid });
            if (!payment.status?.developer_completed || !payment.status?.transaction_verified)
                return res.status(409).json({ error: "Payment is not fully verified" });
            return res.status(200).json({ success: true, recovered: true, ...await fulfill(payment) });
        }
        const token = (0, pi_1.bearerFromRequest)(req);
        if (!token)
            return res.status(401).json({ error: "Missing Pi access token" });
        const user = await (0, pi_1.verifyAccessToken)(token);
        let payment = await (0, pi_1.getPayment)(paymentId);
        let invalid = (0, pi_1.validateStorePayment)(payment, user.uid);
        if (invalid)
            return res.status(400).json({ error: invalid });
        await (0, store_1.claimPayment)(user.uid, paymentId);
        if (action === "approve") {
            if (payment.status?.developer_approved)
                return res.status(200).json({ success: true, alreadyApproved: true });
            const result = await (0, pi_1.piPost)(`/payments/${encodeURIComponent(paymentId)}/approve`);
            return res.status(result.response.status).json(result.response.ok ? { success: true } : result.data);
        }
        if (action === "complete") {
            if (!txid || typeof txid !== "string")
                return res.status(400).json({ error: "Missing txid" });
            if (payment.transaction?.txid && payment.transaction.txid !== txid)
                return res.status(400).json({ error: "Transaction does not match payment" });
            if (!payment.status?.developer_completed) {
                const result = await (0, pi_1.piPost)(`/payments/${encodeURIComponent(paymentId)}/complete`, { txid });
                if (!result.response.ok)
                    return res.status(result.response.status).json(result.data);
            }
            payment = await (0, pi_1.getPayment)(paymentId);
            invalid = (0, pi_1.validateStorePayment)(payment, user.uid);
            if (invalid)
                return res.status(400).json({ error: invalid });
            if (!payment.status?.developer_completed || !payment.status?.transaction_verified)
                return res.status(409).json({ error: "Payment is not fully verified yet" });
            return res.status(200).json({ success: true, ...await fulfill(payment) });
        }
        return res.status(400).json({ error: "Unsupported action" });
    }
    catch (error) {
        return res.status(error?.message === "Unauthorized" ? 401 : 500).json({ error: error?.message || "Payment processing failed" });
    }
}

module.exports = exports.default;
