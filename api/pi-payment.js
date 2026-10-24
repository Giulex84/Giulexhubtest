"use strict";
const pi=require('../lib/pi'),store=require('../lib/store'),{safeRecordMetric}=require('../lib/metrics');
async function fulfill(payment){
 const item=pi.productForPayment(payment);
 if(!item)throw Error('Unexpected payment product');
 if(item.type==='premium'){await store.grantPremium(payment.user_uid,payment.identifier);await safeRecordMetric(payment.user_uid,'premium_purchased',payment.identifier);return{premium:true,product:item.product};}
 const replayCredits=await store.grantReplayCredit(payment.user_uid,payment.identifier);await safeRecordMetric(payment.user_uid,'replay_purchased',payment.identifier);return{premium:false,replayCredits,product:item.product};
}
const fingerprint=p=>JSON.stringify([p.identifier,p.user_uid,p.direction,p.network,p.amount,p.memo,p.metadata?.product]);
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const {action,paymentId,txid}=req.body||{};
 if(!['approve','complete','recover'].includes(action))return res.status(400).json({error:'Unsupported action'});
 if(typeof paymentId!=='string'||!paymentId||paymentId.length>256)return res.status(400).json({error:'Invalid paymentId'});
 if(txid!==undefined&&(typeof txid!=='string'||txid.length>256))return res.status(400).json({error:'Invalid txid'});
 const token=pi.bearerFromRequest(req);if(!token)return res.status(401).json({error:'Missing Pi access token'});
 if(!store.isStoreConfigured())return res.status(503).json({error:'Purchase storage is not configured'});
 let user;try{user=await pi.verifyAccessToken(token);}catch{return res.status(401).json({error:'Pi authentication could not be verified'});}
 try{
  let payment=await pi.getPayment(paymentId);
  const validate=p=>p?.identifier!==paymentId?'Payment identifier does not match request':pi.validateStorePayment(p,user.uid);
  let invalid=validate(payment);if(invalid)return res.status(400).json({error:invalid});
  const original=fingerprint(payment);
  await store.claimPayment(user.uid,paymentId);
  if(action==='approve'){
   if(payment.status?.developer_approved)return res.status(200).json({success:true,alreadyApproved:true});
   const result=await pi.piPost(`/payments/${encodeURIComponent(paymentId)}/approve`);
   return res.status(result.response.status).json(result.response.ok?{success:true}:result.data);
  }
  if(action==='complete'&&!txid)return res.status(400).json({error:'Missing txid'});
  if(txid&&payment.transaction?.txid&&payment.transaction.txid!==txid)return res.status(400).json({error:'Transaction does not match payment'});
  const authoritativeTxid=payment.transaction?.txid||txid;
  if(!authoritativeTxid)return res.status(409).json({error:'Payment has no transaction yet'});
  if(!payment.status?.developer_completed){
   const result=await pi.piPost(`/payments/${encodeURIComponent(paymentId)}/complete`,{txid:authoritativeTxid});
   if(!result.response.ok)return res.status(result.response.status).json(result.data);
  }
  payment=await pi.getPayment(paymentId);invalid=validate(payment);
  if(invalid||fingerprint(payment)!==original)return res.status(400).json({error:invalid||'Payment details changed during verification'});
  if(payment.transaction?.txid!==authoritativeTxid)return res.status(400).json({error:'Transaction changed during verification'});
  if(!payment.status?.developer_completed||!payment.status?.transaction_verified||payment.transaction?.verified!==true)return res.status(409).json({error:'Payment is not fully verified'});
  return res.status(200).json({success:true,...(action==='recover'?{recovered:true}:{}),...await fulfill(payment)});
 }catch{return res.status(503).json({error:'Payment service temporarily unavailable. Retry recovery before purchasing again.'});}
};
