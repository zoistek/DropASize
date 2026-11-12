const fs=require('fs'),path=require('path'),vm=require('vm');
const parse=require('@babel/parser').parse,traverse=require('@babel/traverse').default,generate=require('@babel/generator').default;
module.exports=function(html){
  const source=html.match(/<script type="text\/plain" id="nt-app">([\s\S]*?)<\/script>/)[1],items=new Map(),rests=new Set();
  traverse(parse(source),{FunctionDeclaration(p){
    if(p.node.id?.name!=='FiBody')return;
    const value=name=>vm.runInNewContext('('+generate(p.scope.getBinding(name).path.node.init).code+')',{}, {timeout:1000});
    const add=item=>{if(!item||!item.n)return;const key=item.n.toLowerCase();if(!items.has(key))items.set(key,{id:key.replace(/[^a-z0-9]+/g,'-'),n:item.n,cue:item.cue||'',r:String(item.r||''),s:item.s||Math.max(30,(parseInt(item.r)||10)*4+10)})};
    for(const workout of value('it')){[...(workout.warm||[]),...(workout.ex||[]),...(workout.cool||[])].forEach(add);for(const seconds of [workout.rest,workout.rr])if(seconds>0)rests.add(seconds)}
    value('fi').forEach(n=>add({n}));Object.values(value('Nt')).flat().forEach(add);
  }});
  if(items.size<50)throw Error('Exercise catalog extraction failed');
  const catalog={exercises:[...items.values()].sort((a,b)=>a.n.localeCompare(b.n)),rests:[...rests].sort((a,b)=>a-b).map(s=>({id:'rest-'+s,n:'Rest',s,isRest:true,r:'',cue:'Rest and breathe.'}))};
  fs.writeFileSync(path.join(__dirname,'pages/training-catalog.json'),JSON.stringify(catalog,null,2)+'\n');
  return catalog;
};
