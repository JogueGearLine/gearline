const GearLinePilots=(()=>{
 const el=id=>document.getElementById(id);
 const node=(tag,value='',cls='')=>{const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n};
 const button=(label,action,cls='btn secondary')=>{const b=node('button',label,cls);b.type='button';b.onclick=action;return b};
 const message=error=>({GL_SIGN_IN:'Entre na sua conta.',GL_PILOT_NOT_FOUND:'Piloto não encontrado.',GL_INVALID_PILOT:'Selecione outro piloto.',GL_FRIEND_UNAVAILABLE:'Este pedido já mudou. Atualize a lista.',GL_FRIEND_LIMIT:'Você tem muitos pedidos pendentes.',GL_ALREADY_INVITED:'Já existe um convite ativo entre vocês.',GL_INVITE_LIMIT:'Aguarde um minuto para convidar novamente.',GL_INVITE_UNAVAILABLE:'O convite expirou ou foi cancelado.',GL_PROFILE_REQUIRED:'Abra seu perfil antes de convidar.'})[error?.message]||(['PGRST202','PGRST205','42P01'].includes(error?.code)?'Este sistema ainda precisa ser ativado no servidor.':'Não foi possível concluir. Confira a conexão.');
 const relation={self:'Seu perfil',friend:'Amigo',outgoing:'Pedido enviado',incoming:'Pedido recebido',none:''};
 const time=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value).toFixed(2)+'s':'—';
 let session=null,notifications=null,screen='auth';
 const presenceIntervalMs=25000;
 function presenceBadge(current,id){
  const badge=node('small','','pilot-presence');
  badge.dataset.pilotPresence=id;
  setPresenceBadge(badge,current.online);
  return badge;
 }
 function setPresenceBadge(badge,online){
  const status=online===null?'':online.has(badge.dataset.pilotPresence)?'Online':'Offline';
  if(badge.textContent!==status)badge.textContent=status;
  badge.hidden=!status;
  badge.classList.toggle('is-online',status==='Online');
 }
 async function syncPresence(current){
  if(notifications!==current||current.presencePending||document.hidden||!current.presenceTimer)return;
  const directory=session,ids=directory?.ids;
  current.presencePending=true;
  try{
   const online=new Set(await current.api.pilotPresence(ids??[]));
   if(directory&&notifications===current&&session===directory&&directory.ids===ids)directory.online=online;
  }catch{
   if(directory&&notifications===current&&session===directory&&directory.ids===ids)directory.online=null;
  }finally{
   current.presencePending=false;
   if(notifications!==current)return;
   if(session&&(session!==directory||session.ids!==ids)){void syncPresence(current);return}
   if(directory)document.querySelectorAll('[data-pilot-presence]').forEach(badge=>setPresenceBadge(badge,directory.online));
  }
 }
 function renderCard(current,pilot){
  current.selected=pilot?.id??null;
  const content=el('pilotPublicContent');content.replaceChildren();
  if(!pilot){content.append(node('h2','ESCOLHA UM PILOTO'),node('p','Veja os resultados e adicione amigos.','muted'));return}
  const identity=node('div','','public-pilot-identity'),badge=node('div',pilot.name.slice(0,2).toUpperCase(),'avatar'),info=node('div');
  info.append(node('h2',pilot.name),node('p','NÍVEL '+pilot.level+(relation[pilot.relationship]?' • '+relation[pilot.relationship].toUpperCase():''),'muted'),presenceBadge(current,pilot.id));
  identity.append(badge,info);content.append(identity,node('p',pilot.crew?`[${pilot.tag}] ${pilot.crew}`:'Sem Crew','public-crew'));
  const stats=node('div','','stats public-stats');
  for(const [label,value] of [['Corridas',pilot.races],['Vitórias',pilot.wins],['Melhor 402 m',time(pilot.best)],['Melhor 600 m',time(pilot.best600)]]){
   const stat=node('div','','stat');stat.append(node('strong',String(value)),node('span',label));stats.append(stat);
  }
  content.append(stats);
  if(pilot.relationship==='self')return;
  const actions=node('div','','pilot-actions');
  const add=(label,action,success,cls)=>actions.append(button(label,()=>operate(current,()=>current.api.friendAction(pilot.id,action),success),cls));
  if(pilot.relationship==='none')add('ADICIONAR AMIGO','request','Pedido de amizade enviado.','btn');
  if(pilot.relationship==='outgoing')add('CANCELAR PEDIDO','cancel','Pedido cancelado.','btn ghost');
  if(pilot.relationship==='incoming'){add('ACEITAR AMIZADE','accept','Vocês agora são amigos!','btn');add('RECUSAR','decline','Pedido recusado.','btn ghost')}
  if(pilot.relationship==='friend')add('REMOVER AMIGO','remove','Amizade removida.','btn ghost');
  content.append(actions,node('div','Convidar para arrancada','eyebrow pilot-invite-heading'));
  const invites=node('div','','pilot-actions');
  for(const distance of [402,600])invites.append(button(distance+' m',()=>operate(current,async()=>{await current.api.invitePilot(pilot.id,distance);document.querySelector(`input[name="raceTrack"][value="${distance===600?'dusk':'night'}"]`).checked=true},'Convite de '+distance+' m enviado.')));
  invites.append(button('ABRIR CONVITES',()=>show('raceLobby'),'btn ghost'));content.append(invites);
 }
 function renderList(current,rows){
  if(session!==current)return;
  const list=el('pilotDirectory');list.replaceChildren();
  current.ids=rows.map(p=>p.id);
  current.online=null;
  for(const p of rows){const item=node('li'),info=node('div');info.append(node('strong',p.name),node('small',`Nível ${p.level}${p.tag?' · ['+p.tag+']':''}${relation[p.relationship]?' · '+relation[p.relationship]:''}`,'muted'),presenceBadge(current,p.id));item.append(info,button('VER PERFIL',()=>{renderCard(current,p);if(window.innerWidth<=700)el('pilotPublicCard').scrollIntoView({block:'start'})}));list.append(item)}
  if(!rows.length)list.append(node('li','Nenhum piloto encontrado.','muted'));
  renderCard(current,rows.find(p=>p.id===current.selected)??rows[0]);
  if(notifications)void syncPresence(notifications);
 }
 async function refresh(current){const rows=await current.api.pilots(el('pilotSearch').value.trim(),current.scope);renderList(current,rows)}
 async function operate(current,action,success=''){
  if(session!==current||current.busy)return;
  current.busy=true;el('pilotsStatus').textContent='Aguarde…';
  try{await action();if(session!==current)return;try{await refresh(current)}catch(error){if(success){el('pilotsStatus').textContent=success+' Atualize a lista para conferir.';return}throw error}el('pilotsStatus').textContent=success}
  catch(error){if(session===current)el('pilotsStatus').textContent=message(error)}finally{current.busy=false}
 }
 function selectScope(current,scope){
  current.scope=scope;current.selected=null;el('pilotSearch').value='';
  el('pilotScopes').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===scope)));
 }
 el('pilotScopes').addEventListener('click',event=>{const b=event.target.closest('button[data-scope]'),current=session;if(!b||!current||current.busy)return;selectScope(current,b.dataset.scope);operate(current,async()=>{})});
 el('pilotSearchForm').onsubmit=event=>{event.preventDefault();if(session)operate(session,async()=>{})};

 // Poll the authenticated invite inbox even outside its screen. No race controls are interrupted.
 function renderNotice(current){
  if(notifications!==current)return;
  const invite=current.rows.find(r=>!r.outgoing&&r.status==='pending');
  if(current.invite?.id!==invite?.id)el('raceNoticeStatus').textContent='';
  current.invite=invite??null;
  const driving=screen==='driving',visible=!!invite&&screen!=='auth'&&screen!=='raceLobby';
  el('raceNotice').classList.toggle('hidden',!visible);el('raceNotice').classList.toggle('passive',driving);
  if(!visible)return;
  const detail=invite.distance+' m'+(driving?' · Responda ao sair da pista':current.rows.filter(r=>!r.outgoing&&r.status==='pending').length>1?' · Há mais convites':' · Quer correr com você.');
  if(el('raceNoticePilot').textContent!==invite.sender_name)el('raceNoticePilot').textContent=invite.sender_name;
  if(el('raceNoticeDetail').textContent!==detail)el('raceNoticeDetail').textContent=detail;
  el('raceNoticeActions').classList.toggle('hidden',driving);
  el('raceNoticeAccept').disabled=current.busy;el('raceNoticeDecline').disabled=current.busy;
 }
 async function poll(current){
  if(notifications!==current||current.loading||document.hidden)return;
  current.loading=true;
  try{const rows=await current.api.raceInvites();if(notifications===current&&!current.busy){current.rows=rows;renderNotice(current)}}catch{/* Existing lobby displays connection errors. */}finally{current.loading=false}
 }
 async function answer(action){
  const current=notifications,invite=current?.invite;
  if(!invite||current.busy||screen==='driving'||screen==='raceLobby'||GearLineCommunity.busy)return;
  current.busy=true;renderNotice(current);el('raceNoticeStatus').textContent='';
  try{await current.api.actOnRaceInvite(invite.id,action);if(notifications!==current)return;
   current.rows=current.rows.filter(r=>r.id!==invite.id);renderNotice(current);
   if(action==='accept'&&screen!=='driving'&&!GearLineCommunity.busy){document.querySelector(`input[name="raceTrack"][value="${invite.distance===600?'dusk':'night'}"]`).checked=true;show('raceLobby')}
  }catch(error){if(notifications===current)el('raceNoticeStatus').textContent=message(error)}
  finally{current.busy=false;if(notifications===current){renderNotice(current);void poll(current)}}
 }
 el('raceNoticeAccept').onclick=()=>answer('accept');el('raceNoticeDecline').onclick=()=>answer('decline');
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&notifications){void poll(notifications);void syncPresence(notifications)}
 });
 return {
  open(api){const current={api,scope:'all',selected:null,busy:false,ids:[],online:null};session=current;window.scrollTo(0,0);selectScope(current,'all');el('pilotDirectory').replaceChildren();renderCard(current,null);operate(current,async()=>{})},
  close(){session=null},
  screen(id){screen=id;const parent=id==='driving'?el('driving'):document.body;if(el('raceNotice').parentElement!==parent)parent.append(el('raceNotice'));if(notifications)renderNotice(notifications)},
  start(api){
   this.stop();
   if(typeof api.raceInvites!=='function')return;
   const current={api,rows:[],loading:false,busy:false};
   notifications=current;
   current.timer=setInterval(()=>void poll(current),3000);
   if(typeof api.pilotPresence==='function'){
    current.presenceTimer=setInterval(()=>void syncPresence(current),presenceIntervalMs);
    void syncPresence(current);
   }
   void poll(current);
  },
  stop(){
   if(notifications){clearInterval(notifications.timer);clearInterval(notifications.presenceTimer)}
   notifications=null;
   el('raceNotice').classList.add('hidden');
   el('raceNoticeStatus').textContent='';
  }
 };
})();
