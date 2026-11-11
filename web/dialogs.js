/* DropASize dialogs: promise-based branded confirmations, notices and text entry. */
(function(){
  var queue=Promise.resolve();
  function show(options){
    return new Promise(function(resolve){
      var previous=document.activeElement,wrap=document.createElement('div'),card=document.createElement('div');
      wrap.style.cssText='position:fixed;inset:0;z-index:12000;background:rgba(14,53,29,.45);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
      card.style.cssText='width:100%;max-width:400px;max-height:85vh;overflow:auto;box-sizing:border-box;background:#fff;border-radius:24px;padding:24px;color:#0F2418;font:14px/1.55 "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 24px 70px rgba(14,53,29,.22)';
      card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby','nt-dialog-title');
      var title=document.createElement('h2');title.id='nt-dialog-title';title.textContent=options.type==='alert'?'DropASize':options.type==='prompt'?'Your details':'Please confirm';title.style.cssText='font-size:21px;line-height:1.2;margin:0 0 12px;font-weight:700';
      var body=document.createElement('p');body.textContent=options.message;body.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 18px';card.appendChild(title);card.appendChild(body);
      var input=null;
      if(options.type==='prompt'){input=document.createElement('input');input.type='text';input.value=String(options.initial==null?'':options.initial);input.setAttribute('aria-label',options.message);input.style.cssText='width:100%;box-sizing:border-box;padding:14px;border:1.5px solid #E6EAE3;border-radius:14px;background:#F4F6F2;font:inherit;font-size:16px;margin-bottom:18px;color:#0F2418';card.appendChild(input)}
      var actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px';
      function close(value){document.removeEventListener('keydown',keys);wrap.remove();if(previous&&previous.isConnected)previous.focus();resolve(value)}
      function button(label,primary,fn){var b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='flex:1;min-width:0;border:0;border-radius:999px;padding:13px 16px;font:700 14px "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer;background:'+(primary?'#5DBC01':'#F1F5EE')+';color:#0E351D';b.onclick=fn;actions.appendChild(b);return b}
      var cancel=options.type==='alert'?null:button('Cancel',false,function(){close(options.type==='confirm'?false:null)});
      var ok=button(options.type==='alert'?'OK':options.type==='confirm'?'Confirm':'Continue',true,function(){close(input?input.value:true)});
      function keys(ev){if(ev.key==='Escape'){ev.preventDefault();close(options.type==='confirm'?false:null)}if(ev.key==='Tab'){var nodes=[input,cancel,ok].filter(Boolean),first=nodes[0],last=nodes[nodes.length-1];if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus()}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus()}}if(ev.key==='Enter'&&document.activeElement===input){ev.preventDefault();ok.click()}}
      card.appendChild(actions);wrap.appendChild(card);document.body.appendChild(wrap);document.addEventListener('keydown',keys);(input||cancel||ok).focus();
    });
  }
  function enqueue(type,message,initial){var result=queue.then(function(){return show({type:type,message:String(message),initial:initial})});queue=result.catch(function(){});return result}
  window.ntConfirm=function(message){return enqueue('confirm',message)};
  window.ntPrompt=function(message,initial){return enqueue('prompt',message,initial)};
  window.ntAlert=function(message){return enqueue('alert',message)};
})();
