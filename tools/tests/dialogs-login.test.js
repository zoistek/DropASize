const fs=require('fs'),vm=require('vm'),assert=require('assert');
const listeners={},elements=[];
function node(tag){const el={tag,children:[],style:{},isConnected:true,attributes:{},value:'',setAttribute(k,v){this.attributes[k]=v},appendChild(x){this.children.push(x);x.parent=this},remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)},focus(){doc.activeElement=this},click(){if(this.onclick)this.onclick()}};elements.push(el);return el}
const doc={createElement:node,activeElement:null,addEventListener:(k,fn)=>listeners[k]=fn,removeEventListener:k=>delete listeners[k]};doc.body=node('body');const ctx={window:{},document:doc,Promise,String};vm.createContext(ctx);vm.runInContext(fs.readFileSync('web/dialogs.js','utf8'),ctx);
const tick=()=>new Promise(r=>setImmediate(r));const buttons=()=>{const out=[];function walk(n){if(n.tag==='button')out.push(n);n.children.forEach(walk)}walk(doc.body);return out};
(async()=>{
 let pending=ctx.window.ntConfirm('End fast early?');await tick();assert.equal(doc.body.children[0].children[0].attributes.role,'dialog');assert(doc.body.children[0].children[0].style.cssText.includes('#fff'));buttons().find(x=>x.textContent==='Cancel').click();assert.equal(await pending,false);assert.equal(doc.body.children.length,0);
 pending=ctx.window.ntConfirm('Remove photo?');await tick();buttons().find(x=>x.textContent==='Confirm').click();assert.equal(await pending,true);
 pending=ctx.window.ntPrompt('To confirm, type DELETE');await tick();doc.activeElement.value='DELETE';buttons().find(x=>x.textContent==='Continue').click();assert.equal(await pending,'DELETE');
 pending=ctx.window.ntPrompt('Optional reason');await tick();listeners.keydown({key:'Escape',preventDefault(){}});assert.equal(await pending,null);
 pending=ctx.window.ntAlert('Done');await tick();buttons().find(x=>x.textContent==='OK').click();assert.equal(await pending,true);
 const gate=fs.readFileSync('web/gate.js','utf8'),html=fs.readFileSync('web/index.html','utf8');
 assert(gate.includes("localStorage.setItem('ntloginrequest','1')"));assert(gate.includes("wantLogin=lsGet('ntloginrequest')==='1'"));assert(gate.includes("lsDel('ntloginrequest')"));assert(html.includes('async function end()'));assert(html.includes('!await window.ntConfirm(hrs<.25'));
 const cfg=JSON.parse(fs.readFileSync('app.json','utf8'));const splash=cfg.expo.plugins.filter(x=>x==='expo-splash-screen'||Array.isArray(x)&&x[0]==='expo-splash-screen');assert.equal(splash.length,1);assert.equal(splash[0][1].image,'./assets/icon.png');assert.equal(splash[0][1].dark.image,'./assets/icon.png');
 console.log('Branded dialogs/login passed: cancel/confirm/prompt/alert, Escape, modal cleanup, persistent login flag, async fasting action and single branded native splash');
})().catch(e=>{console.error(e);process.exitCode=1});
