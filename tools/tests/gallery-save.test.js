const fs=require('fs'),assert=require('assert');
(async()=>{
 const {saveGalleryImage}=await import('data:text/javascript,'+encodeURIComponent(fs.readFileSync('native/saveImage.js','utf8')));
 const calls=[],deps={FileSystem:{cacheDirectory:'file:///cache/',EncodingType:{Base64:'base64'},writeAsStringAsync:async(...a)=>calls.push(['write',...a]),deleteAsync:async(...a)=>calls.push(['delete',...a])},Asset:{create:async uri=>calls.push(['gallery',uri])},Platform:{OS:'android',Version:35},PermissionsAndroid:{PERMISSIONS:{WRITE_EXTERNAL_STORAGE:'write'},RESULTS:{GRANTED:'granted'},request:async()=>{calls.push(['permission']);return 'granted'}}};
 const msg={name:'my-week.png',dataUrl:'data:image/png;base64,iVBORw0KGgo='};await saveGalleryImage(msg,deps);assert.deepEqual(calls.map(x=>x[0]),['write','gallery','delete']);assert(calls[0][1].endsWith('.png'));assert.equal(calls[0][2],'iVBORw0KGgo=');
 calls.length=0;deps.Platform.Version=28;await saveGalleryImage(msg,deps);assert.deepEqual(calls.map(x=>x[0]),['permission','write','gallery','delete']);
 calls.length=0;deps.PermissionsAndroid.request=async()=> 'denied';await assert.rejects(saveGalleryImage(msg,deps),/Allow saving photos/);assert.equal(calls.length,0);
 deps.Platform.Version=35;deps.Asset.create=async()=>{throw Error('Disk full')};await assert.rejects(saveGalleryImage(msg,deps),/Disk full/);assert.equal(calls.at(-1)[0],'delete');
 await assert.rejects(saveGalleryImage({dataUrl:'https://example.com/image.png'},deps),/prepare/);
 console.log('Gallery save passed: PNG validation, modern permission-free save, legacy write permission, denial, native failure and temporary-file cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
