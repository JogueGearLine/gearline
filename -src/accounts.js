function createGearLineAccounts() {
 const settings={url:'https://sonnspjdhkwyyjkyabxd.supabase.co',key:'sb_publishable_bLSv6pOdIEfGqN-lBzNCiQ_rViREjcb'};
 let remember=false;
 const storage={
  getItem(key){
   const transient=sessionStorage.getItem(key);
   if(transient!==null)return transient;
   const saved=localStorage.getItem(key);
   if(saved!==null)remember=true;
   return saved;
  },
  setItem(key,value){
   const target=remember?localStorage:sessionStorage;
   target.setItem(key,value);
   (remember?sessionStorage:localStorage).removeItem(key);
  },
  removeItem(key){
   sessionStorage.removeItem(key);
   localStorage.removeItem(key);
  }
 };
 const client=window.supabase.createClient(settings.url,settings.key,{auth:{storage,flowType:'pkce',detectSessionInUrl:false}});
 const table=()=>client.from('gearline_saves');
 let account=null;
 let recoveryPending=location.hash.includes('type=recovery');

 function check({data,error}){
  if(error)throw error;
  return data;
 }

 function normalize(saved,fresh){
  const base=fresh(String(saved?.name||'Piloto').trim().slice(0,18)||'Piloto');
  const number=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
  base.cash=number(saved?.cash,0,1e9,base.cash);
  base.races=Math.floor(number(saved?.races,0,1e6,0));
  base.wins=Math.floor(number(saved?.wins,0,1e6,0));
  base.xp=number(saved?.xp,0,1e9,0);
  base.maxSpeed=number(saved?.maxSpeed,0,500,0);
  base.color=Math.floor(number(saved?.color,0,4,0));
  base.peugeotColor=Math.floor(number(saved?.peugeotColor,0,4,0));
  base.astraColor=Math.floor(number(saved?.astraColor,0,4,0));
  base.chevetteColor=Math.floor(number(saved?.chevetteColor,0,4,0));
  const hasGarage=Object.hasOwn(saved??{},'ownedVehicles');
  base.usd=number(saved?.usd,0,1e9,hasGarage?base.usd:0);
  base.ownedVehicles=hasGarage
   ?['gol','peugeot206','astra','chevette'].filter(id=>Array.isArray(saved.ownedVehicles)&&saved.ownedVehicles.includes(id))
   :['gol','peugeot206'];
  base.vehicleId=base.ownedVehicles.includes(saved?.vehicleId)?saved.vehicleId:base.ownedVehicles[0]??null;
  base.best=Number.isFinite(Number(saved?.best))&&Number(saved?.best)>0?Number(saved?.best):null;
  base.best600=Number.isFinite(Number(saved?.best600))&&Number(saved?.best600)>0?Number(saved?.best600):null;
  normalizeSetup(base,saved);
  if(base.peugeotSetup)normalizeSetup(base.peugeotSetup,saved?.peugeotSetup);
  if(base.astraSetup)normalizeSetup(base.astraSetup,saved?.astraSetup);
  if(base.chevetteSetup)normalizeSetup(base.chevetteSetup,saved?.chevetteSetup);
  return base;
 }

 function normalizeSetup(base,saved){
  base.ownedUpgrades={};
  for(const key of Object.keys(base.upgrades)){
   base.upgrades[key]=saved?.upgrades?.[key]===true;
   if(base.upgrades[key]||saved?.ownedUpgrades?.[key]===true)base.ownedUpgrades[key]=true;
  }
  if(saved?.suspension){
   base.suspension={};
   for(const axis of ['front','rear']){
    const height=saved.suspension[axis];
    if([0,16,32,48].includes(height))base.suspension[axis]=height;
   }
  }
 }

 async function load(user,fresh){
  account=null;
  let row=check(await table().select('progress,revision,unlimited_cash').eq('user_id',user.id).maybeSingle());
  if(!row){
   const name=String(user.user_metadata?.pilot_name||'Piloto').trim().slice(0,18)||'Piloto';
   const inserted=await table().insert({user_id:user.id,progress:fresh(name)}).select('progress,revision,unlimited_cash').single();
   row=inserted.error?.code==='23505'
    ?check(await table().select('progress,revision,unlimited_cash').eq('user_id',user.id).single())
    :check(inserted);
  }
  account={id:user.id,revision:Number(row.revision),unlimitedCash:row.unlimited_cash===true,pending:null,queue:Promise.resolve(),conflict:false};
  return normalize(row.progress,fresh);
 }

 function save(progress){
  const current=account;
  if(!current)return Promise.resolve();
  current.pending=structuredClone(progress);
  return flush();
 }

 function flush(){
  const current=account;
  if(!current)return Promise.resolve();
  current.queue=current.queue.catch(()=>{}).then(async()=>{
   if(!current.pending)return;
   if(current.conflict)throw new Error('O progresso foi alterado em outro aparelho. Entre novamente para carregar a versão atual.');
   const snapshot=current.pending;
   const revision=current.revision+1;
   const row=check(await table().update({progress:snapshot,revision}).eq('user_id',current.id)
    .eq('revision',current.revision).select('revision').maybeSingle());
   if(!row){
    current.conflict=true;
    throw new Error('O progresso foi alterado em outro aparelho. Entre novamente para carregar a versão atual.');
   }
   current.revision=Number(row.revision);
   if(current.pending===snapshot)current.pending=null;
  });
  return current.queue;
 }

 async function socialPurchase(rpc,args,progress){
  const current=account;
  if(!current)throw new Error('GL_SIGN_IN');
  await flush();
  if(account!==current||current.conflict)throw new Error('GL_STALE_PROFILE');
  let result;
  try{result=check(await client.rpc(rpc,{...args,p_revision:current.revision}));}
  catch(error){if(error?.message==='GL_STALE_PROFILE')current.conflict=true;throw error;}
  current.revision=Number(result.revision);
  progress.cash=Number(result.cash);progress.usd=Number(result.usd);
  return result;
 }

 return {
  load,save,flush,
  exchange(lots,progress){return socialPurchase('gearline_exchange',{p_lots:lots},progress)},
  createCrew(name,tag,progress){return socialPurchase('gearline_crew_create',{p_name:name,p_tag:tag},progress)},
  async crewDirectory(search=''){return check(await client.rpc('gearline_crew_directory',{p_search:search}))},
  async joinCrew(id){return check(await client.rpc('gearline_crew_join',{p_crew:id}))},
  async leaveCrew(){return check(await client.rpc('gearline_crew_leave'))},
  async pilots(search='',scope='all'){return check(await client.rpc('gearline_pilot_directory',{p_search:search,p_scope:scope}))},
  async friendAction(id,action){return check(await client.rpc('gearline_friend_action',{p_pilot:id,p_action:action}))},
  async invitePilot(id,distance){return check(await client.rpc('gearline_invite_pilot',{p_pilot:id,p_distance:distance}))},
  async raceInvites(){
   const fields='id,sender_id,sender_name,recipient_name,distance,status,sender_ready,recipient_ready';
   const rows=check(await client.from('gearline_race_invites').select(fields)
    .in('status',['pending','accepted']).order('created_at',{ascending:false}).limit(30));
   return rows.map(row=>({...row,outgoing:row.sender_id===account?.id}));
  },
  async sendRaceInvite(pilot,distance){
   return check(await client.rpc('gearline_create_race_invite',{p_pilot:pilot,p_distance:distance}));
  },
  async actOnRaceInvite(id,action){
   check(await client.rpc('gearline_race_invite_action',{p_invite:id,p_action:action}));
  },
  async duelTicket(id){
   return check(await client.rpc('gearline_issue_duel_ticket',{p_invite:id}));
  },
 async syncFreeDrive(state){
   return check(await client.rpc('gearline_free_drive',state).abortSignal(AbortSignal.timeout(4500)));
 },
 async leaveFreeDrive(session){
   check(await client.rpc('gearline_free_leave',{p_session:session}));
 },
  get unlimitedCash(){return account?.unlimitedCash===true},
  get conflict(){return account?.conflict===true},
  async restore(){
   const code=new URLSearchParams(location.search).get('code');
   if(code){
    const result=check(await client.auth.exchangeCodeForSession(code));
    if(result?.redirectType==='recovery')recoveryPending=true;
   }
   const {data}=await client.auth.getSession();
   const user=data.session?.user??null;
   if(user&&(code||location.hash))history.replaceState(null,'',location.pathname);
   return user;
  },
  recoveryPending(){return recoveryPending},
  clearRecovery(){recoveryPending=false},
  async signIn(email,password,keep){
   remember=keep;
   return check(await client.auth.signInWithPassword({email,password})).user;
  },
  async register(email,password,name){
   remember=false;
   const result=check(await client.auth.signUp({email,password,options:{data:{pilot_name:name}}}));
   return result.session?.user??null;
  },
  async resetPassword(email){
   check(await client.auth.resetPasswordForEmail(email));
  },
  async updatePassword(password){
   remember=true;
   check(await client.auth.updateUser({password}));
  },
  async signOut(){
   await client.auth.signOut({scope:'local'});
   account=null;
  }
 };
}
