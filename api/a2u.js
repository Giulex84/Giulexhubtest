module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  return res.status(410).json({error:"Test-Pi gameplay rewards are disabled while server-verified challenges are being evaluated"});
};
