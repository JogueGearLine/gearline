const GearLineMusic = (() => {
 if(location.hostname.endsWith('.trycloudflare.com')||location.hostname.endsWith('.github.io')||['gearline.app.br','www.gearline.app.br'].includes(location.hostname)){
  for(const panel of document.querySelectorAll('.music-player'))panel.classList.add('hidden');
  return {start(){},stop(){}};
 }
 const tracks = [
  "The Weeknd - Blinding Lights.mp4",
  "Night Lovell - Polozhenie.mp4",
  "Roddy Ricch - The Box [Official Music Video].mp4",
  "Stay With Me 1nonly (JDM Drift).mp4",
  "Tokyo Drift - Six Days (4K).mp4",
  "Гио Пика - буйно голова (Legendado PT-BR).mp4"
];
 const folder = "-Sounds/Músicas";
 const audio = new Audio();
 audio.preload = 'none';
 audio.volume = 0.25;

 const players = [...document.querySelectorAll('.music-player')].map(panel => ({
  panel,
  play: panel.querySelector('[data-play]'),
  next: panel.querySelector('[data-next]'),
  volume: panel.querySelector('[data-volume]'),
  track: panel.querySelector('[data-track]')
 }));
 let index = 0;
 let playing = false;
 let unavailable = false;
 let active = false;
 let playbackAttempt = 0;

 function render(){
  const title = tracks[index].replace(/\.[^.]+$/, '');
  for(const {play,next,volume,track} of players){
   play.textContent = playing ? 'Pausar' : 'Ouvir';
   next.disabled = tracks.length < 2;
   volume.value = Math.round(audio.volume * 100);
   track.textContent = unavailable ? title + ' — não foi possível tocar' : title;
  }
 }

 function source(){
  audio.src = folder.split('/').map(encodeURIComponent).join('/') + '/' + encodeURIComponent(tracks[index]);
  unavailable = false;
 }

 function play(){
  if(!audio.getAttribute('src') || unavailable)source();
  playing = true;
  render();
  const attempt = ++playbackAttempt;
  audio.play().catch(error => {
   if(attempt !== playbackAttempt)return;
   if(error.name === 'AbortError')return;
   playing = false;
   unavailable = error.name !== 'NotAllowedError';
   render();
  });
 }

 function next(){
  index = (index + 1) % tracks.length;
  source();
  if(playing)play();
  else render();
 }

 audio.addEventListener('ended', next);
 audio.addEventListener('volumechange',render);
 for(const {panel,play:button,next:skip,volume} of players){
  button.addEventListener('click', () => {
   if(!playing){play();return}
   playing = false;
   playbackAttempt++;
   audio.pause();
   render();
  });
  skip.addEventListener('click', next);
  volume.addEventListener('input', () => {audio.volume = Number(volume.value) / 100});
  panel.addEventListener('toggle', () => {
   if(panel.open)for(const player of players)if(player.panel !== panel)player.panel.open = false;
  });
 }
 render();
 const header = document.getElementById('musicHeader');
 return {
  start(){
   if(active)return;
   active = true;
   header.classList.remove('hidden');
  },
  stop(){
   if(!active)return;
   active = false;
   playbackAttempt++;
   audio.pause();
   playing = false;
   unavailable = false;
   index = 0;
   audio.removeAttribute('src');
   audio.load();
   header.classList.add('hidden');
   for(const {panel} of players)panel.open = false;
   render();
  }
 };
})();
