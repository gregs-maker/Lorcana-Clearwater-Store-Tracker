import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTier, deficits, possiblePath } from '../src/tier.js';
const config={proration:{fullYearDays:365,rounding:'ceil'},thresholds:{standard:{events:25,uniquePlayers:25,tickets:250},legendary:{events:50,uniquePlayers:50,tickets:500}},prerelease:{required:true}};

test('full-year Standard classification',()=>{const r=evaluateTier({events:30,uniquePlayers:30,tickets:300,eligiblePrereleases:null,prereleasesRun:0},'2025-01-01',new Date('2026-08-18'),config);assert.equal(r.tier,'Standard');});
test('six-month thresholds are approximately half',()=>{const r=evaluateTier({events:13,uniquePlayers:13,tickets:125,eligiblePrereleases:null,prereleasesRun:0},'2026-02-18',new Date('2026-08-18'),config);assert.equal(r.isNew,true);assert.ok(r.standardTarget.events>=12&&r.standardTarget.events<=13);assert.ok(r.standardTarget.tickets>=124&&r.standardTarget.tickets<=125);});
test('all numeric requirements are required',()=>{const r=evaluateTier({events:55,uniquePlayers:55,tickets:490,eligiblePrereleases:null,prereleasesRun:0},'2024-01-01',new Date('2026-08-18'),config);assert.equal(r.tier,'Standard');assert.equal(r.nextDeficits.tickets,10);});
test('path combines event and ticket deficits',()=>{const d=deficits({events:21,uniquePlayers:34,tickets:231,eligiblePrereleases:null,prereleasesRun:0},{events:25,uniquePlayers:25,tickets:250});assert.equal(possiblePath(d),'4 more events averaging at least 5 tickets.');});
