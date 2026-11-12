import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@9.0.0";
import {createHandler} from "./handler.ts";

const env=(key:string)=>Deno.env.get(key)||'';
const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'));
const mailConfigured=()=>!!(env('SMTP_HOSTNAME')&&env('SMTP_USERNAME')&&env('SMTP_PASSWORD')&&env('SMTP_FROM')&&env('SMTP_PORT')==='465');
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function sendMail(event:any){
 if(!mailConfigured())throw Error('SMTP not configured');
 const message=event.action==='ban'?'Your DropASize account has been banned. You can no longer use the app.':event.action==='delete'?'Your DropASize account and its saved data have been deleted by your coach.':'Your DropASize account ban has been lifted. You can log in again.';
 const reason=event.reason?'\n\nReason: '+event.reason:'';
 const title=event.action==='ban'?'Your DropASize account has been banned':event.action==='delete'?'Your DropASize account has been deleted':'Your DropASize account access has been restored';
 const transport=nodemailer.createTransport({host:env('SMTP_HOSTNAME'),port:465,secure:true,auth:{user:env('SMTP_USERNAME'),pass:env('SMTP_PASSWORD')},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
 try{
   const sent=await transport.sendMail({from:{name:'DropASize',address:env('SMTP_FROM')},to:event.recipient,subject:title,text:message+reason+'\n\nIf you have questions, contact your coach.',html:'<div style="background:#F4F6F2;padding:24px;font-family:Arial,sans-serif;color:#0F2418"><div style="max-width:480px;margin:auto;background:#fff;padding:28px;border-radius:24px"><h1 style="color:#0E351D">DropASize</h1><p>'+escape(message)+'</p>'+(event.reason?'<p><strong>Reason:</strong> '+escape(event.reason)+'</p>':'')+'<p>If you have questions, contact your coach.</p></div></div>'});
   if(!sent.accepted?.length)throw Error('Mail server did not accept notification');
 }finally{transport.close()}
}
Deno.serve(createHandler({admin,caller:(req:Request)=>createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:req.headers.get('Authorization')||''}}}),mailConfigured,sendMail}));
