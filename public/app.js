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
function renderSummary(rows){
  const counts={Legendary:0,Standard:0,Welcome:0};
  rows.forEach(s=>counts[s.tier.tier]++);
  $('#summary').innerHTML=`<div class="card">Stores<b>${rows.length}</b></div><div class="card">Legendary<b>${counts.Legendary}</b></div><div class="card">Standard<b>${counts.Standard}</b></div><div class="card">Welcome<b>${counts.Welcome}</b></div>`;
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
    (!tier || s.tier.tier===tier)
  );
  renderSummary(rows);
  $('#rows').innerHTML=rows.map(s=>`<tr data-id="${esc(s.storeId)}"><td><strong>${esc(s.name)}${s.tier.isNew?'*':''}</strong><div class="fine">${esc(s.address)}${s.distanceMiles!=null?` · ${s.distanceMiles.toFixed(1)} mi`:''}${s.metrics.events===0?' · No recorded events':''}</div></td><td class="tier ${s.tier.tier}">${s.tier.tier}${s.tier.isNew?'*':''}</td><td>${s.metrics.events}</td><td>${s.metrics.uniquePlayers}</td><td>${s.metrics.tickets}</td><td>${esc(s.tier.path)}</td></tr>`).join('')||'<tr><td colspan="6">No matching stores.</td></tr>';
  document.querySelectorAll('tbody tr[data-id]').forEach(tr=>tr.onclick=()=>show(stores.find(s=>String(s.storeId)===tr.dataset.id)));
}
function show(s){
  const target=s.tier.nextTier==='Standard'?s.tier.standardTarget:s.tier.legendaryTarget;
  const metric=(label,v,t)=>`<div class="metric"><div class="metric-line"><span>${label}</span><strong>${v} / ${t}</strong></div><div class="meter"><span style="width:${pct(v,t)}%"></span></div></div>`;
  $('#details').classList.remove('hidden');
  const activity=s.firstActivity?new Date(s.firstActivity).toLocaleDateString():'No recorded events';
  $('#details').innerHTML=`<h2>${esc(s.name)}${s.tier.isNew?'*':''}</h2><p><strong>Estimated tier: <span class="${s.tier.tier}">${s.tier.tier}</span></strong></p><p>${s.tier.nextTier?`To reach <strong>${s.tier.nextTier}</strong>: ${esc(s.tier.path)}`:'Meets the published Legendary maintenance thresholds.'}</p>${target?metric('Events',s.metrics.events,target.events)+metric('Unique players',s.metrics.uniquePlayers,target.uniquePlayers)+metric('Event tickets',s.metrics.tickets,target.tickets):''}<p class="fine">Distance from Clearwater: ${s.distanceMiles!=null?`${s.distanceMiles.toFixed(1)} miles`:'Unavailable'} · First recorded Play Hub activity: ${activity}${s.tier.isNew?` · Estimated first-year proration ${(s.tier.prorationFactor*100).toFixed(0)}%`:''}</p><p class="fine">Registration fetch failures: ${s.dataQuality.registrationFailures}. Prerelease eligibility exactness: ${s.dataQuality.prereleaseEligibilityKnown?'known':'not yet known'}.</p>`;
  $('#details').scrollIntoView({behavior:'smooth',block:'nearest'});
}

$('#search').oninput=render;
$('#tier').onchange=render;
radius.oninput=render;
$('#includeZero').onchange=render;
render();
$('#footer').textContent=`Data generated ${new Date(data.generatedAt).toLocaleString()}. * Less than one year of recorded Play Hub activity; prorated thresholds are estimates, not official Ravensburger determinations.`;
