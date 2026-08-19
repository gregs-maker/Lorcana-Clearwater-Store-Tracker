import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geocode, fetchNearbyStores, fetchStoreEvents, fetchRegistrations } from "./playhub.js";
import { evaluateTier } from "./tier.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const config = JSON.parse(await fs.readFile(path.join(root, "config.json"), "utf8"));
const asOf = new Date();

function getArg(name) {
  const prefix = `--${name}=`;
  const direct = process.argv.find(arg => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const radiusArg = getArg("radius");
const radiusMiles = radiusArg == null ? config.location.radiusMiles : Number(radiusArg);
if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 250) {
  throw new Error(`Invalid --radius value: ${radiusArg}. Use a number greater than 0 and no more than 250.`);
}

function isoDate(d) { return d.toISOString().slice(0, 10); }
function daysAgo(days) { const d = new Date(asOf); d.setUTCDate(d.getUTCDate() - days); return d; }
function normalize(s) { return String(s ?? "").trim().toLowerCase(); }
function isPrerelease(event) {
  const text = normalize([event.name, event.category?.name, event.event_configuration_template?.name].filter(Boolean).join(" "));
  return config.prerelease.namePatterns.some(p => text.includes(normalize(p)));
}
function eventDate(event) { return event.start_datetime ?? event.startDateTime ?? event.date ?? null; }

// fetchStores() returns a GameStore wrapper. The numeric ID used by
// event searches lives at gameStore.store.id; gameStore.id is a UUID.
function storeId(gameStore) {
  return gameStore?.store?.id ?? gameStore?.store_id ?? gameStore?.pk;
}
function storeUuid(gameStore) {
  return gameStore?.id ?? gameStore?.game_store_id ?? gameStore?.uuid ?? null;
}
function storeName(gameStore) {
  return gameStore?.store?.name ?? gameStore?.name ?? gameStore?.store_name ?? "Unnamed store";
}
function storeAddress(gameStore) {
  const store = gameStore?.store ?? gameStore ?? {};
  return store.full_address
    ?? store.address?.formattedAddress
    ?? store.address?.formatted_address
    ?? store.formatted_address
    ?? [store.address_1, store.city, store.state, store.postal_code].filter(Boolean).join(", ")
    ?? [store.city, store.state].filter(Boolean).join(", ")
    ?? "";
}

function firstNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function storeCoordinates(gameStore) {
  const store = gameStore?.store ?? gameStore ?? {};
  const address = store?.address ?? {};
  const location = store?.location ?? gameStore?.location ?? {};
  const lat = firstNumber(
    store.latitude, store.lat, address.latitude, address.lat,
    location.latitude, location.lat, gameStore?.latitude, gameStore?.lat
  );
  const lng = firstNumber(
    store.longitude, store.lng, store.lon, address.longitude, address.lng, address.lon,
    location.longitude, location.lng, location.lon,
    gameStore?.longitude, gameStore?.lng, gameStore?.lon
  );
  return lat == null || lng == null ? null : { lat, lng };
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function distanceFromCenter(gameStore, center) {
  // Some API responses include a distance directly. Use it if present.
  const store = gameStore?.store ?? {};
  const direct = firstNumber(
    gameStore?.distance_miles, gameStore?.distanceMiles,
    store?.distance_miles, store?.distanceMiles
  );
  if (direct != null && direct >= 0) return direct;

  const coords = storeCoordinates(gameStore);
  if (coords) return haversineMiles(center.lat, center.lng, coords.lat, coords.lng);

  // Last-resort fallback: geocode the store address once during the weekly sync.
  const address = storeAddress(gameStore);
  if (!address) return null;
  try {
    const point = await geocode(address);
    return haversineMiles(center.lat, center.lng, point.lat, point.lng);
  } catch {
    return null;
  }
}

function playerKey(reg) {
  // Prefer stable opaque identifiers; do not publish player names.
  const candidates = [
    reg.player?.id,
    reg.user_event_status?.user?.id,
    reg.user_event_status?.user_id,
    reg.user?.id,
    reg.user_id,
    reg.id
  ].filter(v => v != null);
  if (candidates.length) return `id:${candidates[0]}`;
  const display = reg.best_identifier
    ?? reg.user_event_status?.best_identifier
    ?? reg.player?.best_identifier
    ?? reg.user?.best_identifier
    ?? reg.user_event_status?.user?.display_name
    ?? reg.user?.display_name
    ?? reg.display_name
    ?? reg.username;
  const first = reg.first_name ?? reg.user?.first_name ?? "";
  const last = reg.last_name ?? reg.user?.last_name ?? "";
  const fallback = normalize(display || `${first} ${last}`);
  return fallback ? `name:${fallback}` : null;
}

async function registrationsWithRetry(eventId) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await fetchRegistrations(eventId); }
    catch (err) {
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, attempt * 750));
    }
  }
}

console.log(`Locating ${config.location.query}...`);
const center = await geocode(config.location.query);
console.log(`Finding stores within ${radiusMiles} miles of ${center.formattedAddress}...`);
const stores = await fetchNearbyStores(center.lat, center.lng, radiusMiles);
console.log(`Found ${stores.length} registered stores.`);

const metricStart = isoDate(daysAgo(config.metricWindow.rollingDays));
const outputStores = [];

for (let index = 0; index < stores.length; index++) {
  const store = stores[index];
  const sid = storeId(store);
  if (sid == null) continue;
  console.log(`[${index + 1}/${stores.length}] ${storeName(store)}`);

  const distanceMiles = await distanceFromCenter(store, center);
  if (distanceMiles == null) console.warn("  Distance unavailable; store will only appear at the maximum radius.");

  let events = [];
  try {
    events = await fetchStoreEvents(sid, config.historyStart, isoDate(asOf));
  } catch (err) {
    console.warn(`  Could not fetch events: ${err.message}`);
    continue;
  }

  const datedEvents = events.filter(e => eventDate(e)).sort((a,b) => new Date(eventDate(a)) - new Date(eventDate(b)));
  const firstActivity = datedEvents.length ? eventDate(datedEvents[0]) : null;
  const metricEvents = datedEvents.filter(e => new Date(eventDate(e)) >= new Date(`${metricStart}T00:00:00Z`) && new Date(eventDate(e)) <= asOf);

  let tickets = 0;
  const unique = new Set();
  let registrationFailures = 0;
  for (const event of metricEvents) {
    try {
      const registrations = await registrationsWithRetry(event.id);
      tickets += registrations.length;
      for (const reg of registrations) {
        const key = playerKey(reg);
        if (key) unique.add(key);
      }
    } catch (err) {
      registrationFailures += 1;
      console.warn(`  Registrations unavailable for event ${event.id}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  const prereleases = metricEvents.filter(isPrerelease);
  const metrics = {
    events: metricEvents.length,
    uniquePlayers: unique.size,
    tickets,
    prereleasesRun: prereleases.length,
    eligiblePrereleases: null
  };
  const evaluation = evaluateTier(metrics, firstActivity, asOf, config);

  if (datedEvents.length === 0) console.log("  Registered store with no recorded Play Hub events (kept for optional display).");

  outputStores.push({
    storeId: sid,
    gameStoreId: storeUuid(store),
    name: storeName(store),
    address: storeAddress(store),
    distanceMiles: distanceMiles == null ? null : Math.round(distanceMiles * 10) / 10,
    firstActivity,
    hasRecordedEvents: datedEvents.length > 0,
    metrics,
    tier: evaluation,
    dataQuality: {
      registrationFailures,
      prereleaseEligibilityKnown: false
    }
  });
}

const rank = { Legendary: 3, Standard: 2, Welcome: 1 };
outputStores.sort((a,b) => (rank[b.tier.tier] - rank[a.tier.tier]) || (b.metrics.tickets - a.metrics.tickets));

const payload = {
  generatedAt: asOf.toISOString(),
  center,
  radiusMiles,
  defaultDisplayRadiusMiles: 15,
  maxDisplayRadiusMiles: 40,
  metricStart,
  metricEnd: isoDate(asOf),
  methodology: {
    metricWindow: config.metricWindow,
    proration: config.proration,
    prereleaseNote: "Prerelease participation is shown but not used as a failing requirement until exact eligible-set data is configured.",
    playerIdentityNote: "Stable opaque IDs are preferred. Display-name fallback may slightly over/under-count unique players if API IDs are unavailable. Player names are not published."
  },
  stores: outputStores
};

await fs.writeFile(path.join(root, "data", "stores.json"), JSON.stringify(payload, null, 2));
console.log(`Saved ${outputStores.length} registered stores to data/stores.json`);
