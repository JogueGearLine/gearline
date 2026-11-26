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
  const history=[];
  let oneWayMs=0;
  const connection={
   id,state:null,failed:false,
   shift(direction){nextShift=direction},
   sample(now){
    if(!history.length)return connection.state;
    const latest=history[history.length-1];
    if(latest.state.phase==='finished')return latest.state;
    const targetTick=latest.state.tick+(Math.max(0,now-latest.receivedAt)+latest.oneWayMs-90)/20;
    if(targetTick<=history[0].state.tick)return history[0].state;
    for(let index=1;index<history.length;index++){
     const after=history[index],before=history[index-1];
     if(targetTick>after.state.tick)continue;
     if(after.state.phase==='finished')return after.state;
     const blend=Math.max(0,Math.min(1,(targetTick-before.state.tick)/(after.state.tick-before.state.tick)));
     return {...after.state,tick:targetTick,players:after.state.players.map(player=>{
      const previous=before.state.players.find(item=>item.id===player.id);
      if(!previous)return player;
      const mix=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?a+(b-a)*blend:b;
      return {...player,distance:mix(previous.distance,player.distance),speed:mix(previous.speed,player.speed),
       rpm:mix(previous.rpm,player.rpm),boost:mix(previous.boost,player.boost),nitro:mix(previous.nitro,player.nitro),
       gear:blend<.5?previous.gear:player.gear,nitroActive:blend<.5?previous.nitroActive:player.nitroActive};
     })};
    }
    const predictionMs=Math.max(0,Math.min(120,(targetTick-latest.state.tick)*20));
    if(!predictionMs||latest.state.phase!=='racing')return latest.state;
    const seconds=predictionMs/1000;
    return {...latest.state,players:latest.state.players.map(player=>({...player,
     distance:player.time===null?Math.min(latest.state.distance,player.distance+player.speed/3.6*seconds):player.distance
    }))};
   },
   poll(now,input){
    if(closed||pending||now<nextRequest)return;
    pending=true;
    nextRequest=now+60;
    const shift=nextShift;
    nextShift=0;
    const sentAt=performance.now();
    request('state',{key,input:{...input,sequence:sequence++,shift}})
     .then(state=>{if(!closed){
      connection.state=state;
      const receivedAt=performance.now();
      const measuredOneWay=Math.min(250,(receivedAt-sentAt)/2);
      oneWayMs=oneWayMs?oneWayMs*.75+measuredOneWay*.25:measuredOneWay;
      if(Number.isFinite(state.tick)){
       const entry={state,receivedAt,oneWayMs},last=history[history.length-1];
       if(!last||state.tick>last.state.tick)history.push(entry);
       else if(state.tick===last.state.tick)history[history.length-1]=entry;
       if(history.length>20)history.shift();
      }
      failures=0;
     }})
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
