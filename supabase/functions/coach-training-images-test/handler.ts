const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const STYLE='Match DropASize exercise artwork: the same bald athletic man, clean black line art with light grey shading, lime-green shorts, white trainers, plain white background and a thin black floor line. Full body visible, anatomically plausible form, consistent body proportions, camera, equipment and framing. Square image. No text, labels, arrows or collage.';
function bytes64(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text)}
export function createImageHandler({caller,key,model='gemini-3.1-flash-image',fetcher=fetch}:any){
 return async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Use POST'},405);
  try{
   const client=caller(req),auth=await client.auth.getUser();if(auth.error||!auth.data?.user)return json({error:'Please log in'},401);
   const [role,status]=await Promise.all([client.rpc('is_coach'),client.rpc('account_status')]);
   if(role.error||role.data!==true||status.error||status.data!=='active')return json({error:'Only active coaches can create exercise images'},403);
   let body:any;try{body=await req.json()}catch{return json({error:'Invalid request'},400)}
   if(typeof body.name!=='string'||!body.name.trim()||body.name.length>120||typeof body.details!=='string'||!body.details.trim()||body.details.length>3000||String(body.reps||'').length>40||!Number.isInteger(body.seconds)||body.seconds<1||body.seconds>3600||typeof(body.prompt??'')!=='string'||(body.prompt||'').length>2000)return json({error:'Add an exercise name, movement details, reps and a valid time. Keep image guidance under 2,000 characters.'},400);
   const apiKey=key();if(!apiKey)return json({error:'The AI Studio image key is not configured. Add VOICE or GEMINI_API_KEY in Supabase Edge Function Secrets, using the same AI Studio key as the exercise-image workflow.'},503);
   const requestImage=async(parts:any[])=>{
    let response:Response;try{response=await fetcher('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts}],generationConfig:{responseModalities:['IMAGE'],imageConfig:{aspectRatio:'1:1',imageSize:'1K'}}}),signal:AbortSignal.timeout(55000)})}catch{throw new Error('Google image generation timed out or could not be reached. Your exercise details and previous images are kept; try again.')}
    let result:any={};try{result=await response.json()}catch{}
    if(!response.ok){
      const text=String(result.error?.message||'').toLowerCase();
      if(response.status===429)throw new Error('Google image-generation quota or rate limit reached. Wait and try again, or check your AI Studio quota and billing.');
      if(response.status===401||text.includes('api key not valid')||text.includes('api_key_invalid'))throw new Error('Google rejected the AI Studio key. Update VOICE or GEMINI_API_KEY in Supabase Edge Function Secrets.');
      if(response.status===403)throw new Error('This key cannot use image generation. Check Google AI Studio API restrictions, model access and billing.');
      if(response.status===404)throw new Error('The Gemini image model is not available for this key. Check model access or set GEMINI_IMAGE_MODEL to an available image model.');
      if(response.status>=500)throw new Error('Google’s image service is temporarily unavailable. Your existing images are kept; try again later.');
      if(/billing|payment|free.tier/.test(text))throw new Error('Google requires image-generation billing or quota for this AI Studio key. Check the project in AI Studio.');
      throw new Error('Google could not generate this image. Simplify the exercise description or custom prompt, then try again.');
    }
    const partsOut=result.candidates?.[0]?.content?.parts||[],image=partsOut.map((part:any)=>part.inlineData||part.inline_data).find((data:any)=>data?.data);
    if(!image){const reason=result.promptFeedback?.blockReason||result.candidates?.[0]?.finishReason||'no image returned';throw new Error('Google returned no exercise image ('+String(reason).slice(0,100)+'). Change the movement description or image prompt and try again.');}
    const mime=image.mimeType||image.mime_type;if(!['image/png','image/jpeg','image/webp'].includes(mime)||typeof image.data!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)||image.data.length>12*1024*1024)throw new Error('Google returned an unsupported or oversized image. Try a simpler prompt.');
    return {mimeType:mime,data:image.data};
   };
   const reference:any[]=[];
   try{const response=await fetcher('https://zoistek.github.io/DropASize/exercises/goblet-squat-before.webp',{signal:AbortSignal.timeout(5000)});if(response.ok){const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length<2*1024*1024)reference.push({inlineData:{mimeType:'image/webp',data:bytes64(bytes)}})}}catch{}
   const info='Exercise: '+body.name.trim()+'. Movement details: '+body.details.trim()+'. Reps: '+String(body.reps||'timed')+'. Duration: '+body.seconds+' seconds. '+(body.prompt?'Coach image guidance: '+body.prompt:'');
   const before=await requestImage(reference.concat([{text:STYLE+' '+info+' Draw ONLY the BEFORE/start position, one person, one image.'}]));
   const after=await requestImage(reference.concat([{inlineData:before},{text:STYLE+' '+info+' Use the supplied starting image to keep the SAME person, camera, clothes, background and equipment. Draw ONLY the AFTER/end position of this movement, one person, one image. For a static hold, show the correct held position.'}]));
   const paths:string[]=[],images:any={};
   try{
    const batch=crypto.randomUUID();
    for(const [position,image] of [['before',before],['after',after]] as const){const ext=image.mimeType==='image/png'?'png':image.mimeType==='image/jpeg'?'jpg':'webp',path='coach-exercises/'+auth.data.user.id+'/'+batch+'-'+position+'.'+ext;const binary=atob(image.data),bytes=Uint8Array.from(binary,(char:string)=>char.charCodeAt(0));const upload=await client.storage.from('recipe-images').upload(path,bytes,{contentType:image.mimeType,upsert:false});if(upload.error)throw upload.error;paths.push(path);images[position]=client.storage.from('recipe-images').getPublicUrl(path).data.publicUrl;}
   }catch{if(paths.length)await client.storage.from('recipe-images').remove(paths);throw new Error('Both images were generated, but they could not be saved. Check image storage access and try again. Your previous images are kept.')}
   return json({images,model});
  }catch(error){return json({error:error instanceof Error?error.message:'Image creation failed. Please try again.'},502)}
 };
}
