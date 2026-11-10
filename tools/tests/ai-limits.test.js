// node tools/tests/ai-limits.test.js — runs the deployed handler against mocked services.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),{stripTypeScriptTypes}=require('node:module');
let source=fs.readFileSync(__dirname+'/../../supabase/functions/ai-test/index.ts','utf8').replace(/^import .*;\n/gm,'');
source=stripTypeScriptTypes(source);
let handler,user='member-a',fail=false,apiCalls=0;
const counts=new Map(),mockClient={auth:{getUser:async()=>({data:{user:user?{id:user}:null}})},rpc:async(name,p)=>{
 const key=user+':'+p.p_kind,n=counts.get(key)||0;
 if(name==='ai_take'){if(n>=p.p_limit)return {data:-1};counts.set(key,n+1);return {data:n+1}}
 if(name==='ai_refund'){counts.set(key,Math.max(0,n-1));return {data:null}}
 throw Error('Unexpected RPC '+name);
}};
const ctx={createClient:()=>mockClient,Deno:{env:{get:k=>({OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'}[k]||'test')},serve:fn=>handler=fn},Response,Request,console,fetch:async(url)=>{
 if(url.includes('/moderations'))return Response.json({results:[{categories:{}}]});apiCalls++;
 if(fail)return Response.json({error:'offline'},{status:503});
 return Response.json({id:'answer',choices:[{message:{content:'{"heading":"Saved meal"}'},finish_reason:'stop'}]});
}};vm.createContext(ctx);vm.runInContext(source,ctx);
const build=prompt=>handler(new Request('https://test/ai-test',{method:'POST',body:JSON.stringify({messages:[{role:'user',content:prompt}],max_tokens:1000})}));
(async()=>{
 const prompts=['A client is at Tesco','Write the full recipe','You are a meal-planning coach','Suggest ready meals','A client wants a takeaway'];
 const results=await Promise.all(prompts.map(build));assert(results.every(r=>r.status===200));assert.equal(results.at(-1).headers.get('x-ai-remaining'),'0');assert.equal((await build('another plan')).status,429);assert.equal(apiCalls,5);
 for(let n=0;n<20;n++)assert.equal((await build('Her message: help with lunch')).status,200);
 const capped=await build('Her message: another question');assert.equal(capped.status,429);assert.match((await capped.json()).error.message,/20 Coach messages/);assert.equal(apiCalls,25);
 user='member-b';assert.equal((await build('A meal plan')).status,200);fail=true;assert.equal((await build('another meal plan')).status,502);assert.equal(counts.get('member-b:recipe'),1);fail=false;
 // A new handler context/device cannot reset the server's existing account count.
 user='member-a';assert.equal((await build('new device plan')).status,429);
 user=null;assert.equal((await build('no login')).status,401);
 const gate=fs.readFileSync(__dirname+'/../../web/gate.js','utf8');assert(gate.includes("SB_URL+'/functions/v1/ai-test'"));
 console.log('AI limits passed: shared 5 builds, separate 20 messages, concurrent requests, account isolation, refunds, signed-in access and test routing');
})().catch(e=>{console.error(e);process.exitCode=1});
