// Fixed, unprorated thresholds apply to every store regardless of age.
// The metrics are gathered over the configured rolling activity window.
export function prereleaseSatisfied(metrics) {
  if (metrics.eligiblePrereleases == null) return null;
  return metrics.prereleasesRun >= metrics.eligiblePrereleases;
}

export function meets(metrics, target, requirePrerelease = true) {
  const prereleaseOk = prereleaseSatisfied(metrics);
  return (
    metrics.events >= target.events &&
    metrics.uniquePlayers >= target.uniquePlayers &&
    metrics.tickets >= target.tickets &&
    (!requirePrerelease || prereleaseOk !== false)
  );
}

export function deficits(metrics, target) {
  return {
    events: Math.max(0, target.events - metrics.events),
    uniquePlayers: Math.max(0, target.uniquePlayers - metrics.uniquePlayers),
    tickets: Math.max(0, target.tickets - metrics.tickets),
    prereleases: metrics.eligiblePrereleases == null
      ? null
      : Math.max(0, metrics.eligiblePrereleases - metrics.prereleasesRun)
  };
}

export function possiblePath(deficit) {
  if (!deficit.events && !deficit.uniquePlayers && !deficit.tickets && !deficit.prereleases) {
    return "Requirements met.";
  }

  const parts = [];
  if (deficit.events > 0) {
    if (deficit.tickets > 0) {
      const avg = Math.ceil(deficit.tickets / deficit.events);
      parts.push(`${deficit.events} more event${deficit.events === 1 ? "" : "s"} averaging at least ${avg} ticket${avg === 1 ? "" : "s"}`);
    } else {
      parts.push(`${deficit.events} more event${deficit.events === 1 ? "" : "s"}`);
    }
  } else if (deficit.tickets > 0) {
    parts.push(`${deficit.tickets} more event ticket${deficit.tickets === 1 ? "" : "s"}`);
  }

  if (deficit.uniquePlayers > 0) {
    parts.push(`${deficit.uniquePlayers} additional unique player${deficit.uniquePlayers === 1 ? "" : "s"}`);
  }
  if (deficit.prereleases > 0) {
    parts.push(`${deficit.prereleases} required prerelease event${deficit.prereleases === 1 ? "" : "s"}`);
  }
  return parts.join(" plus ") + ".";
}

export function evaluateTier(metrics, firstActivity, asOf, config) {
  const standardTarget = { ...config.thresholds.standard };
  const legendaryTarget = { ...config.thresholds.legendary };

  let tier = "Welcome";
  if (meets(metrics, legendaryTarget, config.prerelease.required)) tier = "Legendary";
  else if (meets(metrics, standardTarget, config.prerelease.required)) tier = "Standard";

  const nextTier = tier === "Welcome" ? "Standard" : tier === "Standard" ? "Legendary" : null;
  const nextTarget = nextTier === "Standard" ? standardTarget : nextTier === "Legendary" ? legendaryTarget : null;
  const nextDeficits = nextTarget ? deficits(metrics, nextTarget) : null;

  return {
    tier,
    standardTarget,
    legendaryTarget,
    nextTier,
    nextDeficits,
    path: nextDeficits ? possiblePath(nextDeficits) : "Highest tier reached."
  };
}
