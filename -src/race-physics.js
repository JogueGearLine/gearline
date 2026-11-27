// Shared vehicle simulation. No DOM, clock or network dependencies.
const GearLineRacePhysics=(()=>{
 const vehiclePhysics={
  gol:{maxRpm:6800,speedCap:245,driveForce:15.7,torquePeak:4000,roadLoad:.92,ratios:[0,3.55,1.97,1.32,1,.80]},
  peugeot206:{maxRpm:7000,speedCap:207,driveForce:13.2,torquePeak:4650,turboAvailable:true,ratios:[0,3.62,1.97,1.36,1.04,.80]},
  astra:{maxRpm:6500,speedCap:224,driveForce:15.0,torquePeak:4250,roadLoad:1.02,turboAvailable:true,ratios:[0,3.58,1.87,1.27,.96,.76]},
  chevette:{maxRpm:6200,speedCap:178,driveForce:12.1,torquePeak:3400,roadLoad:.87,turboAvailable:true,ratios:[0,3.76,2.16,1.40,1,.82]},
  lancer:{maxRpm:7500,speedCap:250,driveForce:24,torquePeak:3900,roadLoad:1.18,factoryTurbo:true,ratios:[0,2.86,1.95,1.44,1.10,.76]}
 };

 const ratios=[0,3.45,1.94,1.29,.97,.80];

 function gearRatio(gear,upgrades,model){
  return (model.ratios||ratios)[gear]*(upgrades.shortGearing?1.12:1);
 }

 function engineTorque(rpm,upgrades,model){
  const stock=Math.max(.35,1-Math.abs(rpm-model.torquePeak)/6500);
  const tune=upgrades.tune?.23*Math.max(.32,1-Math.abs(rpm-3300)/4700):0;
  const exhaust=upgrades.exhaust?.1*Math.max(0,Math.min(1,(rpm-3000)/2800)):0;
  return stock*(1+tune+exhaust);
 }
 const raceDistance=402;

 function newRun(gear=0){
  return {speed:0,rpm:900,gear,nitro:100,dist:0,max:0,elapsed:0,shiftLock:0,boost:0,clutch:0,finishTime:null};
 }
 function updateTurbo(boost,rpm,throttle,installed,dt){
  const target=installed&&throttle?Math.max(0,Math.min(1,(rpm-2350)/1900)):0;
  return boost+(target-boost)*Math.min(1,dt*(target>boost?3.2:6));
 }

 function advanceCar(driver,model,upgrades,accel,brake,nitro,dt,{launchRpm=0,finishDistance=Infinity}={}){
  driver.nitroActive=false;
  if(driver.finishTime!==null){
   const rolloutSpeed=Math.min(driver.finishSpeed,35);
   driver.speed=Math.max(rolloutSpeed,driver.speed-(4+driver.speed*.04)*dt);
   const meters=driver.speed/3.6*dt;
   driver.dist+=meters;
   const rpm=Math.max(900,driver.speed*gearRatio(driver.gear,upgrades,model)*30);
   driver.rpm+=(Math.min(model.maxRpm,rpm)-driver.rpm)*Math.min(1,dt*9);
   return meters;
  }
  const inGear=driver.gear>0;
  const ratio=gearRatio(driver.gear,upgrades,model);
  const coupled=driver.speed*ratio*30;
  const launching=driver.gear===1&&driver.speed<32;
  if(!launching)driver.clutch=inGear?1:0;
  else if(accel&&!brake)driver.clutch=Math.min(1,driver.clutch+dt/.30);
  else if(driver.speed<2)driver.clutch=0;
  const launchBlend=Math.max(0,Math.min(1,(32-driver.speed)/14));
  const takeoffRpm=launchRpm||Math.min(3450,model.torquePeak*.76);
  const launchFloor=accel&&launching
   ?(takeoffRpm+(1-driver.clutch)*550)*launchBlend:0;
  const target=inGear?Math.max(900,coupled,launchFloor):accel?model.maxRpm:900;
  driver.rpm+=(Math.min(model.maxRpm,target)-driver.rpm)*Math.min(1,dt*9);
  driver.boost=updateTurbo(driver.boost,driver.rpm,accel&&!brake,model.factoryTurbo||upgrades.turbo,dt);
  const torque=engineTorque(driver.rpm,upgrades,model)*(1+.42*driver.boost);
  const pulling=inGear&&accel&&!brake&&driver.shiftLock<=0&&coupled<model.maxRpm;
  const speedCap=model.speedCap+(upgrades.turbo?23:0);
  const nitroSeconds=pulling&&nitro&&upgrades.nitro&&driver.speed<speedCap?Math.min(dt,driver.nitro/24):0;
  const nitroMultiplier=2.15;
  const force=pulling?model.driveForce*ratio/3.45*torque*driver.clutch:0;
  driver.nitroActive=nitroSeconds>0;
  const decel=brake?32:1+(driver.speed*.012+driver.speed*driver.speed*.000035)*(model.roadLoad??1);
  driver.speed=Math.max(0,Math.min(speedCap,driver.speed+(force-decel)*dt+force*(nitroMultiplier-1)*nitroSeconds));
  driver.nitro=Math.max(0,driver.nitro-nitroSeconds*24);
  driver.shiftLock=Math.max(0,driver.shiftLock-dt);
  const meters=driver.speed/3.6*dt;
  if(driver.dist+meters>=finishDistance && meters>0){
   const remaining=finishDistance-driver.dist;
   driver.finishTime=driver.elapsed+dt*remaining/meters;
   driver.elapsed=driver.finishTime;
   driver.finishSpeed=driver.speed;
  }else{
   driver.elapsed+=dt;
  }
  driver.dist+=meters;
  driver.max=Math.max(driver.max,driver.speed);
  return meters;
 }

 function stepRival(rival,dt,finishDistance=raceDistance){
  const {model,upgrades}=rival;
  if(rival.elapsed<rival.reaction){
   const wait=Math.min(dt,rival.reaction-rival.elapsed);
   rival.elapsed+=wait;
   dt-=wait;
   if(dt<=0)return;
  }
  if(rival.finishTime===null && rival.gear<5 && rival.shiftLock<=0){
   const current=gearRatio(rival.gear,upgrades,model);
   const next=gearRatio(rival.gear+1,upgrades,model);
   const rpm=rival.speed*current*30;
   const nextRpm=rival.speed*next*30;
   const currentPull=current*engineTorque(rpm,upgrades,model);
   const nextPull=next*engineTorque(nextRpm,upgrades,model);
   if(rpm>=model.maxRpm*rival.shiftLimit || (rpm>model.torquePeak&&nextPull>currentPull)){
    rival.gear++;
    rival.shiftLock=rival.shiftDelay;
   }
  }
  const nitro=upgrades.nitro&&rival.gear>=2&&rival.shiftLock<=0&&rival.speed>58&&finishDistance-rival.dist>15;
  return advanceCar(rival,model,upgrades,true,false,nitro,dt,{launchRpm:rival.launchRpm,finishDistance});
 }

 return {raceDistance,vehiclePhysics,gearRatio,newRun,advanceCar,stepRival};
})();
if(typeof module==='object'&&module.exports)module.exports=GearLineRacePhysics;
