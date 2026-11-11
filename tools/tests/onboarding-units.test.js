// node tools/tests/onboarding-units.test.js
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/../../web/index.html','utf8');
const source=html.slice(html.indexOf('function ntMeasureDraft('),html.indexOf('/* Regular, saved and AI recipes'));
const ctx={};vm.createContext(ctx);vm.runInContext(source,ctx);
const draft=(v,k,u)=>Array.from(ctx.ntMeasureDraft(v,k,u)),value=ctx.ntMeasureValue;
assert.deepEqual(draft('82','weight','kg'),['82']);assert.deepEqual(draft('82','weight','lbs'),['180.8']);
assert(Math.abs(Number(value(['180.8'],'weight','lbs'))-82.0095)<.001);
assert.equal(value(['82,5'],'weight','kg'),'82.5');assert.equal(value(['82.'],'weight','kg'),'82');
assert.equal(value(['5','5'],'height','ft'),'165.1');assert.equal(value(['6','0'],'height','ft'),'182.88');
assert.deepEqual(draft('182.88','height','ft'),['6','0']);assert.deepEqual(draft('165.1','height','ft'),['5','5']);
assert.equal(value(['5','5.5'],'height','ft'),'166.37');assert.equal(value(['5','12'],'height','ft'),'');assert.equal(value(['5.5','0'],'height','ft'),'');
for(const parts of [[''],['-2'],['abc'],['0']])assert.equal(value(parts,'weight','lbs'),'');
assert.deepEqual(draft('','height','ft'),['','']);assert.equal(value(['',''],'height','ft'),'');
// Switching the display only never writes a rounded imperial reading back to the profile.
const stable='82.123456';for(let i=0;i<20;i++){draft(stable,'weight','lbs');draft(stable,'weight','kg')}assert.equal(stable,'82.123456');
assert(html.includes('value:W.height,onChange:value=>M({...W,height:value})'));
assert(html.includes('value:W.weight,onChange:value=>M({...W,weight:value})'));
assert(html.includes('value:W.goal,onChange:value=>M({...W,goal:value})'));
assert(html.includes('Mn(Number(W.age),Number(W.height),Number(W.weight),Number(W.goal)'));
assert(html.includes('gridTemplateColumns:"repeat(2,minmax(0,1fr))"'));
assert(!html.includes('label:"Current weight (kg)"'));
console.log('Onboarding units passed: kg/lbs, cm/feet-inches, decimals, blank/invalid inputs, profile mapping and unchanged metric calculations');
