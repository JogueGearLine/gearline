window.GEARLINE_NEW_CARS_AVAILABLE=true;
window.GEARLINE_NEW_CARS_ONLINE=false;
const GearLineMusic={start(){},stop(){}};
const GearLineRaceLobby={open(){},close(){}};
function createGearLineAccounts(){
 const user={id:'preview',user_metadata:{pilot_name:'Prévia V8.1'}};
 let progress=null;
 return {unlimitedCash:true,conflict:false,restore:async()=>user,recoveryPending:()=>false,
  load:async(_,fresh)=>structuredClone(progress??fresh('Prévia V8.1')),
  save:async(data)=>{progress=structuredClone(data)},flush:async()=>{},signOut:async()=>{},
  resetPassword:async()=>{},register:async()=>user,signIn:async()=>user};
}
