const fs=require('fs'),vm=require('vm'),assert=require('assert');
const gate=fs.readFileSync(__dirname+'/../../web/gate.js','utf8'),html=fs.readFileSync(__dirname+'/../../web/index.html','utf8');
const mem=new Map(),synced=[],events=[];let rows=[];
const storage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k),key:i=>[...mem.keys()][i]??null,get length(){return mem.size}};
const ctx={localStorage:storage,lsGet:k=>storage.getItem(k),lsSet:(k,v)=>storage.setItem(k,v),lsDel:k=>storage.removeItem(k),rawSet:storage.setItem,rawRemove:storage.removeItem,OWNER_KEY:'ntowner',DIRTY_KEY:'ntdirty',dirty:{},saveDirty:()=>{},markDirty:k=>ctx.dirty[k]=1,flush:async()=>{synced.push(...Object.keys(ctx.dirty));ctx.dirty={}},rest:async()=>rows,origSetSilent:(k,v)=>storage.setItem(k,v),window:{dispatchEvent:e=>events.push(e.type)},location:{origin:'https://test.example',pathname:'/DropASize/'},SB_URL:'https://backend.example',APP_RETURN:'dropasize://auth',encodeURIComponent,Date,JSON,Object,Error,Event};
vm.createContext(ctx);
vm.runInContext(gate.slice(gate.indexOf("  var QUIZ_PENDING="),gate.indexOf('  /* ---------- quiz first:')),ctx);
vm.runInContext(gate.slice(gate.indexOf('  async function pullFromCloud('),gate.indexOf('  function origSetSilent(')),ctx);
const profile={name:'Test member',age:'38',height:'165',weight:'82',goal:'70',consent:{adult:true,notAdvice:true,healthData:true}},data={account:{name:'Test member',email:'',pw:'not-to-be-staged'},profile,'daily-target':{calories:1500,protein:100},'training-plan':{starter:true},'training-prefs':{daysN:3},'user-locale':{country:'uk'}};
function quiz(){mem.clear();ctx.dirty={};for(const[k,v]of Object.entries(data))storage.setItem('nt:'+k,JSON.stringify(v));storage.setItem('ntguest','1')}
(async()=>{
 quiz();ctx.googleStart({completeOnboarding:true});assert(ctx.location.href.includes('provider=google'));assert(!storage.getItem('ntonboardingpending').includes('not-to-be-staged'));
 // A default row makes the initial pull clear guest data: the staged quiz must still finish.
 rows=[{key:'profile',value:{name:'Member'},updated_at:'2026-11-10'}];const pulled=await ctx.pullFromCloud({id:'new-account'});assert.equal(JSON.parse(storage.getItem('nt:profile')).age,undefined);
 await ctx.finishGoogleQuiz({id:'new-account',email:'actual@gmail.com'},pulled);
 assert.equal(JSON.parse(storage.getItem('nt:profile')).height,'165');assert.equal(JSON.parse(storage.getItem('nt:account')).email,'actual@gmail.com');assert(!JSON.parse(storage.getItem('nt:account')).pw);assert(synced.includes('daily-target'));assert.equal(storage.getItem('ntonboardingpending'),null);
 // An established Google member keeps their existing profile and plan.
 quiz();ctx.stageGoogleQuiz();rows=[{key:'profile',value:{...profile,name:'Existing member'}},{key:'daily-target',value:{calories:1700}}];await ctx.pullFromCloud({id:'existing-account'});await ctx.finishGoogleQuiz({id:'existing-account',email:'existing@gmail.com'},rows);assert.equal(JSON.parse(storage.getItem('nt:profile')).name,'Existing member');assert.equal(JSON.parse(storage.getItem('nt:daily-target')).calories,1700);
 // Ordinary login Google behaviour remains a redirect, without a quiz completion marker.
 quiz();ctx.stageGoogleQuiz();ctx.googleStart();assert.equal(storage.getItem('ntonboardingpending'),null);assert(ctx.location.href.includes('redirect_to=https%3A%2F%2Ftest.example%2FDropASize%2F'));
 // Native route uses the same app callback and stages only the quiz route.
 quiz();let message;ctx.window.ReactNativeWebView={postMessage:x=>message=JSON.parse(x)};ctx.googleStart({completeOnboarding:true});assert.equal(message.type,'google');assert(message.url.includes('dropasize%3A%2F%2Fauth'));
 // Expired handoffs cannot assign old answers to a later login.
 const stale=JSON.parse(storage.getItem('ntonboardingpending'));stale.at=Date.now()-3600001;storage.setItem('ntonboardingpending',JSON.stringify(stale));storage.removeItem('nt:profile');await ctx.finishGoogleQuiz({email:'later@gmail.com'},[]);assert.equal(storage.getItem('nt:profile'),null);
 assert(gate.includes("window.dispatchEvent(new Event('nt-auth-ready'))"));assert(html.includes('window.addEventListener("nt-auth-ready",done)'));assert(!html.includes('"Create my plan"'));assert(html.includes('onClick:()=>X(1),disabled:!qCons},"Continue with Google"'));assert(html.includes('"aria-checked":!!W.c1'));assert(html.includes('"aria-checked":!!W.c2'));assert(html.includes('"aria-checked":!!W.c3'));assert(gate.includes('justify-content:center;text-align:center'));assert(gate.includes('gb.onclick=function(){say(\'\');gb.disabled=true;googleStart();'));
 console.log('Google onboarding passed: guest answers restored after cloud pull, correct email, no password staged, existing account preserved, browser/native Google routes, expiry, consent controls and single quiz CTA');
})().catch(e=>{console.error(e);process.exitCode=1});
