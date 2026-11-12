const {withAndroidManifest}=require('expo/config-plugins');
// Android 10+ saves app-created images with scoped storage; older devices need write access.
module.exports=config=>withAndroidManifest(config,config=>{
  const manifest=config.modResults.manifest;
  manifest.$['xmlns:tools']='http://schemas.android.com/tools';
  const permissions=manifest['uses-permission']||[];
  manifest['uses-permission']=permissions.filter(p=>p.$['android:name']!=='android.permission.WRITE_EXTERNAL_STORAGE');
  manifest['uses-permission'].push({$:{'android:name':'android.permission.WRITE_EXTERNAL_STORAGE','android:maxSdkVersion':'28','tools:replace':'android:maxSdkVersion'}});
  return config;
});
