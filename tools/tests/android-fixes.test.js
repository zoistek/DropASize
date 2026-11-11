const fs=require('fs'),vm=require('vm'),assert=require('assert');
(async()=>{
 const source=fs.readFileSync('native/healthSteps.js','utf8');
 const {readDailySteps,localDay}=await import('data:text/javascript,'+encodeURIComponent(source));
 for(const timezone of ['Asia/Jakarta','America/Los_Angeles','Europe/London']){
  process.env.TZ=timezone;const now=new Date(2026,10,11,0,15),calls=[];
  const HC={getGrantedPermissions:async()=>[{recordType:'Steps',accessType:'read'}],aggregateRecord:async req=>{calls.push(req);return {COUNT_TOTAL:calls.length===1?0:668}}};
  const r=await readDailySteps(HC,now);assert.equal(r.days['2026-11-11'],0);assert.equal(r.days['2026-11-08'],668);assert.equal(Object.keys(r.days).length,8);
  assert.equal(new Date(calls[0].timeRangeFilter.startTime).getHours(),0);assert.equal(new Date(calls[0].timeRangeFilter.endTime).getTime(),now.getTime());
  assert.equal(localDay(now),'2026-11-11');
 }
 // DST day uses calendar midnights, not a fixed 24-hour subtraction.
 process.env.TZ='America/Los_Angeles';const ranges=[];await readDailySteps({getGrantedPermissions:async()=>[{recordType:'Steps',accessType:'read'}],aggregateRecord:async x=>{ranges.push(x.timeRangeFilter);return{COUNT_TOTAL:0}}},new Date(2026,10,2,9));assert.equal((new Date(ranges[1].endTime)-new Date(ranges[1].startTime))/36e5,25);
 assert.equal((await readDailySteps({getGrantedPermissions:async()=>[]})).error,'denied');
 const gate=fs.readFileSync('web/gate.js','utf8');let posted,reloaded=false;
 const ctx={window:{ReactNativeWebView:{postMessage:x=>posted=JSON.parse(x)}},location:{reload:()=>reloaded=true},JSON};vm.createContext(ctx);vm.runInContext(gate.slice(gate.indexOf('  function reloadApp('),gate.indexOf('  function lsGet(')),ctx);ctx.reloadApp();assert.equal(posted.type,'reload');assert(!reloaded);delete ctx.window.ReactNativeWebView;ctx.reloadApp();assert(reloaded);
 const app=fs.readFileSync('App.js','utf8'),html=fs.readFileSync('web/index.html','utf8'),cfg=JSON.parse(fs.readFileSync('app.json','utf8'));
 assert(app.includes('setWebKey(k => k + 1)'));assert(app.includes('Animated.Image'));assert(cfg.expo.plugins.some(p=>Array.isArray(p)&&p[0]==='expo-splash-screen'));assert(html.includes('.nt-bottomnav>div{padding-bottom:6px!important}'));assert(html.includes('Xe=t=>ntDay(t)'));assert(gate.includes('},60000)'));
 console.log('Android fixes passed: local-day zero reset, 8-day history, DST, permission denial, native remount/browser reload, branded splash and single bottom inset');
})().catch(e=>{console.error(e);process.exitCode=1});
