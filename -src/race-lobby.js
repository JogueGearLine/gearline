const GearLineRaceLobby=(()=>{
 const form=document.getElementById('inviteForm');
 const pilot=document.getElementById('invitePilot');
 const send=document.getElementById('inviteSend');
 const status=document.getElementById('inviteStatus');
 const list=document.getElementById('inviteList');
 let session=null;

 function errorMessage(error){
  if(['PGRST205','PGRST202','42P01'].includes(error?.code)){
   return 'Os convites ainda precisam ser ativados no servidor.';
  }
  return ({
   GL_DUEL_ADDRESS:'A corrida online precisa ser aberta pelo servidor de teste.',
   GL_SIGN_IN:'Entre na sua conta para usar convites.',
   GL_INVALID_INVITE:'Confira o nome do piloto e a distância.',
   GL_PILOT_NOT_FOUND:'Piloto não encontrado. Confira o nome usado no GearLine.',
   GL_AMBIGUOUS_PILOT:'Há mais de um piloto com esse nome.',
   GL_SELF_INVITE:'Escolha outro piloto.',
   GL_ALREADY_INVITED:'Já existe um convite ativo entre vocês.',
   GL_INVITE_LIMIT:'Aguarde um minuto antes de enviar mais convites.',
   GL_INVITE_UNAVAILABLE:'Este convite expirou ou mudou de status.',
   GL_PROFILE_REQUIRED:'Abra seu perfil antes de convidar.'
  })[error?.message]||'Não foi possível acessar os convites. Tente novamente.';
 }

 function button(text,action){
  const el=document.createElement('button');
  el.type='button';
  el.className='btn secondary';
  el.textContent=text;
  el.addEventListener('click',action);
  return el;
 }

 function render(rows,current){
  const signature=JSON.stringify(rows);
  if(signature===current.signature)return;
  current.signature=signature;
  list.replaceChildren();
  for(const row of rows){
   const item=document.createElement('li');
   const description=document.createElement('div');
   const title=document.createElement('strong');
   const detail=document.createElement('small');
   const actions=document.createElement('div');
   actions.className='row';
   const other=row.outgoing?row.recipient_name:row.sender_name;
   title.textContent=other+' · '+row.distance+' m';
   description.append(title,detail);
   const addAction=(label,action)=>actions.append(button(label,event=>{
    const control=event.currentTarget;
    control.disabled=true;
    run(current,()=>current.api.actOnRaceInvite(row.id,action)).finally(()=>{control.disabled=false});
   }));
   if(row.status==='pending'){
    detail.textContent=row.outgoing?'Convite enviado':'Convite recebido';
    if(row.outgoing)addAction('Cancelar','cancel');
    else{
     addAction('Aceitar','accept');
     addAction('Recusar','decline');
    }
   }else{
    const ready=row.outgoing?row.sender_ready:row.recipient_ready;
    const otherReady=row.outgoing?row.recipient_ready:row.sender_ready;
    detail.textContent=ready&&otherReady?'Ambos prontos'
     :'Você: '+(ready?'pronto':'aguardando')+' · Rival: '+(otherReady?'pronto':'aguardando');
    if(ready&&otherReady)actions.append(button('Entrar na corrida',event=>{
     const control=event.currentTarget;
     control.disabled=true;
     run(current,async()=>{
      const color=current.prepare();
      const connection=await GearLineOnlineRace.join(current.api,row.id,color);
      if(session===current)current.launch(connection,row.distance);
      else connection.close(true);
     }).finally(()=>{control.disabled=false});
    }));
    addAction(ready?'Voltar a aguardar':'Estou pronto',ready?'unready':'ready');
    addAction('Sair da sala','cancel');
   }
   item.append(description,actions);
   list.append(item);
  }
 }

 async function refresh(current){
  if(session!==current||current.loading)return;
  current.loading=true;
  try{
   const rows=await current.api.raceInvites();
   if(session!==current)return;
   render(rows,current);
   send.disabled=false;
   if(!current.notice)status.textContent=rows.length?'':'Nenhum convite ativo.';
  }catch(error){
   if(session!==current)return;
   send.disabled=true;
   status.textContent=errorMessage(error);
  }finally{
   current.loading=false;
  }
 }

 async function run(current,operation,success=''){
  if(session!==current||current.pending)return;
  current.pending=true;
  current.notice=success;
  try{
   await operation();
   if(session===current)status.textContent=success;
  }catch(error){
   if(session===current){
    current.notice=errorMessage(error);
    status.textContent=current.notice;
    if(error?.message==='GL_DUEL_ADDRESS'){
     const link=document.createElement('a');
     link.href=GearLineOnlineRace.testUrl();
     link.textContent=' Abrir servidor da corrida.';
     link.style.color='var(--lime)';
     status.append(link);
    }
   }
  }finally{
   current.pending=false;
   await refresh(current);
  }
 }

 form.addEventListener('submit',event=>{
  event.preventDefault();
  const current=session;
  const name=pilot.value.trim();
  if(!current||name.length<2)return;
  run(current,async()=>{
   await current.api.sendRaceInvite(name,current.distance);
   if(session===current)pilot.value='';
  },'Convite enviado.');
 });

 function close(){
  if(session){
   clearInterval(session.timer);
   pilot.value='';
  }
  session=null;
 }

 return {
  open(api,distance,launch,prepare){
   close();
   list.replaceChildren();
   send.disabled=true;
   document.getElementById('inviteDistance').textContent=distance+' m';
   status.textContent='Carregando convites…';
   const current={api,distance,launch,prepare,signature:null,notice:''};
   session=current;
   current.timer=setInterval(()=>{if(!document.hidden&&!current.pending)void refresh(current)},3000);
   void refresh(current);
  },
  close
 };
})();
