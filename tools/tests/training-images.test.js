const fs=require('fs'),assert=require('assert'),{stripTypeScriptTypes}=require('node:module');
(async()=>{
 const {createImageHandler}=await import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(fs.readFileSync('supabase/functions/coach-training-images-test/handler.ts','utf8'))));
 function fixture(){
  const state={user:true,coach:true,active:true,key:'mock-key',status:200,noImage:false,timeout:false,storageFail:false,requests:[],uploads:[],removed:[]};
  const storage={upload:async(path,bytes)=>{state.uploads.push(path);return {error:state.storageFail&&state.uploads.length===2?Error('Storage full'):null}},getPublicUrl:path=>({data:{publicUrl:'https://storage.example/'+path}}),remove:async paths=>{state.removed.push(...paths);return {error:null}}};
  const client={auth:{getUser:async()=>({data:{user:state.user?{id:'coach-id'}:null}})},rpc:async name=>({data:name==='is_coach'?state.coach:state.active?'active':'banned'}),storage:{from:()=>storage}};
  const handler=createImageHandler({caller:()=>client,key:()=>state.key,fetcher:async(url,options)=>{if(!url.includes(':generateContent'))return new Response('',{status:404});state.requests.push(JSON.parse(options.body));if(state.timeout)throw Error('Timeout');if(state.status!==200)return Response.json({error:{message:'Provider error'}},{status:state.status});if(state.noImage)return Response.json({candidates:[{finishReason:'SAFETY'}]});return Response.json({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'iVBORw0KGgo='}}]}}]})}});
  const call=async(patch={})=>{const response=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({name:'Chair squat',details:'Start seated and stand upright.',reps:'10',seconds:45,prompt:'Side view',...patch})}));return {status:response.status,body:await response.json()}};
  return {state,call};
 }
 let f=fixture();f.state.user=false;assert.equal((await f.call()).status,401);assert.equal(f.state.requests.length,0);
 f=fixture();f.state.coach=false;assert.equal((await f.call()).status,403);f.state.coach=true;f.state.active=false;assert.equal((await f.call()).status,403);
 f=fixture();f.state.key='';assert.equal((await f.call()).status,503);assert.match((await f.call()).body.error,/VOICE/);assert.equal(f.state.requests.length,0);
 f=fixture();assert.equal((await f.call({seconds:0})).status,400);assert.equal(f.state.requests.length,0);
 f=fixture();let result=await f.call();assert.equal(result.status,200);assert.equal(f.state.requests.length,2);assert(f.state.requests[1].contents[0].parts.some(p=>p.inlineData));assert(f.state.requests[0].contents[0].parts.some(p=>p.text.includes('Side view')));assert(result.body.images.before.includes('before.png'));assert(result.body.images.after.includes('after.png'));assert(!JSON.stringify(result.body).includes('mock-key'));
 for(const [status,word] of [[429,/quota/],[401,/key/],[403,/access/],[404,/model/],[503,/temporarily/],[400,/description/]]){f=fixture();f.state.status=status;result=await f.call();assert.equal(result.status,502);assert.match(result.body.error,word);assert.equal(f.state.uploads.length,0)}
 f=fixture();f.state.noImage=true;result=await f.call();assert.match(result.body.error,/SAFETY/);assert.equal(f.state.uploads.length,0);
 f=fixture();f.state.timeout=true;assert.match((await f.call()).body.error,/timed out/);
 f=fixture();f.state.storageFail=true;result=await f.call();assert.match(result.body.error,/could not be saved/);assert.equal(f.state.removed.length,1);
 console.log('Training images passed: authenticated coaches only, active status, missing/rejected key, invalid fields, two consistent-frame requests, redo prompt, quota, model access, no image, timeout, storage cleanup and no key leakage. No real AI calls made.');
})().catch(e=>{console.error(e);process.exitCode=1});
