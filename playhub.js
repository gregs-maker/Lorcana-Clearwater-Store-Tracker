import * as api from "unofficial-ravensburger-playhub-api";

function resultsOf(response) {
  if (Array.isArray(response)) return response;
  return response?.results ?? [];
}

function countOf(response) {
  return response?.count ?? response?.total ?? resultsOf(response).length;
}

export async function geocode(query) {
  const result = await api.geocodeAddress(query);
  const addr = result?.address ?? result;
  if (!addr || addr.lat == null || addr.lng == null) {
    throw new Error(`Could not geocode ${query}`);
  }
  return { lat: Number(addr.lat), lng: Number(addr.lng), formattedAddress: addr.formattedAddress ?? query };
}

export async function fetchNearbyStores(lat, lng, radiusMiles) {
  const all = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const response = await api.fetchStores({
      latitude: String(lat),
      longitude: String(lng),
      num_miles: String(radiusMiles),
      page: String(page),
      page_size: String(pageSize)
    });
    const rows = resultsOf(response);
    all.push(...rows);
    if (rows.length < pageSize || all.length >= countOf(response)) break;
    page += 1;
  }
  return all;
}

export async function fetchStoreEvents(storeId, startDate, endDate) {
  const all = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const params = {
      game_slug: "disney-lorcana",
      latitude: "0",
      longitude: "0",
      num_miles: "12500",
      display_statuses: api.expandStatusesForApi(["all"]),
      store: String(storeId),
      page: String(page),
      page_size: String(pageSize),
      start_date_after: new Date(`${startDate}T00:00:00Z`).toISOString()
    };
    if (endDate) params.start_date_before = new Date(`${endDate}T23:59:59Z`).toISOString();
    const response = await api.fetchEvents(params);
    const rows = resultsOf(response);
    all.push(...rows);
    if (rows.length < pageSize || all.length >= countOf(response)) break;
    page += 1;
  }
  return all;
}

export async function fetchRegistrations(eventId) {
  const all = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const response = await api.fetchEventRegistrations(Number(eventId), page, pageSize);
    const rows = resultsOf(response);
    all.push(...rows);
    if (rows.length < pageSize || all.length >= countOf(response)) break;
    page += 1;
  }
  return all;
}
