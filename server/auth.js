/** Optional localhost coordinator sessions. Configured via env; never active by
 * default in the offline demo. Not a substitute for enterprise SSO/RBAC.
 */
import crypto from 'node:crypto';
export const internalMcpSecret=crypto.randomBytes(32).toString('hex');
const users=(()=>{const raw=process.env.ROUTERESCUE_USERS_JSON;if(!raw)return null;
 const obj=JSON.parse(raw);
 if(!obj||typeof obj!=='object'||Array.isArray(obj)||!Object.keys(obj).length||Object.keys(obj).length>20)throw Error('Invalid ROUTERESCUE_USERS_JSON');
 const out=new Map();for(const [name,password] of Object.entries(obj)){
  if(!/^[a-zA-Z0-9_-]{2,30}$/.test(name)||typeof password!=='string'||password.length<12||password.length>120)throw Error('Each user needs a safe username and password of at least 12 characters');
  const salt=crypto.randomBytes(16);out.set(name,{salt,hash:crypto.scryptSync(password,salt,64)});
 }
 return out;
})();
const sessions=new Map();
export const authEnabled=Boolean(users);
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function cookie(req){const line=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('rr_session='));return line?.slice('rr_session='.length)??null;}
export function actor(req){if(!users)return {username:'local-demo',role:'coordinator'};
 const raw=cookie(req);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;
 const token=sessions.get(digest(raw));if(!token||token.expires<Date.now()){if(token)sessions.delete(digest(raw));return null;}
 return {username:token.username,role:'coordinator'};
}
export function login(req,res,username,password){
 if(!users)throw Error('Local authentication is not enabled');
 const entry=users.get(username);const candidate=crypto.scryptSync(typeof password==='string'&&password.length<=120?password:'',entry?.salt??Buffer.alloc(16),64);
 if(!entry||!crypto.timingSafeEqual(candidate,entry.hash))return false;
 const raw=crypto.randomBytes(32).toString('hex');
 sessions.set(digest(raw),{username,expires:Date.now()+2*60*60*1000});
 const secure=req.socket.encrypted?'; Secure':'';
 res.setHeader('Set-Cookie',`rr_session=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200${secure}`);
 return true;
}
export function logout(req,res){const token=cookie(req);if(token)sessions.delete(digest(token));res.setHeader('Set-Cookie','rr_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');}
export function hasInternalMcpCredential(req){const incoming=req.headers['x-routerescue-internal'];return typeof incoming==='string'&&incoming.length===internalMcpSecret.length&&crypto.timingSafeEqual(Buffer.from(incoming),Buffer.from(internalMcpSecret));}
