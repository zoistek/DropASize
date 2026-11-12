import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.45.4";
import {createImageHandler} from "./handler.ts";
const env=(name:string)=>Deno.env.get(name)||'';
console.info('coach-training-images key_ready='+!!(env('VOICE')||env('GEMINI_API_KEY')));
Deno.serve(createImageHandler({caller:(req:Request)=>createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:req.headers.get('Authorization')||''}}}),key:()=>env('VOICE')||env('GEMINI_API_KEY'),model:env('GEMINI_IMAGE_MODEL')||'gemini-3.1-flash-image'}));
