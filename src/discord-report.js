import fs from "node:fs/promises";
const WEBHOOK_URL=process.env.DISCORD_WEBHOOK_URL;
const SITE_URL="https://gregs-maker.github.io/Lorcana-Clearwater-Store-Tracker/";
const REPORT_RADIUS=15;
function inRadius(s){return s.distanceMiles!=null&&Number(s.distanceMiles)<=REPORT_RADIUS+0.05;}
function left(s,t){return {events:Math.max(0,t.events-s.metrics.events),uniquePlayers:Math.max(0,t.uniquePlayers-s.metrics.uniquePlayers),tickets:Math.max(0,t.tickets-s.metrics.tickets)}}
function stats(s){
  if(s.tier.tier==="Legendary"){const t=s.tier.legendaryTarget;return `${s.metrics.events}/${t.events} events · ${s.metrics.uniquePlayers}/${t.uniquePlayers} unique · ${s.metrics.tickets}/${t.tickets} tickets`;}
  if(s.tier.tier==="Standard"){const t=s.tier.standardTarget;return `${s.metrics.events}/${t.events} events · ${s.metrics.uniquePlayers}/${t.uniquePlayers} unique · ${s.metrics.tickets}/${t.tickets} tickets`;}
  return `${s.metrics.events} events · ${s.metrics.uniquePlayers} unique · ${s.metrics.tickets} tickets`;
}
function remaining(s){
  if(s.tier.tier==="Legendary") return "";
  const t=s.tier.tier==="Welcome"?s.tier.standardTarget:s.tier.legendaryTarget;
  const d=left(s,t), p=[];
  if(d.events)p.push(`${d.events} ${d.events===1?"event":"events"}`);
  if(d.uniquePlayers)p.push(`${d.uniquePlayers} unique ${d.uniquePlayers===1?"player":"players"}`);
  if(d.tickets)p.push(`${d.tickets} ${d.tickets===1?"ticket":"tickets"}`);
  if(!p.length)return "";
  return `↳ **To reach ${s.tier.tier==="Welcome"?"Standard":"Legendary"}:** ${p.join(" · ")}`;
}
function storeText(s){const a=`**${s.name}${s.tier.isNew?"*":""}** — ${stats(s)}`, b=remaining(s);return b?`${a}\n${b}`:a;}
function date(x){return new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",year:"numeric"}).format(new Date(x));}
function chunks(items,max=3400){const out=[];let cur="";for(const x of items){const n=cur?`${cur}\n\n${x}`:x;if(n.length>max&&cur){out.push(cur);cur=x}else cur=n}if(cur)out.push(cur);return out;}
async function main(){
  if(!WEBHOOK_URL){console.log("DISCORD_WEBHOOK_URL not configured; skipping.");return;}
  const data=JSON.parse(await fs.readFile("data/stores.json","utf8"));
  const stores=(data.stores||[]).filter(s=>inRadius(s)&&Number(s.metrics?.events||0)>0);
  const embeds=[{title:"📊 Pinellas Lorcana Store Activity Report",url:SITE_URL,description:`**Weekly Play Hub snapshot · Updated ${date(data.generatedAt)} · 15-mile radius from Clearwater · Active stores only**`}];
  for(const [tier,icon] of [["Legendary","🟣"],["Standard","🔵"],["Welcome","⚪"]]){
    const group=stores.filter(s=>s.tier?.tier===tier); if(!group.length) continue;
    chunks(group.map(storeText)).forEach((description,i,a)=>embeds.push({title:`${icon} ${tier}${a.length>1?` (${i+1}/${a.length})`:""}`,description}));
  }
  const star=stores.some(s=>s.tier?.isNew)?`*\\* Store has less than one year of recorded Play Hub activity; tier thresholds use estimated first-year proration.*\n\n`:"";
  embeds.push({description:`${star}**[Explore the full tracker](${SITE_URL})**\n\n*Unofficial community tool. Estimated tiers are based on publicly available Ravensburger Play Hub activity and may differ from Ravensburger's official tier assignments.*`});
  const r=await fetch(`${WEBHOOK_URL}?wait=true`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:"Pinellas Lorcana Store Tracker",allowed_mentions:{parse:[]},embeds})});
  if(!r.ok) throw new Error(`Discord webhook failed (${r.status}): ${await r.text()}`);
  console.log(`Posted report with ${stores.length} active stores.`);
}
main().catch(e=>{console.error(e);process.exit(1);});
