const GearLineOnlineRace=(()=>{
 const configuredOrigin=window.GEARLINE_DUEL_ENDPOINT||'';
 const duelUrl=path=>(configuredOrigin||'')+'/duel/'+path;
 const tickMs=20;
 const maxPredictionMs=120;

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
  let nextShift=null;
  let shiftMeasurement=null;
  let lastShiftConfirmationMs=null;
  let failures=0;
  const history=[];
  let packetIntervalMs=60;
  let packetJitterMs=0;
  let lastRoundTripMs=null;
  let presentationTick=null;
  let lastSampleAt=null;
  const connection={
   id,state:null,failed:false,
   finishInvite(){return api.finishRaceInvite(inviteId)},
   shift(direction){nextShift={direction,pressedAt:performance.now()}},
   sample(now){
    if(!history.length)return connection.state;
    const latest=history[history.length-1];
    if(latest.state.phase==='finished')return latest.state;
    // Keep enough history for the next packet, even when request times vary.
    const arrivalDelayMs=Math.max(45,Math.min(280,packetIntervalMs*.7+25+packetJitterMs*1.5));
    const desiredTick=latest.state.tick+(Math.max(0,now-latest.receivedAt)-arrivalDelayMs)/tickMs;
    const earliestTick=history[0].state.tick;
    const latestTick=latest.state.tick+(latest.state.phase==='racing'?maxPredictionMs/tickMs:0);
    if(presentationTick===null){
     presentationTick=Math.max(earliestTick,Math.min(latestTick,desiredTick));
    }else{
     const elapsedTicks=Math.max(0,now-lastSampleAt)/tickMs;
     const next=presentationTick+elapsedTicks;
     // Adjust the pace gradually instead of changing position on packet arrival.
     const limit=elapsedTicks*.2;
     const correction=Math.max(-limit,Math.min(limit,desiredTick-next));
     presentationTick=Math.max(presentationTick,earliestTick,Math.min(latestTick,next+correction));
    }
    lastSampleAt=now;
    const targetTick=presentationTick;
    if(targetTick<=history[0].state.tick)return history[0].state;
    for(let index=1;index<history.length;index++){
     const after=history[index],before=history[index-1];
     if(targetTick>after.state.tick)continue;
     if(targetTick===after.state.tick)return after.state;
     const blend=Math.max(0,Math.min(1,(targetTick-before.state.tick)/(after.state.tick-before.state.tick)));
     return {...before.state,tick:targetTick,players:before.state.players.map(previous=>{
      const player=after.state.players.find(item=>item.id===previous.id);
      if(!player)return previous;
      const mix=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?a+(b-a)*blend:b;
      return {...previous,distance:mix(previous.distance,player.distance),speed:mix(previous.speed,player.speed),
       rpm:mix(previous.rpm,player.rpm),boost:mix(previous.boost,player.boost),nitro:mix(previous.nitro,player.nitro)};
     })};
    }
    const predictionMs=Math.max(0,Math.min(maxPredictionMs,(targetTick-latest.state.tick)*tickMs));
    if(!predictionMs||latest.state.phase!=='racing')return latest.state;
    const seconds=predictionMs/1000;
    return {...latest.state,tick:targetTick,players:latest.state.players.map(player=>({...player,
     distance:player.time===null?Math.min(latest.state.distance,player.distance+player.speed/3.6*seconds):player.distance
    }))};
   },
   networkStats(now){
    const latest=history.at(-1);
    return {
     roundTripMs:lastRoundTripMs,
     shiftConfirmationMs:lastShiftConfirmationMs,
     stateAgeMs:latest?Math.max(0,now-latest.receivedAt):null,
     waitingForState:!!latest&&latest.state.phase==='racing'&&presentationTick>=latest.state.tick+maxPredictionMs/tickMs
    };
   },
   poll(now,input){
    if(closed||pending||now<nextRequest)return;
    pending=true;
    nextRequest=now+60;
    const shift=nextShift;
    nextShift=null;
    const commandSequence=sequence++;
    if(shift){
     const gear=connection.state?.players?.find(player=>player.id===id)?.gear;
     const expectedGear=gear+shift.direction;
     // If two commands overlap, a later snapshot may not identify which one changed the gear.
     shiftMeasurement=!shiftMeasurement&&Number.isInteger(gear)&&expectedGear>=0&&expectedGear<=5
      ?{pressedAt:shift.pressedAt,sequence:commandSequence,expectedGear}:null;
    }
    const sentAt=performance.now();
    request('state',{key,input:{...input,sequence:commandSequence,shift:shift?.direction??0}})
     .then(state=>{if(!closed){
      connection.state=state;
      const receivedAt=performance.now();
      lastRoundTripMs=receivedAt-sentAt;
      if(shiftMeasurement){
       const player=state.players?.find(item=>item.id===id);
       const elapsed=receivedAt-shiftMeasurement.pressedAt;
       if(elapsed>2000||state.phase==='finished'){
        shiftMeasurement=null;
       }else if(player?.sequence>=shiftMeasurement.sequence&&player.gear===shiftMeasurement.expectedGear){
        lastShiftConfirmationMs=elapsed;
        shiftMeasurement=null;
       }
      }
      if(Number.isFinite(state.tick)){
       const entry={state,receivedAt},last=history[history.length-1];
       if(!last||state.tick>last.state.tick){
        if(last){
         const interval=Math.min(420,receivedAt-last.receivedAt);
         packetJitterMs=packetJitterMs*.8+Math.abs(interval-packetIntervalMs)*.2;
         packetIntervalMs=packetIntervalMs*.75+interval*.25;
        }else{
         packetIntervalMs=Math.max(60,Math.min(420,lastRoundTripMs));
        }
        history.push(entry);
       }
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
