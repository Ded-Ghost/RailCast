/**
 * Harvest real station coordinates from erail's TRAINROUTE data by walking a
 * set of long-distance trains chosen to cover every major Indian corridor.
 * Emits server/src/data/stationCoords.js and src/data/stations.ts.
 */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const { fetchTrainSchedule } = require(path.join(__dirname, '..', 'src', 'services', 'erailClient.js'));

// Long trains give the widest station coverage per request. Grouped by corridor.
const TRAINS = [
  // Delhi–Howrah (via Allahabad / Grand Chord)
  '12303', '12381', '12312', '13007',
  // Delhi–Howrah (via Patna)
  '12309', '12393', '12351', '13005',
  // Delhi–Mumbai (Western + Central)
  '12951', '12925', '12137', '12471', '19019',
  // Delhi–Chennai
  '12621', '12615', '12723', '12269',
  // Mumbai–Chennai
  '11041', '12163', '16352',
  // Howrah–Chennai (East Coast)
  '12841', '12839', '12703',
  // Delhi–Ahmedabad
  '12957', '12915', '19105',
  // Bangalore–Chennai / South
  '12609', '12657', '16021', '12295',
  // Ultra-long runs — maximum unique-station yield
  '16317', '15905', '12521', '16687', '12507', '19578', '16327', '22629',
  // Konkan / West coast
  '10103', '12133',
  // Punjab / North-West / Katra
  '12716', '12237', '12413',
  // North-East
  '15645', '12505', '15629',
  // Central / East
  '12801', '18047', '12833', '13351', '12545', '17321',
  // Supplementary pass: terminals and branches the first list missed
  '12259', '22691', '12461', '12457', '12963', '12477', '12785', '11029', '12279',
  '11123', '12987', '12369', '18183', '12883', '19269', '12475', '12495', '12181',
  '11077', '12489', '19325', '12403', '15017', '12565', '13287', '18101', '12809',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Prefer the more descriptive/plausible of two names for the same code. */
function betterName(a, b) {
  if (!a) return b;
  if (!b) return a;
  return b.length > a.length ? b : a;
}

(async () => {
  const byCode = new Map();
  try { for (const s of JSON.parse(fs.readFileSync(path.join(__dirname,'stations.harvested.json'),'utf8'))) byCode.set(s.code, s); } catch {}
  let okCount = 0;

  for (const trainNumber of TRAINS) {
    const result = await fetchTrainSchedule(trainNumber);
    if (!result.ok) {
      console.error(`  ! ${trainNumber}: ${result.error}`);
      await sleep(250);
      continue;
    }
    okCount++;
    let added = 0;
    for (const stop of result.data.stops) {
      if (!stop.position) continue;
      const existing = byCode.get(stop.stationCode);
      if (existing) {
        existing.name = betterName(existing.name, stop.stationName);
        if (!existing.zone && stop.zone) existing.zone = stop.zone;
        continue;
      }
      byCode.set(stop.stationCode, {
        code: stop.stationCode,
        name: stop.stationName,
        lat: Number(stop.position.lat.toFixed(6)),
        lng: Number(stop.position.lng.toFixed(6)),
        zone: stop.zone || null,
      });
      added++;
    }
    console.error(`  ${trainNumber}: ${result.data.stops.length} stops, +${added} new (total ${byCode.size})`);
    await sleep(250);
  }

  const stations = Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
  console.error(`\nHarvested ${stations.length} unique stations from ${okCount}/${TRAINS.length} trains.`);

  fs.writeFileSync(
    path.join(__dirname, 'stations.harvested.json'),
    JSON.stringify(stations, null, 2),
    'utf8',
  );
  console.error('Wrote stations.harvested.json');
})();
