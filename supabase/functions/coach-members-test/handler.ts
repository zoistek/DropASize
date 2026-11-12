const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const uuid=(value:any)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const checked=(result:any)=>{if(result.error)throw result.error;return result.data};

export function createHandler({caller,admin,mailConfigured,sendMail}:any){
 async function notify(event:any){
   try{
     await sendMail(event);
     checked(await admin.from('member_actions').update({email_status:'sent',sent_at:new Date().toISOString(),recipient:null}).eq('id',event.id));
     return true;
   }catch{
     await admin.from('member_actions').update({email_status:'failed'}).eq('id',event.id);
     return false;
   }
 }
 return async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Use POST'},405);
  try{
   const client=caller(req);
   const {data:{user},error}=await client.auth.getUser();
   if(error||!user)return json({error:'Please log in'},401);
   const active=await client.rpc('account_status');
   const coach=await client.rpc('is_coach');
   if(coach.error||coach.data!==true)return json({error:'Only active coaches can manage members'},403);
   if(active.error)return json({error:'Account protection is awaiting activation. Moderation is disabled until the database access change is approved.'},503);
   if(active.data!=='active')return json({error:'Only active coaches can manage members'},403);
   let body:any;try{body=await req.json()}catch{return json({error:'Invalid request'},400)}
   const action=body.action;
   if(!['status','ban','unban','delete','retry_email','pending_emails'].includes(action))return json({error:'Unknown action'},400);
   if(action==='pending_emails')return json({ok:true,notifications:checked(await admin.from('member_actions').select('id,action,target_id,recipient,created_at').eq('status','done').neq('email_status','sent').order('created_at',{ascending:false}).limit(50))});
   if(action==='retry_email'){
     if(!uuid(body.event_id))return json({error:'Unknown notification'},400);
     const event=checked(await admin.from('member_actions').select('*').eq('id',body.event_id).maybeSingle());
     if(!event||event.status!=='done')return json({error:'Notification not found'},404);
     if(event.email_status==='sent')return json({ok:true,email_sent:true});
     if(!mailConfigured())return json({error:'Configure the notification SMTP secrets first'},503);
     return json({ok:true,email_sent:await notify(event),event_id:event.id});
   }
   if(!uuid(body.user_id))return json({error:'Unknown member'},400);
   if(action!=='status'&&uuid(body.request_id)){
     const prior=checked(await admin.from('member_actions').select('*').eq('id',body.request_id).maybeSingle());
     if(prior){if(prior.actor_id!==user.id||prior.target_id!==body.user_id||prior.action!==action)return json({error:'Request ID already used'},409);return json({ok:prior.status==='done',event_id:prior.id,email_sent:prior.email_status==='sent',error:prior.status==='done'?undefined:'This request is already recorded. Refresh the member before trying again.'},prior.status==='done'?200:409)}
   }
   const targetResult=await admin.auth.admin.getUserById(body.user_id);
   const target=targetResult.data?.user;
   if(targetResult.error||!target)return json({error:'Member not found'},404);
   const profile=checked(await admin.from('profiles').select('role').eq('id',target.id).maybeSingle());
   const protectedEmail=checked(await admin.from('coach_emails').select('email').eq('email',String(target.email||'').toLowerCase()).maybeSingle());
   const protectedAccount=target.id===user.id||profile?.role==='coach'||!!protectedEmail;
   const notifications=checked(await admin.from('member_actions').select('id,action,status,email_status,created_at').eq('target_id',target.id).order('created_at',{ascending:false}).limit(10));
   const banned=!!target.banned_until&&new Date(target.banned_until).getTime()>Date.now();
   if(action==='status')return json({ok:true,banned,protected:protectedAccount,email_configured:mailConfigured(),notifications});
   if(protectedAccount)return json({error:'You cannot ban or delete a coach or your own account'},403);
   if(!mailConfigured())return json({error:'Configure the notification SMTP secrets before banning or deleting members'},503);
   if(!target.email)return json({error:'This member has no email address for the required notification'},400);
   if(!uuid(body.request_id))return json({error:'Invalid request ID'},400);
   if(action==='delete'&&body.confirmation!=='DELETE')return json({error:'Type DELETE to confirm'},400);
   const reason=String(body.reason||'').trim();if(reason.length>500)return json({error:'Reason is too long'},400);
   if(action==='ban'&&banned||action==='unban'&&!banned)return json({error:'The member already has that status. Refresh the page.'},409);
   const event={id:body.request_id,actor_id:user.id,target_id:target.id,action,recipient:target.email,reason,status:'started',email_status:'pending'};
   checked(await admin.from('member_actions').insert(event));
   try{
    if(action==='ban'||action==='unban'){
      checked(await admin.auth.admin.updateUserById(target.id,{ban_duration:action==='ban'?'876000h':'none'}));
      if(action==='ban')checked(await admin.rpc('moderation_revoke_sessions',{p_user:target.id}));
    }else{
      // Freeze access first, then clear Storage and public shared records before Auth deletion.
      checked(await admin.auth.admin.updateUserById(target.id,{ban_duration:'876000h'}));
      checked(await admin.rpc('moderation_revoke_sessions',{p_user:target.id}));
      for(;;){
        const files=checked(await admin.storage.from('avatars').list(target.id,{limit:1000}));
        if(!files?.length)break;
        checked(await admin.storage.from('avatars').remove(files.map((file:any)=>target.id+'/'+file.name)));
      }
      checked(await admin.from('shared_docs').delete().eq('doc_id',target.id));
      const squads=checked(await admin.from('shared_docs').select('data').eq('collection','config').eq('doc_id','squads').maybeSingle());
      if(squads?.data?.members?.[target.id]){delete squads.data.members[target.id];checked(await admin.from('shared_docs').update({data:squads.data}).eq('collection','config').eq('doc_id','squads'))}
      checked(await admin.auth.admin.deleteUser(target.id));
    }
   }catch{
     await admin.from('member_actions').update({status:'failed'}).eq('id',event.id);
     return json({error:'The action could not be completed. Refresh the member status before trying again; access may already be blocked.'},500);
   }
   checked(await admin.from('member_actions').update({status:'done'}).eq('id',event.id));
   event.status='done';
   const sent=await notify(event);
   return json({ok:true,action,event_id:event.id,email_sent:sent});
  }catch{return json({error:'Could not complete this request. Please try again.'},500)}
 };
}
