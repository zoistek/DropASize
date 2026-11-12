/* DropASize email signup: password fields stay in component memory only. */
function NtEmailSignup(props){
  var h=React.createElement,state=React.useState;
  var a=state(''),email=a[0],setEmail=a[1],b=state(''),password=b[0],setPassword=b[1],c=state(''),confirm=c[0],setConfirm=c[1],d=state(false),busy=d[0],setBusy=d[1],e=state(''),error=e[0],setError=e[1];
  var inputStyle={width:'100%',boxSizing:'border-box',minWidth:0,border:0,borderRadius:14,padding:'13px 14px',fontSize:16,background:'#F4F6F2',color:'#0F2418',fontFamily:'inherit',boxShadow:'inset 0 0 0 1px rgba(15,36,24,.1)'};
  function field(id,label,value,setValue,type,autocomplete){return h('div',{style:{marginTop:12}},h('label',{htmlFor:id,style:{display:'block',fontSize:13,fontWeight:600,marginBottom:6}},label),h('input',{id:id,type:type,value:value,onChange:function(ev){setValue(ev.target.value)},autoComplete:autocomplete,autoCapitalize:'none',required:true,disabled:busy,style:inputStyle}));}
  async function submit(ev){
    ev.preventDefault();if(busy||props.disabled)return;setError('');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setError('Please enter a valid email address.');return}
    if(password.length<6){setError('Password needs at least 6 characters.');return}
    if(password!==confirm){setError('The passwords don’t match.');return}
    setBusy(true);
    try{await props.onSignup({email:email.trim().toLowerCase(),password:password});setPassword('');setConfirm('')}
    catch(err){setError(/already registered|already exists/i.test(err.message)?'This email already has an account. Use Already a member to log in.':err.message||'Couldn’t sign up. Please try again.')}
    finally{setBusy(false)}
  }
  return h('form',{onSubmit:submit,noValidate:true,style:{marginTop:20,color:'#0F2418'}},
    h('div',{style:{fontSize:13,textAlign:'center',color:'#6B726E',marginBottom:14}},'or sign up with email'),
    field('nt-signup-email','Email',email,setEmail,'email','email'),field('nt-signup-password','Password',password,setPassword,'password','new-password'),field('nt-signup-confirm','Confirm password',confirm,setConfirm,'password','new-password'),
    error&&h('p',{role:'alert',style:{color:'#9A3422',fontSize:13,lineHeight:1.5}},error),
    h('button',{type:'submit',disabled:busy||props.disabled,style:{width:'100%',marginTop:16,border:0,borderRadius:999,padding:'15px 18px',minHeight:50,fontFamily:'inherit',fontSize:15,fontWeight:700,color:'#0E351D',background:'#5DBC01',cursor:'pointer',opacity:busy||props.disabled?.6:1}},busy?'Sending code…':'Sign up'),
    h('p',{style:{fontSize:12,lineHeight:1.5,color:'#6B726E',margin:'10px 0 0'}},'We’ll email you a verification code to finish creating your account.'));
}
