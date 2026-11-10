// node tools/tests/saved-builds.test.js
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/../../web/index.html','utf8');
for(const [,code] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(code.trim())new vm.Script(code);
const helper=html.slice(html.indexOf('function ntBuilds()'),html.indexOf('function qi()'));
const values=new Map(),states=[],ctx={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},Re:async p=>({heading:p,picks:[{name:'Meal',kcal:450}]}),Date,Math,Error,Object,Array,String,e:{},p:init=>{const i=states.length;states.push(init);return [init,v=>states[i]=v]},ye:fn=>fn(),React:{createElement:(type,props,...children)=>({type,props:props||{},children})}};
vm.createContext(ctx);vm.runInContext(helper,ctx);
(async()=>{
 const pages=['My day','Picks · My whole day','Picks · Single picks','Takeaway','Week · Dinner ideas','Week · Shopping list','Week · Recipe'];
 for(const page of pages)await ctx.ntBuildAi(page,{shop:'Tesco'},page);
 let saved=ctx.ntBuilds();assert.equal(saved.length,7);assert.equal(new Set(saved.map(x=>x.id)).size,7);assert.equal(saved[0].source,pages.at(-1));assert(saved.every(x=>!isNaN(Date.parse(x.savedAt))&&x.result.picks[0].name==='Meal'));
 const tree=ctx.NtSavedBuilds();assert.equal(states[0].length,7);
 // A failed generation must not add a build, and a storage failure must be reported.
 ctx.Re=async()=>{throw Error('AI failed')};await assert.rejects(ctx.ntBuildAi('Takeaway',{},'x'));assert.equal(ctx.ntBuilds().length,7);
 ctx.Re=async()=>({heading:'new'});ctx.localStorage.setItem=()=>{throw Error('quota')};await assert.rejects(ctx.ntBuildAi('My day',{},'x'),/could not be saved/);
 const shop=html.slice(html.indexOf('function qi()'),html.indexOf('async function Ji('));assert.equal((shop.match(/await ntBuildAi\(/g)||[]).length,6);assert(!shop.includes('await Re('));assert(shop.includes('id:"savedbuilds"'));assert(shop.includes('React.createElement(NtSavedBuilds,null)'));
 // Render with loaded state and exercise the confirmed delete action.
 ctx.localStorage.setItem=(k,v)=>values.set(k,v);ctx.p=(()=>{let i=0;return init=>{const n=i++;return [n===0?saved:n===2?saved[0].id:'',v=>states[n]=v]}})();
 const rendered=ctx.NtSavedBuilds(),buttons=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return}if(n.type==='button')buttons.push(n);(n.children||[]).forEach(walk)}walk(rendered);buttons.find(x=>x.children[0]==='Yes, delete').props.onClick();assert.equal(ctx.ntBuilds().length,6);assert(!ctx.ntBuilds().some(x=>x.id===saved[0].id));
 console.log('saved builds: all sources, timestamps, full results, failures, delete and inline script syntax passed');
})().catch(e=>{console.error(e);process.exitCode=1});
