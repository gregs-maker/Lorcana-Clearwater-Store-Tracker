import fs from 'node:fs/promises';

const DATA_PATH = process.env.STORES_DATA_PATH || 'data/stores.json';
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SITE_URL = process.env.SITE_URL || 'https://gregs-maker.github.io/Lorcana-Clearwater-Store-Tracker/';
const REPORT_RADIUS_MILES = Number(process.env.REPORT_RADIUS_MILES || 15);

const TIER_ORDER = ['Legendary', 'Standard', 'Welcome'];

function plural(value, singular, pluralForm = `${singular}s`) {
  return value === 1 ? singular : pluralForm;
}

function remainingText(store) {
  const d = store.tier?.nextDeficits;
  if (!d) return '';

  const parts = [];
  if ((d.events || 0) > 0) {
    parts.push(`${d.events} ${plural(d.events, 'event')}`);
  }
  if ((d.uniquePlayers || 0) > 0) {
    parts.push(`${d.uniquePlayers} unique ${plural(d.uniquePlayers, 'player')}`);
  }
  if ((d.tickets || 0) > 0) {
    parts.push(`${d.tickets} ${plural(d.tickets, 'ticket')}`);
  }

  return parts.join(' · ');
}

function currentStats(store) {
  const m = store.metrics;
  const tier = store.tier?.tier;

  if (tier === 'Legendary') {
    const t = store.tier.legendaryTarget;
    return `${m.events}/${t.events} events · ${m.uniquePlayers}/${t.uniquePlayers} unique · ${m.tickets}/${t.tickets} tickets`;
  }

  if (tier === 'Standard') {
    const t = store.tier.standardTarget;
    return `${m.events}/${t.events} events · ${m.uniquePlayers}/${t.uniquePlayers} unique · ${m.tickets}/${t.tickets} tickets`;
  }

  // Welcome has no published maintenance threshold, so show raw activity.
  return `${m.events} events · ${m.uniquePlayers} unique · ${m.tickets} tickets`;
}

function storeLines(store) {
  const star = store.tier?.isNew ? '*' : '';
  const lines = [
    `**${store.name}${star}** — ${currentStats(store)}`
  ];

  if (store.tier?.tier !== 'Legendary') {
    const remaining = remainingText(store);
    const destination = store.tier?.tier === 'Welcome' ? 'Standard' : 'next tier';
    if (remaining) {
      lines.push(`↳ **To reach ${destination}:** ${remaining}`);
    }
  }

  return lines.join('\n');
}

function formatUpdatedDate(iso) {
  if (!iso) return 'Latest weekly sync';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(iso));
}

function buildReport(data) {
  const stores = (data.stores || []).filter(store =>
    Number(store.distanceMiles) <= REPORT_RADIUS_MILES &&
    Number(store.metrics?.events || 0) > 0
  );

  const sections = [];
  for (const tier of TIER_ORDER) {
    const group = stores.filter(store => store.tier?.tier === tier);
    if (!group.length) continue;

    const icon = tier === 'Legendary' ? '🟣' : tier === 'Standard' ? '🔵' : '⚪';
    sections.push(`${icon} **${tier}**\n\n${group.map(storeLines).join('\n\n')}`);
  }

  const hasNewStore = stores.some(store => store.tier?.isNew);
  const note = hasNewStore
    ? '\n\n`* Store has less than one year of recorded Play Hub activity; tier thresholds use estimated first-year proration.`'
    : '';

  const body = sections.join('\n\n') || '_No active stores were found within the report radius._';

  return {
    username: 'Pinellas Lorcana Store Tracker',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '📊 Pinellas Lorcana Store Activity Report',
      url: SITE_URL,
      description:
        `**Weekly Play Hub snapshot** · Updated ${formatUpdatedDate(data.generatedAt)} · ` +
        `${REPORT_RADIUS_MILES}-mile radius from Clearwater · Active stores only\n\n` +
        `${body}${note}\n\n` +
        `**[Explore the full tracker](${SITE_URL})**\n\n` +
        `_Unofficial community tool. Estimated tiers are based on publicly available Ravensburger Play Hub activity and may differ from Ravensburger's official tier assignments._`
    }]
  };
}

async function main() {
  if (!WEBHOOK_URL) {
    console.log('DISCORD_WEBHOOK_URL is not configured. Skipping Discord post.');
    return;
  }

  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  const payload = buildReport(data);

  const response = await fetch(`${WEBHOOK_URL}?wait=true`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} ${response.statusText} - ${text}`);
  }

  console.log(`Discord weekly report posted for ${REPORT_RADIUS_MILES} miles (${(data.stores || []).filter(s => Number(s.distanceMiles) <= REPORT_RADIUS_MILES && Number(s.metrics?.events || 0) > 0).length} active stores).`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
