import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createPolylineNavigator,
  LOCKED_STREET_LIMIT_UNITS,
  LOCKED_STREET_TRAVEL_METERS,
  MAP_METERS_PER_UNIT,
  offsetFromStreetDrag,
} from '../../assets/map-pan.mjs';
import { LOCATION_SCENE_LAYOUT as map } from '../../assets/location-scene-layout.mjs';

const root = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const hasPoint = (path, point) => path.some(([x, z]) => x === point[0] && z === point[1]);
const distanceToPath = ([x, z], path) => Math.min(...path.slice(1).map(([bx, bz], index) => {
  const [ax, az] = path[index];
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}));

test('3D map keeps the approved bridge-over-circle orientation and restores landmark placements', () => {
  const html = read('index.html');
  const scene = read('assets/location-scene.js');
  const serviceWorker = read('sw.js');
  const styles = read('styles.css');

  assert.match(html, /data-location-lat="29\.6745805" data-location-lon="52\.4546395"/);
  assert.match(html, /maps\.app\.goo\.gl\/HoLtoDqxUWRN86bd7/);
  assert.match(html, /location-scene\.js\?v=20261015-ehsan-junction-v27/);
  assert.match(html, /data-map-action="toggle-lock" aria-pressed="true"/);
  assert.match(html, /data-map-directions-open aria-haspopup="dialog"/);
  assert.match(html, /data-map-directions-google/);
  assert.match(html, /data-map-directions-snapp/);
  assert.match(html, /data-map-copy-destination/);
  assert.match(html, /assets\/map-directions\.js\?v=20261015-mg-directions-v27/);
  assert.match(scene, /const ehsanRoundaboutSite = \{ x: LOCATION_SCENE_LAYOUT\.ehsanRoundabout\[0\], z: LOCATION_SCENE_LAYOUT\.ehsanRoundabout\[1\] \}/);
  assert.match(scene, /const ehsanOverpassCenterline = LOCATION_SCENE_LAYOUT\.ehsanOverpass/);
  assert.match(scene, /roundaboutRadiusX = LOCATION_SCENE_LAYOUT\.ehsanRoundaboutRadius/);
  assert.match(scene, /roundaboutRadiusZ = LOCATION_SCENE_LAYOUT\.ehsanRoundaboutRadius/);
  assert.match(scene, /bridgeDeckWidth = 2 \* \(carriagewayOffset \+ 0\.36\)/);
  assert.match(scene, /outerSide = routeIndex === 0 \? -1 : 1/);
  assert.match(scene, /roundaboutDistance < roundaboutRadiusX \+ 1/);
  assert.match(scene, /Restore the approved Ehsan flyover across the roundabout/);
  assert.match(scene, /name: "Maali Abad Blvd"/);
  assert.match(scene, /name: "Baharan St"/);
  assert.match(scene, /name: "Alley behind MG"/);
  assert.match(scene, /addBox\(0, -0\.34, 0, 18\.2, 0\.42, 24\.4, materials\.slab\)/);
  assert.match(scene, /addBuildingBillboard\(club,\s*\{/);
  assert.match(scene, /addBuildingBillboard\(vipBakery,\s*\{/);
  assert.match(scene, /let angleLocked = true/);
  assert.match(scene, /LOCKED_STREET_LIMIT_UNITS/);
  assert.match(serviceWorker, /mg-fitclub-v20261016-doll-detail-v28/);
  assert.match(serviceWorker, /location-scene\.js\?v=20261015-ehsan-junction-v27/);
  assert.match(serviceWorker, /assets\/map-directions\.js\?v=20261015-mg-directions-v27/);
  assert.match(serviceWorker, /\.\/assets\/location-scene-layout\.mjs/);
  assert.doesNotMatch(serviceWorker, /location-geo\.mjs|location-road-data\.mjs/);
  assert.match(styles, /\.location \{/);

  assert.deepEqual(map.ehsanRoundabout, [-1.18, 8.05]);
  assert.equal(map.ehsanRoundaboutRadius, 1.8);
  assert.ok(distanceToPath(map.ehsanRoundabout, map.ehsanOverpass) < 0.2, 'bridge passes over the roundabout center');
  const [circleX, circleZ] = map.ehsanRoundabout;
  const [maaliExitX, maaliExitZ] = map.maaliAbad[0];
  assert.ok(Math.abs(Math.hypot(maaliExitX - circleX, maaliExitZ - circleZ) - map.ehsanRoundaboutRadius) < 0.01, 'Maali Abad branches from the expanded circle edge');
  assert.ok(Math.abs(Math.atan2(maaliExitZ - circleZ, maaliExitX - circleX) + Math.PI / 6) < 0.01, 'Maali Abad uses the marked 30-degree exit');
  assert.match(scene, /name: "Maali Abad Blvd", points: maaliAbadRoute, width: 1\.12, material: materials\.sideRoad, dashed: false, divided: true/);
});

test('annotated Maali Abad and Baharan access connects through local streets to the MG rear alley', () => {
  const maaliBaharanJunction = [5.35, 5.5];
  const baharanFiftiethJunction = [5.5, -5.8];
  const fiftiethFiftyFourOneJunction = [3.6, -5.18];
  const clubRearJunction = [3.4, -0.75];
  const eighthBaharanJunction = [3.1, 4.6];

  assert.ok(hasPoint(map.maaliAbad, maaliBaharanJunction));
  assert.ok(hasPoint(map.baharan, maaliBaharanJunction));
  assert.ok(hasPoint(map.baharan8, maaliBaharanJunction));
  assert.ok(hasPoint(map.baharan, baharanFiftiethJunction));
  assert.ok(hasPoint(map.rajaei50, baharanFiftiethJunction));
  assert.ok(hasPoint(map.rajaei50, fiftiethFiftyFourOneJunction));
  assert.ok(hasPoint(map.rajaei541, fiftiethFiftyFourOneJunction));
  assert.ok(hasPoint(map.rajaei541, clubRearJunction));
  assert.ok(hasPoint(map.clubAlley, clubRearJunction));
  assert.ok(hasPoint(map.baharan8, eighthBaharanJunction));
  assert.ok(hasPoint(map.rajaei541, eighthBaharanJunction));
  assert.ok(hasPoint(map.baharan9, [3.3, 2.0]));
  assert.ok(hasPoint(map.rajaei541, [3.3, 2.0]));
  assert.ok(hasPoint(map.baharan7, [3.35, -0.3]));
  assert.ok(hasPoint(map.rajaei541, [3.35, -0.3]));
  assert.ok(hasPoint(map.baharan5, [3.55, -2.7]));
  assert.ok(hasPoint(map.rajaei541, [3.55, -2.7]));
});

test('locked street panning follows the reference axis and allows 400m each way', () => {
  assert.equal(LOCKED_STREET_TRAVEL_METERS, 800);
  assert.equal(MAP_METERS_PER_UNIT, 12);
  assert.equal(LOCKED_STREET_LIMIT_UNITS, 400 / 12);
  assert.equal(offsetFromStreetDrag({
    currentOffsetUnits: 0,
    deltaX: 12,
    deltaY: 40,
    axisScreenX: 1,
    axisScreenY: 0,
    pixelsPerWorldUnit: 6,
  }), -2);
  assert.equal(offsetFromStreetDrag({
    currentOffsetUnits: 0,
    deltaX: 0,
    deltaY: 24,
    axisScreenX: 1,
    axisScreenY: 0,
    pixelsPerWorldUnit: 6,
  }), 0);
  assert.equal(offsetFromStreetDrag({
    currentOffsetUnits: 16,
    deltaX: -1000,
    deltaY: 0,
    axisScreenX: 1,
    axisScreenY: 0,
    pixelsPerWorldUnit: 1,
  }), LOCKED_STREET_LIMIT_UNITS);
});

test('street navigator follows curved road segments without drifting off its route', () => {
  const route = createPolylineNavigator([[0, 0], [0, 3], [4, 3]]);

  assert.equal(route.length, 7);
  assert.equal(route.closestStation([2, 5]), 5);
  assert.deepEqual(route.at(4), { point: [1, 3], tangent: [1, 0], station: 4 });
  assert.deepEqual(route.at(100).point, [4, 3]);
  assert.throws(() => createPolylineNavigator([[1, 1], [1, 1]]), /duplicate points/);
});
