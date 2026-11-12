async function memberAccessCall(body){
  var response=await fetch(SB_URL+'/functions/v1/coach-members-test',{method:'POST',headers:{'Content-Type':'application/json',apikey:SB_KEY,Authorization:'Bearer '+await token()},body:JSON.stringify(body)});
  var data={};try{data=await response.json()}catch(e){}
  if(!response.ok)throw new Error(response.status===404?'Member access tools are awaiting backend activation.':typeof data.error==='string'?data.error:'Could not update this member.');
  return data;
}
async function loadPendingNotifications(){
  var box=$('#member-notifications');if(!box)return;
  try{
    var result=await memberAccessCall({action:'pending_emails'});if(!box.isConnected)return;
    box.innerHTML=result.notifications.length?'<div class="err" style="margin-top:12px"><b>Member notification emails need attention</b>'+result.notifications.map(function(event){return '<div class="row" style="margin-top:8px;gap:10px;flex-wrap:wrap"><span class="grow small">'+esc(event.action)+' · '+esc(event.recipient||'Member')+'</span><button class="btn ghost sm" data-retry-member-email="'+esc(event.id)+'">Retry email</button></div>'}).join('')+'</div>':'';
    $$('[data-retry-member-email]',box).forEach(function(button){button.onclick=async function(){button.disabled=true;try{var r=await memberAccessCall({action:'retry_email',event_id:button.dataset.retryMemberEmail});toast(r.email_sent?'Email accepted by the mail server.':'Email still could not be sent. Check SMTP settings.');loadPendingNotifications()}catch(e){toast(e.message);button.disabled=false}}});
  }catch(e){box.innerHTML='<p class="small mut">'+esc(e.message)+'</p>'}
}
async function loadMemberAccess(M){
  var box=$('#member-access');if(!box)return;
  try{
    var status=await memberAccessCall({action:'status',user_id:M.uid});if(!box.isConnected)return;
    box.innerHTML='<p><span class="pill '+(status.banned?'red':'ok')+'">'+(status.banned?'Account banned':'Active account')+'</span></p>'+
      (status.protected?'<p>Coach accounts cannot be banned or deleted here.</p>':
      (!status.email_configured?'<p class="err">Notification email setup is required before these actions can be used. Configure SMTP secrets in Supabase Edge Functions.</p>':'')+
      '<div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn ghost sm" id="member-ban"'+(!status.email_configured?' disabled':'')+'>'+(status.banned?'Restore access':'Ban member')+'</button><button class="btn danger sm" id="member-delete"'+(!status.email_configured?' disabled':'')+'>Delete member</button></div>')+
      '<p class="small mut">'+status.notifications.filter(function(n){return n.status==='done'}).map(function(n){return esc(n.action)+': '+(n.email_status==='sent'?'email accepted by mail server':'email needs retry')}).join(' · ')+'</p>';
    if($('#member-ban'))$('#member-ban').onclick=function(){memberActionDialog(M,status.banned?'unban':'ban')};
    if($('#member-delete'))$('#member-delete').onclick=function(){memberActionDialog(M,'delete')};
  }catch(e){box.innerHTML='<div class="err">'+esc(e.message)+'</div><div class="row" style="gap:10px;margin-top:12px"><button class="btn ghost sm" disabled>Ban member</button><button class="btn danger sm" disabled>Delete member</button></div>'}
}
function memberActionDialog(M,action){
  var title=action==='delete'?'Delete member':action==='ban'?'Ban member':'Restore access';
  var wrap=document.createElement('div');wrap.className='modal';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-label',title);
  wrap.innerHTML='<div class="card" style="width:100%;max-width:440px;max-height:85vh;overflow:auto;margin:0"><h2>'+title+'</h2><p>'+esc(M.user.email)+'</p><p class="small">'+(action==='delete'?'This permanently removes their login, saved data and private photos. It cannot be undone.':action==='ban'?'This blocks their account and signs them out. You can restore access later.':'This allows them to log in again.')+' An email notification will be sent.</p><label class="f" for="member-action-reason">Reason (optional, included in the email)</label><textarea class="i" id="member-action-reason" maxlength="500" rows="3"></textarea>'+
    (action==='delete'?'<label class="f" for="member-action-confirm">Type DELETE to confirm</label><input class="i" id="member-action-confirm" autocomplete="off">':'')+
    '<div id="member-action-message" role="status" aria-live="polite"></div><div class="row" style="justify-content:flex-end;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn ghost" id="member-action-cancel">Cancel</button><button class="btn '+(action==='delete'?'danger':'')+'" id="member-action-submit">'+title+'</button></div></div>';
  document.body.appendChild(wrap);
  var submit=$('#member-action-submit',wrap),cancel=$('#member-action-cancel',wrap),message=$('#member-action-message',wrap),busy=false,completed=false,eventId=null,requestId=crypto.randomUUID();
  function close(){if(busy)return;wrap.remove();state.users=null;if(action==='delete'&&completed)go('members');else loadMemberAccess(M)}
  cancel.onclick=close;
  submit.onclick=async function(){
    if(busy)return;
    var typed=$('#member-action-confirm',wrap);
    if(!completed&&typed&&typed.value.trim()!=='DELETE'){message.className='err';message.textContent='Type DELETE to confirm.';return}
    busy=true;submit.disabled=cancel.disabled=true;message.className='';message.textContent=completed?'Retrying email…':'Working…';
    try{
      var result=await memberAccessCall(completed?{action:'retry_email',event_id:eventId}:{action:action,user_id:M.uid,reason:$('#member-action-reason',wrap).value,confirmation:typed?typed.value.trim():undefined,request_id:requestId});
      completed=true;eventId=result.event_id||eventId;
      $('#member-action-reason',wrap).disabled=true;if(typed)typed.disabled=true;
      message.className=result.email_sent?'ok':'err';message.textContent=(action==='delete'?'Member deleted.':action==='ban'?'Member banned.':'Account access restored.')+(result.email_sent?' Notification accepted by the mail server.':' The email failed. Retry it here or from the Members list.');
      cancel.textContent='Close';submit.textContent='Retry email';submit.hidden=!!result.email_sent;
    }catch(e){message.className='err';message.textContent=e.message}
    finally{busy=false;submit.disabled=cancel.disabled=false}
  };
  $('#member-action-reason',wrap).focus();
}
