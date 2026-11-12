export async function saveGalleryImage(message, {FileSystem, Asset, Platform, PermissionsAndroid}){
  const match=typeof message.dataUrl==='string'&&message.dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match||match[1].length>20*1024*1024)throw new Error('Couldn’t prepare the image. Please try again.');
  if(Platform.OS==='android'&&Number(Platform.Version)<29){
    const permission=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    if(permission!==PermissionsAndroid.RESULTS.GRANTED)throw new Error('Allow saving photos to save this card to your gallery.');
  }
  const filename=String(message.name||'progress.png').replace(/[^a-zA-Z0-9_.-]/g,'-').replace(/\.png$/i,'');
  const uri=FileSystem.cacheDirectory+'DropASize-'+filename+'-'+Date.now()+'.png';
  try{
    await FileSystem.writeAsStringAsync(uri,match[1],{encoding:FileSystem.EncodingType.Base64});
    await Asset.create(uri);
  }finally{await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{});}
}
