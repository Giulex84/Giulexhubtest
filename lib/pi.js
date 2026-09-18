const PI_API_BASE="https://api.minepi.com/v2";
const PREMIUM_AMOUNT=1;
const PREMIUM_MEMO="Arena Test Premium Unlock";
const PREMIUM_PRODUCT="arena_test_premium_v1";
const REPLAY_PRODUCT="arena_test_daily_replay_v1";
const REPLAY_AMOUNT=0.1;
const REPLAY_MEMO="Arena Test Daily Replay Ticket";
function getServerApiKey(){const key=process.env.PI_API_KEY;if(!key)throw new Error("PI_API_KEY not configured");return key;}
function bearerFromRequest(req){const value=req.headers.authorization;if(!value||!value.startsWith("Bearer "))return null;return value.slice(7).trim()||null;}
async function verifyAccessToken(accessToken){const response=await fetch(`${PI_API_BASE}/me`,{headers:{Authorization:`Bearer ${accessToken}`},cache:"no-store"});if(!response.ok)throw new Error("Unauthorized");const user=await response.json();if(!user?.uid)throw new Error("Invalid Pi user response");return user;}
async function getPayment(paymentId){const response=await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}`,{headers:{Authorization:`Key ${getServerApiKey()}`},cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||"Could not fetch payment");return data;}
async function piPost(path,body){const response=await fetch(`${PI_API_BASE}${path}`,{method:"POST",headers:{Authorization:`Key ${getServerApiKey()}`,...(body===undefined?{}:{"Content-Type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json().catch(()=>({}));return{response,data};}
function productForPayment(payment){const product=payment?.metadata?.product;if(product===PREMIUM_PRODUCT)return{product,amount:PREMIUM_AMOUNT,memo:PREMIUM_MEMO,type:"premium"};if(product===REPLAY_PRODUCT)return{product,amount:REPLAY_AMOUNT,memo:REPLAY_MEMO,type:"replay"};return null;}
function validateStorePayment(payment,expectedUid){if(!payment?.identifier||!payment.user_uid)return"Malformed payment";if(expectedUid&&payment.user_uid!==expectedUid)return"Payment does not belong to authenticated user";if(payment.direction!=="user_to_app")return"Unexpected payment direction";if(payment.network!=="Pi Testnet")return"Unexpected payment network";const item=productForPayment(payment);if(!item)return"Unexpected payment product";if(Number(payment.amount)!==item.amount)return"Unexpected payment amount";if(payment.memo!==item.memo)return"Unexpected payment memo";if(payment.status?.cancelled||payment.status?.user_cancelled)return"Payment is cancelled";return null;}
const validatePremiumPayment=validateStorePayment;
module.exports={PI_API_BASE,PREMIUM_AMOUNT,PREMIUM_MEMO,PREMIUM_PRODUCT,REPLAY_AMOUNT,REPLAY_MEMO,REPLAY_PRODUCT,bearerFromRequest,verifyAccessToken,getPayment,piPost,productForPayment,validateStorePayment,validatePremiumPayment,getServerApiKey};
