const $ = s => document.querySelector(s);
let data;
try {
  data = await fetch('./data/stores.json').then(r => { if(!r.ok) throw new Error(); return r.json(); });
} catch {
  $('#rows').innerHTML='<tr><td colspan="6">No synchronized data yet.</td></tr>';
  throw new Error('No data');
}

const stores = data.stores || [];
const maxRadius = Math.min(40, Number(data.maxDisplayRadiusMiles || data.radiusMiles || 40));
const defaultRadius = Math.min(maxRadius, Number(data.defaultDisplayRadiusMiles || 15));
const radius = $('#radius');
radius.max = String(maxRadius);
radius.value = String(defaultRadius);

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function pct(v,t){return t?Math.min(100,Math.round(v/t*100)):100;}
function selectedRadius(){return Number(radius.value);}
function updateScope(){
  const r=selectedRadius();
  $('#radiusValue').textContent=`${r} miles`;
  $('#scope').textContent=`${data.center?.formattedAddress || 'Clearwater, Florida'} · within ${r} miles`;
}
function inRadius(store,r){
  // If distance could not be resolved during sync, keep it available only at the max setting.
  return store.distanceMiles == null ? r >= maxRadius : store.distanceMiles <= r + 0.05;
}
function displayTier(store){
  return store.metrics.events === 0 ? 'Inactive' : store.tier.tier;
}
function renderSummary(rows){
  const counts={Legendary:0,Standard:0,Welcome:0,Inactive:0};
  rows.forEach(s=>counts[displayTier(s)]++);
  $('#summary').innerHTML=`<div class="card">Stores<b>${rows.length}</b></div><div class="card">Legendary<b>${counts.Legendary}</b></div><div class="card">Standard<b>${counts.Standard}</b></div><div class="card">Welcome<b>${counts.Welcome}</b></div><div class="card">Inactive<b>${counts.Inactive}</b></div>`;
}
function render(){
  updateScope();
  const q=$('#search').value.toLowerCase();
  const tier=$('#tier').value;
  const r=selectedRadius();
  const includeZero=$('#includeZero').checked;
  const rows=stores.filter(s=>
    inRadius(s,r) &&
    (includeZero || s.metrics.events > 0) &&
    (!q || s.name.toLowerCase().includes(q)) &&
    (!tier || displayTier(s)===tier)
  );
  renderSummary(rows);
  $('#rows').innerHTML=rows.map(s=>{const shownTier=displayTier(s);return `<tr data-id="${esc(s.storeId)}"><td><strong>${esc(s.name)}${s.tier.isNew?'*':''}</strong><div class="fine">${esc(s.address)}${s.distanceMiles!=null?` · ${s.distanceMiles.toFixed(1)} mi`:''}${s.metrics.events===0?' · No recorded events in the past year':''}</div></td><td class="tier ${shownTier}">${shownTier}${s.tier.isNew?'*':''}</td><td>${s.metrics.events}</td><td>${s.metrics.uniquePlayers}</td><td>${s.metrics.tickets}</td><td>${s.metrics.events===0?'No recorded activity in the past year':esc(s.tier.path)}</td></tr>`}).join('')||'<tr><td colspan="6">No matching stores.</td></tr>';
  document.querySelectorAll('tbody tr[data-id]').forEach(tr=>tr.onclick=()=>show(stores.find(s=>String(s.storeId)===tr.dataset.id)));
}
function show(s){
  const shownTier=displayTier(s);
  const target=s.tier.nextTier==='Standard'?s.tier.standardTarget:s.tier.legendaryTarget;
  const metric=(label,v,t)=>`<div class="metric"><div class="metric-line"><span>${label}</span><strong>${v} / ${t}</strong></div><div class="meter"><span style="width:${pct(v,t)}%"></span></div></div>`;
  $('#details').classList.remove('hidden');
  const activity=s.firstActivity?new Date(s.firstActivity).toLocaleDateString():'No recorded events';
  const inactive=s.metrics.events===0;
  const statusText=inactive
    ? 'No recorded Play Hub events in the past year.'
    : (s.tier.nextTier?`To reach <strong>${s.tier.nextTier}</strong>: ${esc(s.tier.path)}`:'Meets the published Legendary maintenance thresholds.');
  const metricsHtml=inactive?'':(target?metric('Events',s.metrics.events,target.events)+metric('Unique players',s.metrics.uniquePlayers,target.uniquePlayers)+metric('Event tickets',s.metrics.tickets,target.tickets):'');
  $('#details').innerHTML=`<h2>${esc(s.name)}${s.tier.isNew?'*':''}</h2><p><strong>Estimated tier: <span class="${shownTier}">${shownTier}</span></strong></p><p>${statusText}</p>${metricsHtml}<p class="fine">Distance from Clearwater: ${s.distanceMiles!=null?`${s.distanceMiles.toFixed(1)} miles`:'Unavailable'} · First recorded Play Hub activity: ${activity}${s.tier.isNew?` · Estimated first-year proration ${(s.tier.prorationFactor*100).toFixed(0)}%`:''}</p><p class="fine">Registration fetch failures: ${s.dataQuality.registrationFailures}. Prerelease eligibility exactness: ${s.dataQuality.prereleaseEligibilityKnown?'known':'not yet known'}.</p>`;
  $('#details').scrollIntoView({behavior:'smooth',block:'nearest'});
}


const DISCORD_REPORT_RADIUS = 15;
const SITE_URL = 'https://gregs-maker.github.io/Lorcana-Clearwater-Store-Tracker/';

function remainingFor(store,target){
  return {
    events: Math.max(0, target.events - store.metrics.events),
    uniquePlayers: Math.max(0, target.uniquePlayers - store.metrics.uniquePlayers),
    tickets: Math.max(0, target.tickets - store.metrics.tickets)
  };
}
function discordCurrentStats(store){
  if(store.tier.tier==='Legendary'){
    const t=store.tier.legendaryTarget;
    return `${store.metrics.events}/${t.events} events · ${store.metrics.uniquePlayers}/${t.uniquePlayers} unique · ${store.metrics.tickets}/${t.tickets} tickets`;
  }
  if(store.tier.tier==='Standard'){
    const t=store.tier.standardTarget;
    return `${store.metrics.events}/${t.events} events · ${store.metrics.uniquePlayers}/${t.uniquePlayers} unique · ${store.metrics.tickets}/${t.tickets} tickets`;
  }
  return `${store.metrics.events} events · ${store.metrics.uniquePlayers} unique · ${store.metrics.tickets} tickets`;
}
function discordRemaining(store){
  if(store.tier.tier==='Legendary') return '';
  const target=store.tier.tier==='Welcome'?store.tier.standardTarget:store.tier.legendaryTarget;
  const left=remainingFor(store,target);
  const parts=[];
  if(left.events) parts.push(`${left.events} ${left.events===1?'event':'events'}`);
  if(left.uniquePlayers) parts.push(`${left.uniquePlayers} unique ${left.uniquePlayers===1?'player':'players'}`);
  if(left.tickets) parts.push(`${left.tickets} ${left.tickets===1?'ticket':'tickets'}`);
  if(!parts.length) return '';
  const destination=store.tier.tier==='Welcome'?'Standard':'next tier';
  return `↳ **To reach ${destination}:** ${parts.join(' · ')}`;
}
function discordDate(){
  return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}).format(new Date(data.generatedAt));
}
function buildDiscordReport(){
  const active=stores.filter(s=>inRadius(s,DISCORD_REPORT_RADIUS)&&s.metrics.events>0);
  const tierOrder=['Legendary','Standard','Welcome'];
  const icons={Legendary:'🟣',Standard:'🔵',Welcome:'⚪'};
  const sections=[];
  for(const tier of tierOrder){
    const group=active.filter(s=>s.tier.tier===tier);
    if(!group.length) continue;
    const lines=group.map(s=>{
      const star=s.tier.isNew?'*':'';
      const first=`**${s.name}${star}** — ${discordCurrentStats(s)}`;
      const second=discordRemaining(s);
      return second?`${first}\n${second}`:first;
    });
    sections.push(`${icons[tier]} **${tier}**\n${lines.join('\n\n')}`);
  }
  const hasNew=active.some(s=>s.tier.isNew);
  const note=hasNew?`\n\n*\\* Store has less than one year of recorded Play Hub activity; tier thresholds use estimated first-year proration.*`:'';
  return `## 📊 Pinellas Lorcana Store Activity Report
**Weekly Play Hub snapshot · Updated ${discordDate()} · 15-mile radius from Clearwater · Active stores only**

${sections.join('\n\n')}${note}

**Explore the full tracker:** ${SITE_URL}

*Unofficial community tool. Estimated tiers are based on publicly available Ravensburger Play Hub activity and may differ from Ravensburger's official tier assignments.*`;
}
async function copyDiscordReport(){
  const button=$('#copyDiscord');
  const report=buildDiscordReport();
  try{
    await navigator.clipboard.writeText(report);
    const old=button.textContent;
    button.textContent=report.length>2000?'Copied — may need 2 Discord messages':'Copied!';
    button.classList.add('copied');
    setTimeout(()=>{button.textContent=old;button.classList.remove('copied');},2600);
  }catch{
    // Fallback for browsers that block clipboard access.
    const area=document.createElement('textarea');
    area.value=report;
    area.style.position='fixed';
    area.style.opacity='0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    button.textContent='Copied!';
    button.classList.add('copied');
    setTimeout(()=>{button.textContent='Copy Discord Report';button.classList.remove('copied');},2200);
  }
}

$('#search').oninput=render;
$('#tier').onchange=render;
radius.oninput=render;
$('#includeZero').onchange=render;
$('#copyDiscord').onclick=copyDiscordReport;
render();
$('#footer').textContent=`Data generated ${new Date(data.generatedAt).toLocaleString()}. * Less than one year of recorded Play Hub activity; prorated thresholds are estimates, not official Ravensburger determinations.`;
