const GearLineCommunity=(()=>{
 const el=id=>document.getElementById(id);
 const fmt=(value,prefix)=>prefix+Number(value).toLocaleString('pt-BR');
 let session=null,busy=false;
 const message=error=>({GL_SIGN_IN:'Entre na sua conta.',GL_PROFILE_REQUIRED:'Abra seu perfil primeiro.',GL_STALE_PROFILE:'Seu progresso mudou em outro aparelho. Entre novamente.',GL_INVALID_AMOUNT:'Confira a quantidade de lotes.',GL_INSUFFICIENT_CASH:'Saldo em reais insuficiente.',GL_INSUFFICIENT_USD:'São necessários US$ 50 para criar uma Crew.',GL_INVALID_CREW:'Confira o nome e a sigla.',GL_ALREADY_IN_CREW:'Você já faz parte de uma Crew.',GL_CREW_TAKEN:'Nome ou sigla já está em uso.',GL_CREW_MISSING:'Esta Crew não está mais disponível.',GL_CREW_FULL:'Equipe lotada (30 membros).'})[error?.message]||(['PGRST202','PGRST205','42P01'].includes(error?.code)?'O sistema ainda não foi ativado no servidor.':'Não foi possível concluir. Confira sua conexão e tente novamente.');
 function text(tag,value,cls){const node=document.createElement(tag);node.textContent=value;if(cls)node.className=cls;return node}
 function button(label,fn){const node=text('button',label,'btn secondary');node.type='button';node.onclick=fn;return node}
 function status(current,value){if(session===current)el(current.screen+'Status').textContent=value}
 function controls(current,disabled){
  document.querySelectorAll('#'+current.screen+' button, #'+current.screen+' input').forEach(node=>{node.disabled=disabled});
  el('brandHome').disabled=disabled;el('logout').disabled=disabled;
 }
 function wallet(current){
  const {progress,api}=current;
  el('exchangeCash').textContent=api.unlimitedCash?'R$ ∞':fmt(progress.cash,'R$ ');
  el('exchangeUsd').textContent=fmt(progress.usd,'US$ ');
  el('crewWallet').textContent=api.unlimitedCash?'Conta oficial • custo de criação isento.':'Seu saldo: '+fmt(progress.usd,'US$ ');
  updateQuote();
 }
 function updateQuote(){
  const current=session;if(!current||current.screen!=='exchange')return;
  const input=el('exchangeLots'),lots=Number(input.value),valid=Number.isInteger(lots)&&lots>=1&&lots<=1000000;
  el('exchangePay').textContent=valid?(current.api.unlimitedCash?'R$ 0 (conta oficial)':fmt(lots*1000,'R$ ')):'—';
  el('exchangeReceive').textContent=valid?fmt(lots*5,'US$ '):'—';
  el('exchangeSubmit').disabled=busy||!valid||(!current.api.unlimitedCash&&current.progress.cash<lots*1000)||current.progress.usd+lots*5>1e9;
 }
 function render(current,result){
  if(session!==current)return;
  const own=result.own, directory=el('crewDirectory'), members=el('crewMembers');
  el('crewOwnName').textContent=own?`[${own.tag}] ${own.name}`:'SEM CREW';
  el('crewOwnDetail').textContent=own?`${result.members.length}/30 membros • ${own.leader?'Você é líder':'Você é membro'}`:'Crie sua equipe ou entre em uma existente gratuitamente.';
  el('crewCreate').classList.toggle('hidden',!!own);el('crewLeave').classList.toggle('hidden',!own);el('crewLeaveConfirm').classList.add('hidden');
  members.replaceChildren();directory.replaceChildren();
  for(const member of result.members){const row=text('li','');row.append(text('strong',member.name+(member.self?' (você)':'')),text('small',member.leader?'LÍDER':'MEMBRO',member.leader?'social-accent':'muted'));members.append(row)}
  for(const crew of result.crews){
   const row=text('li',''),details=text('div','');details.append(text('strong',`[${crew.tag}] ${crew.name}`),text('small',`${crew.member_count}/30 membros`,'muted'));row.append(details);
   if(!own&&crew.member_count<30)row.append(button('ENTRAR',()=>run(current,()=>current.api.joinCrew(crew.id),'Você entrou na Crew!')));
   else if(own?.id===crew.id)row.append(text('small','SUA CREW','social-accent'));
   directory.append(row);
  }
  if(!result.crews.length)directory.append(text('li','Nenhuma Crew encontrada.','muted'));
  wallet(current);
 }
 async function refresh(current){
  const result=await current.api.crewDirectory(el('crewSearch').value.trim());
  render(current,result);
 }
 async function run(current,operation,success=''){
  if(session!==current||busy)return;
  busy=true;controls(current,true);status(current,'Aguarde…');
  try{await operation();if(session!==current)return;wallet(current);if(current.screen==='crew'){try{await refresh(current)}catch(error){if(success){status(current,success+' Não foi possível atualizar a lista. Use Buscar.');return}throw error}}status(current,success)}
  catch(error){status(current,message(error))}
  finally{busy=false;if(session===current){controls(current,false);updateQuote()}}
 }
 el('crewSearchForm').onsubmit=event=>{event.preventDefault();if(session?.screen==='crew')run(session,async()=>{},'')};
 el('crewCreate').onsubmit=event=>{event.preventDefault();const current=session;if(current?.screen!=='crew')return;run(current,async()=>{await current.api.createCrew(el('crewName').value.trim(),el('crewTag').value.trim().toUpperCase(),current.progress);el('crewName').value='';el('crewTag').value=''},'Crew criada!')};
 el('crewLeave').onclick=()=>el('crewLeaveConfirm').classList.remove('hidden');
 el('crewLeaveNo').onclick=()=>el('crewLeaveConfirm').classList.add('hidden');
 el('crewLeaveYes').onclick=()=>{const current=session;if(current?.screen==='crew')run(current,()=>current.api.leaveCrew(),'Você saiu da Crew.')};
 el('exchangeLots').oninput=updateQuote;
 el('exchangeForm').onsubmit=event=>{event.preventDefault();const current=session;if(current?.screen!=='exchange')return;const lots=Number(el('exchangeLots').value);if(!Number.isInteger(lots)||lots<1||lots>1000000||el('exchangeSubmit').disabled)return;run(current,()=>current.api.exchange(lots,current.progress),'Conversão concluída!')};
 return {get busy(){return busy},open(screen,api,progress){
  session={screen,api,progress};window.scrollTo(0,0);status(session,'');wallet(session);
  if(screen==='crew'){el('crewCreate').classList.add('hidden');el('crewLeave').classList.add('hidden');el('crewLeaveConfirm').classList.add('hidden');el('crewMembers').replaceChildren();el('crewDirectory').replaceChildren();el('crewOwnName').textContent='CARREGANDO…';el('crewOwnDetail').textContent='Consultando equipes.';run(session,async()=>{})}
 },close(){session=null}};
})();
