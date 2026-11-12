// Puts web/icons.js and web/gate.js into web/index.html and regenerates web/appHtml.js for the Android app.
// Run: node web/build.js
const fs = require('fs');
const path = require('path');
const dir = __dirname;
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
require('./buildTrainingCatalog')(html);
function inject(markers, file) {
  const code = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\s+$/, '');
  let start = -1;
  for (const m of markers) { start = html.indexOf(m); if (start >= 0) break; }
  if (start < 0) throw new Error('marker not found for ' + file);
  const end = html.indexOf('\n</script>', start);
  html = html.slice(0, start) + code + html.slice(end);
}
if(!html.includes('/* DropASize dialogs:'))html=html.replace('<title>DropASize</title>','<title>DropASize</title>\n<script>\n/* DropASize dialogs: */\n</script>');
if(!html.includes('/* DropASize email signup:'))html=html.replace('<title>DropASize</title>','<title>DropASize</title>\n<script>\n/* DropASize email signup: */\n</script>');
inject(['/* DropASize email signup:'], 'signup.js');
if(!html.includes('/* DropASize flow helpers:'))html=html.replace('<title>DropASize</title>','<title>DropASize</title>\n<script>\n/* DropASize flow helpers: */\n</script>');
inject(['/* DropASize flow helpers:'], 'flows.js');
if(!html.includes('/* DropASize training shared:'))html=html.replace('<title>DropASize</title>','<title>DropASize</title>\n<script>\n/* DropASize training shared: */\n</script>');
inject(['/* DropASize training shared:'],'trainingShared.js');
if(!html.includes('/* DropASize custom coach workout:'))html=html.replace('<title>DropASize</title>','<title>DropASize</title>\n<script>\n/* DropASize custom coach workout: */\n</script>');
inject(['/* DropASize custom coach workout:'],'coachWorkout.js');
inject(['/* DropASize dialogs:'], 'dialogs.js');
inject(['/* DropASize icons:'], 'icons.js');
inject(['/* DropASize app layer', '/* Nourish&Thrive app layer'], 'gate.js');
fs.writeFileSync(path.join(dir, 'index.html'), html);
fs.writeFileSync(path.join(dir, 'appHtml.js'), '// Generated from web/index.html by web/build.js. Do not edit by hand.\nexport default ' + JSON.stringify(html) + ';\n');
console.log('built', html.length);
const adminFile=path.join(dir,'admin.html');
let adminHtml=fs.readFileSync(adminFile,'utf8');
if(!adminHtml.includes('/* END_MEMBER_MODERATION */'))adminHtml=adminHtml.replace('/* MEMBER_MODERATION */','/* MEMBER_MODERATION */\n/* END_MEMBER_MODERATION */');
adminHtml=adminHtml.replace(/\/\* MEMBER_MODERATION \*\/[\s\S]*?\/\* END_MEMBER_MODERATION \*\//,()=> '/* MEMBER_MODERATION */\n'+fs.readFileSync(path.join(dir,'adminMembers.js'),'utf8')+'\n/* END_MEMBER_MODERATION */');
fs.writeFileSync(adminFile,adminHtml);
if(!adminHtml.includes('/* CUSTOM_TRAINING_START */'))adminHtml=adminHtml.replace('/* ---------- Training plan templates ---------- */','/* CUSTOM_TRAINING_START */\n/* CUSTOM_TRAINING_END */\n/* ---------- Training plan templates ---------- */');
adminHtml=adminHtml.replace(/\/\* CUSTOM_TRAINING_START \*\/[\s\S]*?\/\* CUSTOM_TRAINING_END \*\//,()=> '/* CUSTOM_TRAINING_START */\n'+fs.readFileSync(path.join(dir,'trainingShared.js'),'utf8')+'\n'+fs.readFileSync(path.join(dir,'adminTraining.js'),'utf8')+'\n/* CUSTOM_TRAINING_END */');
fs.writeFileSync(adminFile,adminHtml);
