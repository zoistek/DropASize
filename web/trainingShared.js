/* DropASize training shared: one exact timeline for coach and member. */
(function(root){
  function seconds(items){return (items||[]).reduce(function(total,item){return total+Number(item.s||0)},0)}
  function validate(plan){
    if(!plan||!String(plan.name||'').trim())throw new Error('Give the custom plan a name.');
    if(!Number.isInteger(plan.targetSeconds)||plan.targetSeconds<60||plan.targetSeconds>10800)throw new Error('Set a session length between 1 and 180 minutes.');
    if(!Array.isArray(plan.items)||!plan.items.some(function(item){return !item.isRest}))throw new Error('Add at least one exercise.');
    if(plan.items.length>100)throw new Error('A session can contain up to 100 exercises and rests.');
    plan.items.forEach(function(item){if(!item.n||!Number.isInteger(item.s)||item.s<1||item.s>3600)throw new Error('Every exercise or rest needs a valid name and duration in seconds.');if(item.custom&&(!item.images||!item.images.before||!item.images.after))throw new Error('Generate both images for custom exercises before assigning the plan.')});
    if(seconds(plan.items)>plan.targetSeconds)throw new Error('This session is over its time limit. Shorten a slot or increase the session length.');
    if(!Array.isArray(plan.days)||!plan.days.length||plan.days.length>7||new Set(plan.days).size!==plan.days.length||plan.days.some(function(day){return !Number.isInteger(day)||day<0||day>6}))throw new Error('Choose at least one training day.');
    if(!Number.isInteger(plan.weeks)||plan.weeks<1||plan.weeks>52)throw new Error('Choose a plan length between 1 and 52 weeks.');
    return plan;
  }
  function workout(plan){validate(plan);return {id:plan.id,n:plan.name,mins:Math.round(seconds(plan.items)/6)/10,level:'Custom',style:'sets',warm:[],cool:[],rounds:1,rest:0,rr:0,ex:plan.items.map(function(item){return Object.assign({},item,{sets:1,rest:0})}),why:plan.notes||'Your coach’s custom training session.'}}
  function assignment(plan,start){validate(plan);var days=plan.days.slice().sort();return {a:{daysN:days.length,days:days,coachCustomDays:days,mins:plan.targetSeconds/60,place:plan.place||'home',level:1,kit:['none'],care:[],meno:false},start:start,blockWeeks:plan.weeks,stepsGoal:plan.stepsGoal||10000,swaps:{},made:new Date().toISOString(),coachSet:true,template:plan.name,customWorkout:JSON.parse(JSON.stringify(workout(plan)))}}
  root.NtTraining={seconds:seconds,validate:validate,workout:workout,assignment:assignment,format:function(value){var v=Math.abs(Math.round(value));return Math.floor(v/60)+'m '+v%60+'s'}};
})(typeof window!=='undefined'?window:globalThis);
