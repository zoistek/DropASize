const fs=require('fs'),vm=require('vm'),assert=require('assert');
const gate=fs.readFileSync('web/gate.js','utf8'),ui=fs.readFileSync('web/signup.js','utf8');
const mem=new Map(),calls=[];let saved=null,entered=null,modalEmail=null,response={user:{id:'new-user'}};
const ctx={session:null,document:{getElementById:()=>null},window:{},localStorage:{},lsGet:k=>mem.get(k)||null,lsDel:k=>mem.delete(k),rawSet:function(k,v){mem.set(k,v)},Date,JSON,Error,Object,String,
 authCall:async(path,body)=>{calls.push({path,body});if(response instanceof Error)throw response;return response},saveSession:s=>{saved=s;ctx.session=s},enter:async(u)=>entered=u,
 markDirty:()=>{},flush:async()=>{},location:{},encodeURIComponent};
vm.createContext(ctx);
vm.runInContext(gate.slice(gate.indexOf('  var QUIZ_PENDING='),gate.indexOf('  function showSignupVerification(')),ctx);
ctx.showSignupVerification=em=>modalEmail=em;
mem.set('nt:account',JSON.stringify({name:'New member',pw:'must-not-be-stored'}));mem.set('nt:profile',JSON.stringify({name:'New member',consent:{adult:true}}));mem.set('nt:daily-target',JSON.stringify({calories:1500}));
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 await assert.rejects(ctx.createEmailAccount('bad','password'),/valid email/);assert.equal(calls.length,0);
 await assert.rejects(ctx.createEmailAccount('new@example.com','123'),/6 characters/);assert.equal(calls.length,0);
 const result=await ctx.createEmailAccount('NEW@example.com','secret-password');assert(result.pending);assert.equal(modalEmail,'new@example.com');assert.equal(saved,null);assert.equal(entered,null);assert(!mem.get('ntonboardingpending').includes('must-not-be-stored'));assert(!mem.get('ntonboardingpending').includes('secret-password'));
 await assert.rejects(ctx.verifyEmailAccount('new@example.com','abc'),/verification code/);assert.equal(calls.length,1);
 response=new Error('Token has expired or is invalid');await assert.rejects(ctx.verifyEmailAccount('new@example.com','123456'),/expired/);assert.equal(saved,null);assert.equal(entered,null);
 response={access_token:'verified-session',user:{id:'new-user',email:'new@example.com',email_confirmed_at:'2026-11-12'}};
 let dismissed=false;ctx.enter=async u=>{assert(dismissed,'verification overlay must hide before permission screens');entered=u};
 await ctx.verifyEmailAccount('new@example.com','123456',()=>{dismissed=true});assert.equal(saved.access_token,'verified-session');assert.equal(entered.id,'new-user');assert.equal(calls.at(-1).path,'verify');assert.equal(calls.at(-1).body.type,'email');
 // A completed code is not reused when setup needs a retry.
 const verifiedCalls=calls.length;ctx.enter=async()=>{throw new Error('Sync failed')};
 await assert.rejects(ctx.verifyEmailAccount('new@example.com','123456'),/Sync failed/);assert.equal(calls.length,verifiedCalls);
 ctx.enter=async u=>entered=u;await ctx.verifyEmailAccount('new@example.com','123456');assert.equal(calls.length,verifiedCalls);
 // A live quiz restarts from the saved session so permission pages cannot destroy its mounted React root.
 let reloaded=false;ctx.document.getElementById=()=>({dataset:{ran:'1'}});ctx.reloadApp=()=>{reloaded=true};ctx.enter=async()=>{throw new Error('must boot fresh')};
 await ctx.verifyEmailAccount('new@example.com','123456');assert(reloaded);assert.equal(calls.length,verifiedCalls);ctx.document.getElementById=()=>null;
 // A code for another account cannot attach this member's staged quiz answers.
 await ctx.finishGoogleQuiz({email:'other@example.com'},[]);assert.equal(mem.has('ntonboardingpending'),false);
 // Exercise component input validation with real hooks state transitions and submit handlers.
 let states=[],index=0,signupCalls=0;
 const uctx={React:{createElement:(type,props,...children)=>({type,props:props||{},children}),useState:init=>{const k=index++;if(!(k in states))states[k]=init;return [states[k],v=>states[k]=v]}},window:{},Error};
 vm.createContext(uctx);vm.runInContext(ui,uctx);
 function render(disabled=false){index=0;return uctx.NtEmailSignup({disabled,onSignup:async()=>{signupCalls++;return {pending:true}}})}
 function find(n,id){if(n&&n.props&&n.props.id===id)return n;for(const c of n.children||[]){if(c&&typeof c==='object'){const hit=find(c,id);if(hit)return hit}}}
 let tree=render();for(const [id,value] of [['nt-signup-email','new@example.com'],['nt-signup-password','password1'],['nt-signup-confirm','different']])find(tree,id).props.onChange({target:{value}});
 tree=render();await tree.props.onSubmit({preventDefault(){}});assert.equal(signupCalls,0);assert(states.includes('The passwords don’t match.'));
 tree=render();find(tree,'nt-signup-confirm').props.onChange({target:{value:'password1'}});tree=render(true);await tree.props.onSubmit({preventDefault(){}});assert.equal(signupCalls,0);
 tree=render();await tree.props.onSubmit({preventDefault(){}});assert.equal(signupCalls,1);tree=render();assert.equal(find(tree,'nt-signup-password').props.value,'');assert.equal(find(tree,'nt-signup-confirm').props.value,'');
 const template=fs.readFileSync('supabase/templates/confirmation.html','utf8');assert(template.includes('{{ .Token }}'));assert(template.includes('{{ .ConfirmationURL }}'));
 // Auth requests release the busy state on a stalled connection and clear their timer.
 const authCtx={SB_URL:'https://example.test',SB_KEY:'public',AbortController,JSON,Error,setTimeout:fn=>setTimeout(fn,5),clearTimeout,realFetch:(_url,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('aborted'))))};
 vm.createContext(authCtx);vm.runInContext(gate.slice(gate.indexOf('  async function authCall('),gate.indexOf('  var refreshing=')),authCtx);
 await assert.rejects(authCtx.authCall('verify',{}),/connection timed out/);
 authCtx.realFetch=async()=>({ok:false,json:async()=>({message:'Token has expired'})});await assert.rejects(authCtx.authCall('verify',{}),/Token has expired/);
 authCtx.realFetch=async()=>({ok:true,json:async()=>({access_token:'ok'})});assert.equal((await authCtx.authCall('verify',{})).access_token,'ok');
 console.log('Email signup passed: validation, consent guard, password mismatch, secret-free quiz handoff, no login before valid code, rejected/expired code, verified session, email ownership and password cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
