/* DropASize flow helpers: existing coach methods and image downloads. */
function ntCoachSteps(recipe){
  var steps=Array.isArray(recipe.steps)?recipe.steps:String(recipe.how||'').split(/\n+|[.!?]\s+(?=[A-Z])/);
  steps=steps.map(function(step){return String(step).trim()}).filter(Boolean);
  return steps.length?steps:['Follow the method shown with this recipe.'];
}
(function(){
  var pending={};
  window.ntSavedImage=function(result){
    var request=pending[result.id];if(!request)return;delete pending[result.id];clearTimeout(request.timer);
    if(result.error)request.reject(new Error(result.error));else request.resolve('Saved to your gallery.');
  };
  window.ntSaveImage=async function(blob,name){
    if(!blob||blob.type!=='image/png'||blob.size>15*1024*1024)throw new Error('Couldn’t prepare the image. Please try again.');
    if(window.ReactNativeWebView){
      if(!window.NT_GALLERY_SAVE)throw new Error('Gallery saving will be available in the next app update.');
      var data=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result)};reader.onerror=function(){reject(new Error('Couldn’t read the image.'))};reader.readAsDataURL(blob)});
      return new Promise(function(resolve,reject){
        var id='save-image-'+Date.now()+'-'+Math.random().toString(36).slice(2);
        pending[id]={resolve:resolve,reject:reject,timer:setTimeout(function(){delete pending[id];reject(new Error('Saving took too long. Please try again.'))},60000)};
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'save-image',id:id,dataUrl:data,name:name}));
      });
    }
    var url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},60000);
    return 'Image downloaded. Find it in your Downloads folder.';
  };
})();
