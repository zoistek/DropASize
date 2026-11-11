// node tools/tests/ai-limits.test.js — runs the deployed handler against mocked services.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),{stripTypeScriptTypes}=require('node:module');
let source=fs.readFileSync(__dirname+'/../../supabase/functions/ai-feature-test/index.ts','utf8').replace(/^import .*;\n/gm,'');
source=stripTypeScriptTypes(source);
let handler,user='member-a',fail=false,apiCalls=0;
const counts=new Map(),mockClient={auth:{getUser:async()=>({data:{user:user?{id:user}:null}})},rpc:async(name,p)=>{
 const key=user+':'+p.p_kind,n=counts.get(key)||0;
 if(name==='ai_feature_take'){if(n>=p.p_limit)return {data:-1};counts.set(key,n+1);return {data:n+1}}
 if(name==='ai_feature_refund'){counts.set(key,Math.max(0,n-1));return {data:null}}
 throw Error('Unexpected RPC '+name);
}};
const ctx={createClient:()=>mockClient,Deno:{env:{get:k=>({OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'}[k]||'test')},serve:fn=>handler=fn},Response,Request,console,fetch:async(url)=>{
 if(url.includes('/moderations'))return Response.json({results:[{categories:{}}]});apiCalls++;
 if(fail)return Response.json({error:'offline'},{status:503});
 return Response.json({id:'answer',choices:[{message:{content:'{"heading":"Saved meal"}'},finish_reason:'stop'}]});
}};vm.createContext(ctx);vm.runInContext(source,ctx);
const build=prompt=>handler(new Request('https://test/ai-test',{method:'POST',body:JSON.stringify({messages:[{role:'user',content:prompt}],max_tokens:1000})}));
(async()=>{
 const features={shopping_list:'[DropASize:shopping_list] Make list',shop:'[DropASize:shop] Takeaway',recipe:'Create ONE simple high-protein home recipe',makeover:'You are a nutrition coach. Here is the current recipe',checkin:'You are a warm, supportive weight-loss coach',insights:'You are a warm UK weight-loss coach',mindset:'You are a warm, wise weight-loss mindset coach',exercise:'Teach a woman how to do the exercise',food_estimate:'You are a nutrition coach in the UK. A client just ate',food_photo:'This is a photo of food or a meal',step_scan:'This is a photo or screenshot of a fitness tracker',equipment_scan:"This is a photo of someone's home workout equipment",other:'An unknown new feature'};
 for(const [kind,prompt] of Object.entries(features)){
   const results=await Promise.all(Array.from({length:5},()=>build(prompt)));
   assert(results.every(r=>r.status===200),kind);assert(results.every(r=>r.headers.get('x-ai-kind')===kind),kind);
   assert.equal((await build(prompt)).status,429,kind+' sixth request');
 }
 for(let n=0;n<20;n++)assert.equal((await build('Her message: help with lunch')).status,200);
 assert.equal((await build('Her message: another question')).status,429);
 // Shop modes all share a bucket, while the weekly shopping list has its own.
 assert.equal(ctx.kindOf([{content:'[DropASize:shop] My day'}]),'shop');
 assert.equal(ctx.kindOf([{content:'[DropASize:shop] Takeaway'}]),'shop');
 assert.equal(ctx.kindOf([{content:'[DropASize:shopping_list] Week list'}]),'shopping_list');
 user='member-b';assert.equal((await build(features.shop)).status,200);fail=true;assert.equal((await build(features.shop)).status,502);assert.equal(counts.get('member-b:shop'),1);fail=false;
 user='member-a';assert.equal((await build(features.shop)).status,429);
 user=null;assert.equal((await build('no login')).status,401);
 const gate=fs.readFileSync(__dirname+'/../../web/gate.js','utf8');assert(gate.includes("SB_URL+'/functions/v1/ai-feature-test'"));
 console.log('Feature limits passed: 13 independent 5-build allowances, 20 messages, shared Shop bucket, concurrency, account isolation, refunds and authentication');
})().catch(e=>{console.error(e);process.exitCode=1});
