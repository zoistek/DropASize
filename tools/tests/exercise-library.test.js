const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('web/adminTraining.js','utf8'),base={exercises:[{id:'squat',n:'Squat',s:60},{id:'press',n:'Press',s:45}],rests:[]};
let doc={list:[]};const ctx={fetch:async()=>({ok:true,json:async()=>structuredClone(base)}),db:{doc:async()=>structuredClone(doc),docSet:async(c,id,data)=>{assert.equal(c,'config');assert.equal(id,'custom-exercises');doc=structuredClone(data)}},JSON,Map,Array,Date};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 const custom={id:'custom-bear',custom:true,n:'Bear pushups',s:90,images:{before:'https://example.com/b.jpg',after:'https://example.com/a.jpg'}};
 await ctx.saveCustomExercise(custom);let library=await ctx.trainingCatalog();assert.equal(library.exercises.length,3);assert.equal(library.exercises.filter(x=>x.n.toLowerCase().includes('bear')).length,1);
 await ctx.saveCustomExercise({...base.exercises[0],n:'Coach squat',s:120});library=await ctx.trainingCatalog();assert.equal(library.exercises.length,3);assert.equal(library.exercises.find(x=>x.id==='squat').s,120);
 const snapshot=structuredClone(library.exercises);await ctx.saveCustomExercise({...custom,deleted:true});library=await ctx.trainingCatalog();assert(!library.exercises.some(x=>x.id===custom.id));assert(library.all.some(x=>x.id===custom.id&&x.deleted));assert(snapshot.some(x=>x.id===custom.id&&!x.deleted));
 await ctx.saveCustomExercise({...base.exercises[1],deleted:true});assert(!(await ctx.trainingCatalog()).exercises.some(x=>x.id==='press'));
 await ctx.saveCustomExercise({...custom,deleted:false});library=await ctx.trainingCatalog();assert(library.exercises.some(x=>x.id===custom.id));assert.equal(doc.list.filter(x=>x.id===custom.id).length,1);
 const admin=fs.readFileSync('web/admin.html','utf8');assert(admin.includes('id="pexercises"'));assert(admin.includes("$('#pexercises').onclick=exerciseLibrary"));assert(source.includes("$('#el-search',modal).oninput=draw"));assert(!/\bconfirm\(/.test(source));
 const catalog=JSON.parse(fs.readFileSync('web/pages/training-catalog.json','utf8'));assert(catalog.exercises.some(x=>x.images?.before.startsWith('https://')));
 console.log('Exercise library passed: saved custom search, built-in overrides without duplicates, reversible deletion/restoration, immutable existing snapshots, all-exercises entry point and retained artwork.');
})().catch(e=>{console.error(e);process.exitCode=1});
