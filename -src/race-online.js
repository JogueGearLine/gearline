const GearLineOnlineRace=(()=>{
 const configuredOrigin=window.GEARLINE_DUEL_ENDPOINT||'';
 const duelUrl=path=>(configuredOrigin||'')+'/duel/'+path;

 function testUrl(){
  if(configuredOrigin)return configuredOrigin+'/';
  const url=new URL('http://localhost:8001/');
  if(location.protocol==='http:'||location.protocol==='https:')url.hostname=location.hostname;
  url.searchParams.set('v','duelo3');
  return url.href;
 }

 async function request(path,body){
  const response=await fetch(duelUrl(path),{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(5000)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||'Abra a versão de teste da corrida online.');
  return result;
 }

 async function join(api,inviteId,color=0){
  if(location.protocol==='file:')throw new Error('GL_DUEL_ADDRESS');
  const health=await fetch(duelUrl('health'),{cache:'no-store',signal:AbortSignal.timeout(3000)}).catch(()=>null);
  if(!health?.ok)throw new Error('GL_DUEL_ADDRESS');
  await api.flush?.();
  const ticket=await api.duelTicket(inviteId);
  const {key,id}=await request('join',{inviteId,ticket,color});
  let closed=false;
  let pending=false;
  let nextRequest=0;
  let sequence=0;
  let nextShift=0;
  let failures=0;
  const connection={
   id,state:null,failed:false,
   shift(direction){nextShift=direction},
   poll(now,input){
    if(closed||pending||now<nextRequest)return;
    pending=true;
    nextRequest=now+60;
    const shift=nextShift;
    nextShift=0;
    request('state',{key,input:{...input,sequence:sequence++,shift}})
     .then(state=>{if(!closed){connection.state=state;failures=0;}})
     .catch(()=>{if(!closed&&++failures>=3)connection.failed=true;})
     .finally(()=>{pending=false;});
   },
   close(notify){
    if(closed)return;
    closed=true;
    if(notify)void request('leave',{key}).catch(()=>{});
   }
  };
  return connection;
 }
 return {join,testUrl};
})();
