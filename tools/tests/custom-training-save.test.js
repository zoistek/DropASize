const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('web/adminTraining.js','utf8');
function harness(){
 const fields={},memory=new Map(),saved=[],added=[];let removed=false,fail=false;
 const element=()=>({value:'',style:{},dataset:{},setAttribute(){},focus(){},remove(){removed=true}});
 const ctx={console,crypto:require('crypto').webcrypto,AbortSignal,session:{user:{id:'coach'}},SB_URL:'https://example.com',SB_KEY:'public',token:async()=>'',esc:String,localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},document:{createElement:element,body:{appendChild(){}}},$:s=>fields[s]||(fields[s]=element()),$$:()=>[],db:{doc:async()=>({list:[]}),docSet:async(c,d,v)=>{if(fail)throw Error('offline');saved.push(JSON.parse(JSON.stringify(v)))}},fetch:async()=>({ok:true,json:async()=>({images:{before:'https://example.com/b.jpg',after:'https://example.com/a.jpg'}})})};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,fields,memory,saved,added,get removed(){return removed},set fail(v){fail=v},open(){ctx.customExerciseDialog(i=>added.push(JSON.parse(JSON.stringify(i))));ctx.$('#ce-name').value='Bear pushups';ctx.$('#ce-details').value='Lower and press';ctx.$('#ce-reps').value='10';ctx.$('#ce-seconds').value='60'}};
}
(async()=>{
 let h=harness();h.open();await h.fields['#ce-generate'].onclick();assert.equal(h.saved.length,1);assert.equal(h.saved[0].list[0].images.after,'https://example.com/a.jpg');assert.equal(h.added.length,1);assert(!h.removed);await h.fields['#ce-save'].onclick();assert(h.removed);assert.equal(h.memory.size,0);
 h=harness();h.open();h.fail=true;await h.fields['#ce-generate'].onclick();assert(!h.removed);assert.equal(h.added.length,0);assert.match(h.fields['#ce-message'].textContent,/retry without generating/);assert(JSON.parse([...h.memory.values()][0]).images.before);h.fail=false;await h.fields['#ce-save'].onclick();assert(h.removed);assert.equal(h.saved.length,1);
 // Exercise callbacks must add once and preserve individually chosen slot timing.
 const callback=source.match(/  function customSaved\(item\)\{[^\n]+/)[0];
 const ctx={modal:{},catalog:{exercises:[]},plan:{items:[]},rows(){},options(){},defaults(){},message(){},$:()=>({}),JSON};vm.createContext(ctx);vm.runInContext(callback,ctx);const item={id:'custom',n:'Bear pushups',s:60,r:'10'};ctx.customSaved(item);ctx.plan.items[0].s=90;ctx.customSaved({...item,n:'Updated'});assert.equal(ctx.plan.items.length,1);assert.equal(ctx.plan.items[0].s,90);assert.equal(ctx.plan.items[0].n,'Updated');
 // Execute the actual plan handlers with successful and failing persistence.
 const save=source.match(/  \$\('#ct-save',modal\)\.onclick=async function\(\)\{[^\n]+/)[0];
 let closed=false,notice='',error='';const handlers={};const c={busy:false,modal:{remove(){closed=true}},lock(){},persist:async()=>{},toast:t=>notice=t,message:t=>error=t,$:s=>handlers[s]||(handlers[s]={})};vm.createContext(c);vm.runInContext(save,c);await handlers['#ct-save'].onclick();assert(closed);assert.match(notice,/saved/);closed=false;c.persist=async()=>{throw Error('offline')};await handlers['#ct-save'].onclick();assert(!closed);assert.equal(error,'offline');
 const assign=source.slice(source.indexOf("  $('#ct-assign',modal).onclick="),source.indexOf("  rows();options();$('#ct-members'"));
 Object.assign(c,{selected:new Set(['member']),users:[{id:'member',email:'member@example.com'}],persist:async()=>{},plan:{},window:{NtTraining:{assignment:()=>({})}},session:{user:{email:'coach@example.com'}},db:{userSet:async()=>{}},memberRows(){}});handlers['#ct-start']={value:'2026-11-12'};vm.runInContext(assign,c);await handlers['#ct-assign'].onclick();assert(closed);assert.equal(c.selected.size,0);closed=false;c.selected.add('member');c.db.userSet=async()=>{throw Error('denied')};await handlers['#ct-assign'].onclick();assert(!closed);assert.equal(c.selected.size,1);assert.match(error,/Not assigned:.*denied/);
 console.log('Custom exercise cloud save, draft recovery on failure, retry without regeneration, session insertion without duplicates, and success-only popup closing passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
