const GearLineFreeOnline=(()=>{
 const syncIntervalMs=200;
 const maximumPredictionMs=180;
 const stalePositionMs=1200;
 const presentationDelayMs=420;

 function recordPosition(history,position){
  const previous=history.at(-1);
  if(previous&&position.at<=previous.at+8)return;
  history.push(position);
  while(history.length>2&&history[1].at<position.at-stalePositionMs)history.shift();
 }

 function samplePosition(history,at,predictionMs=0){
  if(!history.length||at<history[0].at)return null;
  for(let index=1;index<history.length;index++){
   const next=history[index];
   if(at>next.at)continue;
   const previous=history[index-1];
   const ratio=(at-previous.at)/(next.at-previous.at);
   return {
    distance:previous.distance+(next.distance-previous.distance)*ratio,
    lane:previous.lane+(next.lane-previous.lane)*ratio
   };
  }
  const latest=history.at(-1);
  const lead=Math.min(predictionMs,at-latest.at)/1000;
  return {distance:latest.distance+latest.speed/3.6*lead,lane:latest.lane};
 }

 function relativePosition(peer,localHistory,now){
  if(now-peer.history.at(-1).at>stalePositionMs)return null;
  const at=now-presentationDelayMs;
  const local=samplePosition(localHistory,at);
  const remote=samplePosition(peer.history,at,maximumPredictionMs);
  if(!local||!remote)return null;
  const separation=remote.distance-local.distance;
  const gap=Math.sign(separation)*Math.max(0,Math.abs(separation)-.65);
  return {gap,lane:remote.lane};
 }

 function connect(api,vehicle,readDrive,onStatus){
  const session=crypto.randomUUID();
  const drivers=new Map();
  const localHistory=[];
  let offset=0, joined=false, closed=false, pending=false, timer;
  let oneWay=null;
  const leave=()=>api.leaveFreeDrive(session).catch(()=>{});

  async function sync(){
   const drive=readDrive();
   const sentAt=performance.now();
   let delay=900;
   pending=true;
   try{
    const result=await api.syncFreeDrive({
     p_session:session,p_join:!joined,p_vehicle:vehicle.id,p_color:vehicle.color,p_exhaust:vehicle.exhaust,
     p_distance:offset+drive.dist,p_lane:drive.lane,p_speed:drive.speed,p_braking:drive.braking
    });
    if(!joined){joined=true;offset=result.distance-drive.dist;}
    if(closed)return;
    const now=performance.now();
    const measuredOneWay=Math.min(250,(now-sentAt)/2);
    oneWay=oneWay===null?measuredOneWay:oneWay*.8+measuredOneWay*.2;
    delay=Math.max(0,syncIntervalMs-(now-sentAt));
    for(const peer of result.drivers){
     const previous=drivers.get(peer.id);
     const ageAtReceiptMs=(Number.isFinite(peer.ageMs)?Math.max(0,peer.ageMs):0)+oneWay;
     if(ageAtReceiptMs>stalePositionMs)continue;
     const last=previous?.history.at(-1);
     const reusable=last&&now-last.at<=stalePositionMs&&peer.distance>=last.distance-1;
     const history=reusable?previous.history:[];
     recordPosition(history,{...peer,at:now-ageAtReceiptMs});
     drivers.set(peer.id,{
      ...peer,history,shownGap:reusable?previous.shownGap:null,
      shownLane:reusable?previous.shownLane:peer.lane,
      wheelAngle:reusable?previous.wheelAngle:0
     });
    }
    for(const [id,peer] of drivers)if(now-peer.history.at(-1).at>stalePositionMs)drivers.delete(id);
    const count=result.player_count??drivers.size+1;
    onStatus(count===1?'1 piloto na pista':count+' pilotos na pista');
   }catch(error){
    if(closed)return;
    if(error.message?.includes('GL_DRIVE_SESSION_ENDED')){
     drivers.clear();
     closed=true;
     onStatus('Sessão online encerrada');
     return;
    }
    if(error.code==='PGRST202'){
     closed=true;
     onStatus('Online em preparação');
     return;
    }
    onStatus('Avenida indisponível • reconectando');
   }finally{
    pending=false;
    if(closed){if(joined)void leave();}
    else timer=setTimeout(sync,delay);
   }
  }

  void sync();
  return {
   drivers,
   position(distance){return offset+distance;},
   sampleLocal(distance,lane,now){
    if(joined)recordPosition(localHistory,{at:now,distance:offset+distance,lane,speed:0});
   },
   relativePosition(peer,now){return relativePosition(peer,localHistory,now);},
   close(){
    closed=true;
    clearTimeout(timer);
    drivers.clear();
    if(!pending&&joined)void leave();
   }
  };
 }
 const ground=lane=>297+(lane-360)*1.26;
 const carWidth=lane=>242+(lane-360)*.19;
 const pixelsPerMeter=46;
 const spawnLane=580;
 let skyline;

 function loadScenery(){
  if(skyline)return;
  skyline=new Image();
  skyline.src='-Assets/Texture/avenida-urbana-online.webp';
 }

 function drawScenery(ctx,width,scroll,asphalt){
  const sky=ctx.createLinearGradient(0,0,0,228);
  sky.addColorStop(0,'#071322');sky.addColorStop(1,'#28374e');
  ctx.fillStyle=sky;ctx.fillRect(0,0,width,228);
  if(skyline?.complete&&skyline.naturalWidth){
   const tile=950, offset=scroll*.045, first=Math.floor(offset/tile);
   for(let i=first, x=i*tile-offset;x<width;i++,x+=tile){
    const reversed=i%2!==0;
    ctx.save();ctx.translate(x+(reversed?tile:0),0);ctx.scale(reversed?-1:1,1);
    ctx.drawImage(skyline,0,0,tile,228);ctx.restore();
   }
  }
  ctx.fillStyle='#38413e';ctx.fillRect(0,216,width,12);
  ctx.fillStyle='#292f36';ctx.fillRect(0,228,width,372);
  if(asphalt.complete&&asphalt.naturalWidth){
   const step=372;
   for(let x=-(scroll%step);x<width;x+=step)ctx.drawImage(asphalt,x,228,step,step);
  }
  ctx.fillStyle='#0c162069';ctx.fillRect(0,228,width,372);
  ctx.fillStyle='#5f6b7544';ctx.fillRect(0,228,width,20);ctx.fillRect(0,555,width,45);
  ctx.fillStyle='#bba871';ctx.fillRect(0,246,width,2);
  ctx.fillStyle='#e6e3d4';ctx.fillRect(0,552,width,2);
  ctx.fillStyle='#adb6bdad';
  for(let x=-(scroll%177);x<width;x+=177){
   for(const y of [323,399,475])ctx.fillRect(x,y,74,2);
  }
  for(let x=72-scroll%360;x<width+110;x+=360){
   ctx.strokeStyle='#334450';ctx.lineWidth=3;
   ctx.beginPath();ctx.moveTo(x,228);ctx.lineTo(x,139);ctx.lineTo(x+30,132);ctx.stroke();
   ctx.fillStyle='#f8d9a4';ctx.fillRect(x+24,131,14,3);
   const glow=ctx.createRadialGradient(x+31,134,1,x+31,134,25);
   glow.addColorStop(0,'#ffc47c67');glow.addColorStop(1,'#ffc47c00');
   ctx.fillStyle=glow;ctx.fillRect(x+6,109,50,50);
  }
 }

 const traffic=[
  {vehicle:'astra',color:0,lane:367,speed:52,offset:38,spacing:94},
  {vehicle:'chevette',color:2,lane:430,speed:66,offset:66,spacing:120},
  {vehicle:'gol',color:0,lane:548,speed:86,offset:27,spacing:112}
 ];
 function nearbyTraffic(position,seconds){
  return traffic.map(car=>{
   const travel=seconds*car.speed/3.6+car.offset;
   const distance=travel+Math.round((position-travel)/car.spacing)*car.spacing;
   return {...car,distance,wheelAngle:(travel/.29)%(Math.PI*2)};
  });
 }

 function contactInterval(from,to,limit){
  const delta=to-from;
  if(delta===0)return Math.abs(from)<limit?[0,1]:null;
  const a=(-limit-from)/delta,b=(limit-from)/delta;
  const enter=Math.max(0,Math.min(a,b)), exit=Math.min(1,Math.max(a,b));
  return enter<exit?[enter,exit]:null;
 }

 function hitsTraffic(previousPosition,position,previousLane,lane,seconds,dt){
  const laneClearance=23;
  return nearbyTraffic(position,seconds).some(car=>{
   const length=(carWidth(lane)+carWidth(car.lane))*.43/pixelsPerMeter;
   const fromX=previousPosition-(car.distance-car.speed/3.6*dt), toX=position-car.distance;
   const fromY=previousLane-car.lane, toY=lane-car.lane;
   if(Math.abs(fromX)<length&&Math.abs(fromY)<laneClearance)return false;
   const along=contactInterval(fromX,toX,length), across=contactInterval(fromY,toY,laneClearance);
   return along&&across&&Math.max(along[0],across[0])<Math.min(along[1],across[1]);
  });
 }
 return {connect,recordPosition,relativePosition,loadScenery,drawScenery,nearbyTraffic,hitsTraffic,ground,carWidth,pixelsPerMeter,spawnLane};
})();
