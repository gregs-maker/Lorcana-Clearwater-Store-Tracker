# Lorcana Tier Tracker v1.0.1

> v1.0.1 fixes the Play Hub store-search response mapping: search results are GameStore wrappers, and event queries require the nested numeric `store.id`.

# Lorcana Store Tier Tracker — Version 1

A local web dashboard that estimates Ravensburger Play Hub store tiers for stores within **30 miles of Clearwater, Florida**.

## What Version 1 does

- Finds Play Hub stores within a 30-mile radius of Clearwater.
- Pulls each store's event history and event registrations through the community `unofficial-ravensburger-playhub-api` package.
- Counts, for the current metric window:
  - total reported events
  - unique players
  - total event tickets / player registrations
- Estimates **Welcome / Standard / Legendary** using these published maintenance thresholds:
  - Standard: 25 events, 25 unique players, 250 tickets
  - Legendary: 50 events, 50 unique players, 500 tickets
- Calculates the deficits to the next tier and provides a plain-English possible path.
- Marks stores with less than one year of recorded Play Hub activity with `*` and estimates prorated targets.
- Does **not** publish player names.

## Important Version 1 assumptions

1. **Four set seasons:** until exact season boundaries are configured, the tracker uses the most recent 365 days as a proxy.
2. **First-year proration:** this version assumes thresholds scale by `active days / 365`, rounded up. Ravensburger's exact prorated table/formula has not been supplied, so the dashboard clearly labels this as an estimate.
3. **Prerelease requirement:** the collector detects prerelease events, but Version 1 does not fail a store for prerelease participation until we have exact set-season eligibility data. This avoids falsely downgrading stores.
4. **Unique players:** stable opaque user IDs are preferred when present. If an API response lacks one, the collector falls back to normalized display/name data. That can occasionally miscount two people with the same name or one person who changes display name.

## Windows setup

1. Install a current version of **Node.js** from nodejs.org if it is not already installed.
2. Extract this project folder somewhere convenient.
3. Open **Command Prompt** in the project folder.
4. Install the one dependency:

```bat
npm install
```

5. Pull the current Play Hub data:

```bat
npm run sync
```

6. Start the dashboard:

```bat
npm start
```

7. Open this address in Firefox/Edge/Chrome:

```text
http://localhost:4173
```

Whenever you want fresh numbers, stop the server with `Ctrl+C`, run `npm run sync`, then `npm start` again.

## Testing the tier calculator

```bat
npm test
```

The tests do not access Play Hub; they verify the tier/proration/deficit math.

## Configuration

Edit `config.json` to change the radius, location, metric window, thresholds, or proration method. The project intentionally keeps these business rules separate from API collection so they can be updated when Ravensburger clarifies the official rules.

## Files

- `src/playhub.js` — wrapper around the unofficial Play Hub API package
- `src/sync.js` — data collection and aggregation
- `src/tier.js` — tier/proration/next-tier calculation
- `src/server.js` — tiny local web server
- `public/` — dashboard UI
- `data/stores.json` — generated aggregate data (no published player names)
- `config.json` — Version 1 rules and geographic scope

## Data-use note

This is an unofficial community project. The API package and Play Hub endpoints are not an official public Ravensburger developer API and may change. Cache/use collected data responsibly, avoid aggressive repeated refreshes, and review applicable Play Hub/Carde terms before public deployment.


## Custom search radius

The default radius comes from `config.json` (30 miles). You can override it for any sync:

```bat
npm run sync -- --radius 20
```

Or double-click `sync-custom-radius.bat` and enter the radius when prompted.

Stores with no recorded Play Hub events are excluded from the saved dataset and dashboard.
