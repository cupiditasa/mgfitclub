import { clamp, createPolylineNavigator, LOCKED_STREET_LIMIT_UNITS, MAP_METERS_PER_UNIT, offsetFromStreetDrag } from "./map-pan.mjs";
import { LOCATION_SCENE_LAYOUT } from "./location-scene-layout.mjs";

const MAP = document.querySelector("[data-location-map]");

if (MAP) {
  const viewport = MAP.querySelector(".map__viewport");
  const canvas = MAP.querySelector(".map__canvas");
  const toolbar = MAP.querySelector("[data-map-toolbar]");
  const status = MAP.querySelector("[data-map-status]");
  let started = false;

  const showFallback = (message) => {
    MAP.classList.add("is-fallback");
    if (status) {
      status.textContent = message;
      status.hidden = false;
    }
  };

  const start = async () => {
    if (started) return;
    started = true;

    try {
      const THREE = await import("./vendor/three/three.module.js");
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#111711");
      scene.fog = new THREE.Fog("#111711", 34, 58);

      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        antialias: window.innerWidth > 680,
        powerPreference: "low-power",
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.13;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.45));

      scene.add(new THREE.HemisphereLight(0xf6f5e9, 0x75806f, 1.8));
      const keyLight = new THREE.DirectionalLight(0xfff0cf, 1.9);
      keyLight.position.set(-9, 17, 11);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xb7d4e8, 1.15);
      fillLight.position.set(11, 9, -12);
      scene.add(fillLight);

      // Keep the north-up map convention (east on screen-right) in the oblique view.
      const mapWorld = new THREE.Group();
      mapWorld.scale.x = -1;
      scene.add(mapWorld);

      const sharedBox = new THREE.BoxGeometry(1, 1, 1);
      const materials = {
        slab: new THREE.MeshStandardMaterial({ color: 0x29352d, roughness: 0.9 }),
        ground: new THREE.MeshStandardMaterial({ color: 0xd8ddd3, roughness: 1 }),
        curb: new THREE.MeshBasicMaterial({ color: 0xb3bdb4 }),
        sidewalk: new THREE.MeshStandardMaterial({ color: 0xa7afa8, roughness: 0.94 }),
        road: new THREE.MeshStandardMaterial({ color: 0x687782, roughness: 0.88 }),
        sideRoad: new THREE.MeshStandardMaterial({ color: 0x89949a, roughness: 0.9 }),
        line: new THREE.MeshBasicMaterial({ color: 0xe8e4d2 }),
        median: new THREE.MeshStandardMaterial({ color: 0x78945f, roughness: 0.96 }),
        medianPlant: new THREE.MeshStandardMaterial({ color: 0x3f6948, roughness: 0.94 }),
        bridge: new THREE.MeshStandardMaterial({ color: 0xc8c9bf, roughness: 0.82 }),
        bridgeRail: new THREE.MeshStandardMaterial({ color: 0x495752, metalness: 0.22, roughness: 0.68 }),
        bridgeGlow: new THREE.MeshStandardMaterial({ color: 0xd6ae59, emissive: 0x744c12, emissiveIntensity: 0.5, roughness: 0.62 }),
        lime: new THREE.MeshStandardMaterial({ color: 0xc6ff3f, roughness: 0.55 }),
        park: new THREE.MeshStandardMaterial({ color: 0x8fab72, roughness: 0.95 }),
        tree: new THREE.MeshStandardMaterial({ color: 0x497354, roughness: 0.92 }),
        treeLight: new THREE.MeshStandardMaterial({ color: 0x71935d, roughness: 0.92 }),
        lamp: new THREE.MeshStandardMaterial({ color: 0xe8ddb6, emissive: 0x76652d, emissiveIntensity: 0.42, roughness: 0.48 }),
        carGlass: new THREE.MeshStandardMaterial({ color: 0x789393, roughness: 0.3, metalness: 0.2 }),
        window: new THREE.MeshStandardMaterial({ color: 0x8ba2a2, roughness: 0.4, metalness: 0.14 }),
        darkWindow: new THREE.MeshStandardMaterial({ color: 0x31413e, roughness: 0.42, metalness: 0.12 }),
      };
      const addBox = (x, y, z, sx, sy, sz, material, parent = mapWorld) => {
        const mesh = new THREE.Mesh(sharedBox, material);
        mesh.position.set(x, y, z);
        mesh.scale.set(sx, sy, sz);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        parent.add(mesh);
        return mesh;
      };

      // Preserve the approved local orientation and model scale. The map screenshot
      // defines the route topology; the club remains the anchor for this diorama.
      const clubSite = {
        latitude: Number(MAP.dataset.locationLat),
        longitude: Number(MAP.dataset.locationLon),
        x: 1.9,
        z: -0.75,
      };
      const CLUB_TO_BRIDGE_SOUTH_METERS = 20;
      const ehsanRoundaboutSite = { x: LOCATION_SCENE_LAYOUT.ehsanRoundabout[0], z: LOCATION_SCENE_LAYOUT.ehsanRoundabout[1] };
      const pedestrianBridgeSite = {
        x: 0.08,
        z: clubSite.z - CLUB_TO_BRIDGE_SOUTH_METERS / MAP_METERS_PER_UNIT,
      };
      const vipBakerySite = {
        x: clubSite.x + (pedestrianBridgeSite.x - clubSite.x) * 0.65,
        z: clubSite.z + (pedestrianBridgeSite.z - clubSite.z) * 0.65,
      };
      const petrolStationSite = { x: -2.5, z: 5.1 };
      const ehsanSportsSite = { x: -6.8, z: 6.4 };
      const neginSite = { x: -3.75, z: 10.8 };
      if (!Number.isFinite(clubSite.latitude) || !Number.isFinite(clubSite.longitude)) {
        throw new Error("MG location pin coordinates are missing.");
      }
      addBox(0, -0.34, 0, 18.2, 0.42, 24.4, materials.slab);
      addBox(0, -0.105, 0, 17.85, 0.08, 24.05, materials.ground);

      const addRoad = (points, width, material, dashed = false, baseY = 0, surfaceYOffset = 0, includeCurb = true) => {
        const roadPoints = points.filter((point, index) => index === 0
          || Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1]) > 0.001);
        const segments = [];
        const elevationAt = (pointIndex) => Array.isArray(baseY) ? (baseY[pointIndex] ?? 0) : baseY;
        for (let index = 0; index < roadPoints.length - 1; index += 1) {
          const a = roadPoints[index];
          const b = roadPoints[index + 1];
          const dx = b[0] - a[0];
          const dz = b[1] - a[1];
          const length = Math.hypot(dx, dz) || 1;
          const nx = -dz / length;
          const nz = dx / length;
          const baseYA = elevationAt(index);
          const baseYB = elevationAt(index + 1);
          segments.push({ a, b, dx, dz, length, nx, nz, baseYA, baseYB });
        }
        const makeStrip = (halfWidth, y, mat) => {
          const positions = [];
          const indices = [];
          const sections = roadPoints.map((point, index) => {
            const previous = roadPoints[Math.max(0, index - 1)];
            const next = roadPoints[Math.min(roadPoints.length - 1, index + 1)];
            const previousLength = Math.hypot(point[0] - previous[0], point[1] - previous[1]) || 1;
            const nextLength = Math.hypot(next[0] - point[0], next[1] - point[1]) || 1;
            const previousNormal = [-(point[1] - previous[1]) / previousLength, (point[0] - previous[0]) / previousLength];
            const nextNormal = [-(next[1] - point[1]) / nextLength, (next[0] - point[0]) / nextLength];
            let miter = index === 0 ? nextNormal : index === roadPoints.length - 1 ? previousNormal : [previousNormal[0] + nextNormal[0], previousNormal[1] + nextNormal[1]];
            const miterLength = Math.hypot(miter[0], miter[1]);
            miter = miterLength > 0.001 ? [miter[0] / miterLength, miter[1] / miterLength] : nextNormal;
            const projection = Math.abs(miter[0] * nextNormal[0] + miter[1] * nextNormal[1]);
            const scale = index === 0 || index === roadPoints.length - 1 ? 1 : Math.min(2.2, 1 / Math.max(0.46, projection));
            const offsetX = miter[0] * halfWidth * scale;
            const offsetZ = miter[1] * halfWidth * scale;
            const elevation = elevationAt(index);
            positions.push(point[0] + offsetX, y + elevation, point[1] + offsetZ);
            positions.push(point[0] - offsetX, y + elevation, point[1] - offsetZ);
            return positions.length / 3 - 2;
          });
          for (let index = 0; index < sections.length - 1; index += 1) {
            const start = sections[index];
            const end = sections[index + 1];
            indices.push(start, end, end + 1, start, end + 1, start + 1);
          }
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          const mesh = new THREE.Mesh(geometry, mat);
          mesh.position.y = 0.008;
          mesh.rotation.x = 0;
          mapWorld.add(mesh);
        };
        if (roadPoints.length < 2) return;
        if (includeCurb) makeStrip(width / 2 + 0.1, 0, materials.curb);
        makeStrip(width / 2, 0.012 + surfaceYOffset, material);
        if (dashed) {
          for (const { a, dx, dz, length, baseYA, baseYB } of segments) {
            const count = Math.floor(length / 0.74);
            for (let n = 1; n < count; n += 2) {
              const t = n / count;
              const angle = Math.atan2(dx, dz);
              const mark = new THREE.Mesh(
                new THREE.BoxGeometry(0.045, 0.018, Math.min(0.34, length / count * 0.62)),
                materials.line,
              );
              mark.position.set(a[0] + dx * t, 0.036 + baseYA + (baseYB - baseYA) * t, a[1] + dz * t);
              mark.rotation.y = angle;
              mapWorld.add(mark);
            }
          }
        }
      };
      const addSlopedLinearBar = (a, b, width, height, centerYA, centerYB, material, parent = mapWorld) => {
        const direction = new THREE.Vector3(b[0] - a[0], centerYB - centerYA, b[1] - a[1]);
        const length = direction.length() || 1;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
        bar.position.set((a[0] + b[0]) / 2, (centerYA + centerYB) / 2, (a[1] + b[1]) / 2);
        bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize());
        parent.add(bar);
        return bar;
      };

      const MEDIAN_WIDTH_METERS = 3.5;
      const medianWidth = MEDIAN_WIDTH_METERS / MAP_METERS_PER_UNIT;
      const carriagewayWidth = 0.53;
      const carriagewayOffset = medianWidth / 2 + carriagewayWidth / 2;
      const offsetPath = (points, offset) => points.map((point, index) => {
        const previous = points[Math.max(0, index - 1)];
        const next = points[Math.min(points.length - 1, index + 1)];
        const dx = next[0] - previous[0];
        const dz = next[1] - previous[1];
        const length = Math.hypot(dx, dz) || 1;
        return [point[0] - dz / length * offset, point[1] + dx / length * offset];
      });
      const samplePath = (points, spacing) => {
        const samples = [];
        let carry = 0;
        for (let index = 0; index < points.length - 1; index += 1) {
          const a = points[index];
          const b = points[index + 1];
          const dx = b[0] - a[0];
          const dz = b[1] - a[1];
          const length = Math.hypot(dx, dz) || 1;
          for (let distance = spacing - carry; distance < length; distance += spacing) {
            const t = distance / length;
            samples.push([a[0] + dx * t, a[1] + dz * t]);
          }
          carry = (carry + length) % spacing;
        }
        return samples;
      };
      const elevationOnPath = (points, elevations, station) => {
        let traveled = 0;
        for (let index = 0; index < points.length - 1; index += 1) {
          const length = Math.hypot(points[index + 1][0] - points[index][0], points[index + 1][1] - points[index][1]);
          if (station <= traveled + length || index === points.length - 2) {
            const progress = Math.max(0, Math.min(1, (station - traveled) / (length || 1)));
            return elevations[index] + (elevations[index + 1] - elevations[index]) * progress;
          }
          traveled += length;
        }
        return elevations.at(-1) ?? 0;
      };
      const addLandscapedMedian = (points, baseY = 0, skipRoundabout = false) => {
        addRoad(points, medianWidth, materials.median, false, baseY);
        const plantGeometry = new THREE.SphereGeometry(0.075, 6, 5);
        const plants = new THREE.InstancedMesh(plantGeometry, materials.medianPlant, 48);
        const plant = new THREE.Object3D();
        let count = 0;
        for (const [x, z] of samplePath(points, 0.72)) {
          if (skipRoundabout && Math.hypot(x - ehsanRoundaboutSite.x, z - ehsanRoundaboutSite.z) < 3.95) continue;
          plant.position.set(x, 0.12 + baseY, z);
          plant.scale.set(1.2, 0.72, 0.82);
          plant.updateMatrix();
          plants.setMatrixAt(count++, plant.matrix);
        }
        plants.count = count;
        plants.instanceMatrix.needsUpdate = true;
        mapWorld.add(plants);
      };
      const addDividedRoad = (points, baseY = 0, landscaped = true, laneWidth = carriagewayWidth, roadMedianWidth = medianWidth) => {
        const roadOffset = roadMedianWidth / 2 + laneWidth / 2;
        addRoad(offsetPath(points, -roadOffset), laneWidth, materials.road, true, baseY);
        addRoad(offsetPath(points, roadOffset), laneWidth, materials.road, true, baseY);
        if (landscaped) addLandscapedMedian(points, baseY, true);
        else addRoad(points, roadMedianWidth, materials.bridge, false, baseY);
      };

      const roundaboutRadiusX = LOCATION_SCENE_LAYOUT.ehsanRoundaboutRadius;
      const roundaboutRadiusZ = LOCATION_SCENE_LAYOUT.ehsanRoundaboutRadius;
      const rajaiApproach = LOCATION_SCENE_LAYOUT.rajaeiBoulevard;
      const maaliAbadRoute = LOCATION_SCENE_LAYOUT.maaliAbad;
      const baharanRoute = LOCATION_SCENE_LAYOUT.baharan;
      const baharan8Route = LOCATION_SCENE_LAYOUT.baharan8;
      const baharan9Route = LOCATION_SCENE_LAYOUT.baharan9;
      const baharan7Route = LOCATION_SCENE_LAYOUT.baharan7;
      const baharan5Route = LOCATION_SCENE_LAYOUT.baharan5;
      const rajaei54Route = LOCATION_SCENE_LAYOUT.rajaei541;
      const rajaei544Route = [[4.4, -5.45], [4.15, -4.55], [3.9, -3.9]];
      const rajaei543Route = [[5.48, -1.5], [4.75, -1.85], [4.1, -2.35], [3.55, -2.7]];
      const rajaei542Route = [[5.48, 1.2], [4.75, 0.8], [4.0, 0.1], [3.35, -0.3]];
      const rajaei541Route = rajaei54Route;
      const rajaei52Route = LOCATION_SCENE_LAYOUT.baharan7;
      const rajaei50Route = LOCATION_SCENE_LAYOUT.rajaei50;
      const parastarBoulevardRoute = LOCATION_SCENE_LAYOUT.parastar;
      const neginAccessRoute = LOCATION_SCENE_LAYOUT.neginAccess;
      const ehsanOverpassCenterline = LOCATION_SCENE_LAYOUT.ehsanOverpass;
      const ehsanOverpassRoutes = [
        offsetPath(ehsanOverpassCenterline, -carriagewayOffset),
        offsetPath(ehsanOverpassCenterline, carriagewayOffset),
      ];
      const maaliAbadSite = { x: 2.75, z: 6.35 };
      const streetTravelRoute = rajaiApproach.slice().reverse();
      const neighborhoodRoads = [
        // Keep the bridge crossing the ground-level Ehsan circle, as in the
        // approved layout. Only the Maali Abad / Baharan access is extended.
        { name: "Ehsan Overpass westbound", points: ehsanOverpassRoutes[0], width: 0.64, material: materials.road, dashed: true, elevated: true },
        { name: "Ehsan Overpass eastbound", points: ehsanOverpassRoutes[1], width: 0.64, material: materials.road, dashed: true, elevated: true },
        { name: "Rajai Blvd", points: rajaiApproach, width: 1.35, material: materials.road, dashed: true, divided: true },
        { name: "Maali Abad Blvd", points: maaliAbadRoute, width: 1.12, material: materials.sideRoad, dashed: false, divided: true, laneWidth: 0.48, medianWidth: 0.16 },
        { name: "Parastar Blvd", points: parastarBoulevardRoute, width: 0.82, material: materials.road, dashed: true },
        { name: "Negin Mall Access", points: neginAccessRoute, width: 0.58, material: materials.sideRoad, dashed: false },
        { name: "Jazayeri St", points: LOCATION_SCENE_LAYOUT.jazayeri, width: 0.55, material: materials.sideRoad, dashed: false },
        // The marked orange route: Maali Abad turns onto Baharan, then 50th
        // Rajaei and 54/1 return to the alley on MG's rear side.
        { name: "Baharan St", points: baharanRoute, width: 0.55, material: materials.sideRoad, dashed: false },
        { name: "8 Baharan", points: baharan8Route, width: 0.38, material: materials.sideRoad, dashed: false },
        { name: "9 Baharan", points: baharan9Route, width: 0.38, material: materials.sideRoad, dashed: false },
        { name: "7 Baharan", points: baharan7Route, width: 0.4, material: materials.sideRoad, dashed: false },
        { name: "5 Baharan", points: baharan5Route, width: 0.38, material: materials.sideRoad, dashed: false },
        { name: "54 Rajaei", points: rajaei54Route, width: 0.46, material: materials.sideRoad, dashed: false },
        { name: "54/4 Rajaei", points: rajaei544Route, width: 0.34, material: materials.sideRoad, dashed: false },
        { name: "54/3 Rajaei", points: rajaei543Route, width: 0.34, material: materials.sideRoad, dashed: false },
        { name: "54/2 Rajaei", points: rajaei542Route, width: 0.34, material: materials.sideRoad, dashed: false },
        { name: "Alley behind MG", points: LOCATION_SCENE_LAYOUT.clubAlley, width: 0.36, material: materials.sideRoad, dashed: false },
        { name: "50 Rajaei", points: rajaei50Route, width: 0.44, material: materials.sideRoad, dashed: false },
        { name: "First Rahmati St", points: LOCATION_SCENE_LAYOUT.firstRahmati, width: 0.46, material: materials.sideRoad, dashed: false },
      ];
      for (const road of neighborhoodRoads) {
        if (road.elevated) continue;
        if (road.divided) addDividedRoad(road.points, road.elevated ? 0.62 : 0, !road.elevated, road.laneWidth ?? carriagewayWidth, road.medianWidth ?? medianWidth);
        else addRoad(road.points, road.width, road.material, road.dashed);
      }

      // Raised paving strips separate the divided boulevard from adjacent blocks.
      const rajaiRoute = neighborhoodRoads.find((road) => road.name === "Rajai Blvd").points;
      const sidewalkOffset = medianWidth / 2 + carriagewayWidth + 0.095;
      for (const side of [-1, 1]) {
        addRoad(offsetPath(rajaiRoute, side * sidewalkOffset), 0.19, materials.sidewalk);
      }
      for (const roadName of ["Maali Abad Blvd", "Baharan St", "8 Baharan", "9 Baharan", "7 Baharan", "5 Baharan", "54 Rajaei", "54/4 Rajaei", "54/3 Rajaei", "54/2 Rajaei", "Alley behind MG", "50 Rajaei"]) {
        const road = neighborhoodRoads.find((item) => item.name === roadName);
        if (!road) continue;
        const pathOffset = road.divided
          ? (road.medianWidth ?? medianWidth) / 2 + (road.laneWidth ?? carriagewayWidth) + 0.08
          : road.width / 2 + 0.08;
        for (const side of [-1, 1]) addRoad(offsetPath(road.points, side * pathOffset), 0.12, materials.sidewalk);
      }

      const distanceToPath = (x, z, points) => {
        let nearest = Infinity;
        for (let index = 0; index < points.length - 1; index += 1) {
          const [ax, az] = points[index];
          const [bx, bz] = points[index + 1];
          const dx = bx - ax;
          const dz = bz - az;
          const lengthSquared = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared));
          nearest = Math.min(nearest, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
        }
        return nearest;
      };

      const palette = [0xe6e4db, 0xd8d8cf, 0xcbd3cd, 0xd8cfbf, 0xc5d0cc];
      const roofPalette = [0xc4c9bf, 0xb5c0b8, 0xd3cbbd, 0xb1bfbd];
      let seed = 3407;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const blockPalette = palette.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.92 }));
      const roofMaterials = roofPalette.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.96 }));
      const buildings = [];
      const xs = [-7.25, -6.25, -4.25, -3.1, -1.8, 2.95, 4.05, 6.55, 7.55];
      const zs = [-8.5, -6.4, -4.25, -2.2, 2.0, 4.1, 6.5, 8.6, 10.8];
      for (const z of zs) {
        for (const x of xs) {
          const roadClearance = neighborhoodRoads.some((road) => distanceToPath(x, z, road.points) < road.width / 2 + 0.52);
          const clubDistance = Math.hypot(x - clubSite.x, z - clubSite.z);
          const petrolDistance = Math.hypot(x - petrolStationSite.x, z - petrolStationSite.z);
          const sportsDistance = Math.hypot(x - ehsanSportsSite.x, z - ehsanSportsSite.z);
          const bakeryDistance = Math.hypot(x - vipBakerySite.x, z - vipBakerySite.z);
          const neginDistance = Math.hypot(x - neginSite.x, z - neginSite.z);
          const roundaboutDistance = Math.hypot(x - ehsanRoundaboutSite.x, z - ehsanRoundaboutSite.z);
          const overpassClearance = ehsanOverpassRoutes.some((route) => distanceToPath(x, z, route) < 2.25);
          if (roadClearance || overpassClearance || roundaboutDistance < roundaboutRadiusX + 1 || clubDistance < 2.2 || petrolDistance < 1.8 || sportsDistance < 1.9 || bakeryDistance < 1.7 || neginDistance < 2.1) continue;
          if (random() < 0.2) continue;
          const width = 0.84 + random() * 0.56;
          const depth = 0.82 + random() * 0.62;
          const height = 0.48 + random() * 1.25;
          const group = new THREE.Group();
          group.position.set(x + (random() - 0.5) * 0.24, 0, z + (random() - 0.5) * 0.24);
          const body = new THREE.Mesh(sharedBox, blockPalette[Math.floor(random() * blockPalette.length)]);
          body.position.y = height / 2;
          body.scale.set(width, height, depth);
          group.add(body);
          const roof = new THREE.Mesh(sharedBox, roofMaterials[Math.floor(random() * roofMaterials.length)]);
          roof.position.y = height + 0.035;
          roof.scale.set(width + 0.05, 0.07, depth + 0.05);
          group.add(roof);
          mapWorld.add(group);
          buildings.push(group);
        }
      }

      // A small shared instanced window set gives the city depth without hundreds of draw calls.
      const windowGeometry = new THREE.BoxGeometry(0.19, 0.15, 0.025);
      const windows = new THREE.InstancedMesh(windowGeometry, materials.window, buildings.length * 12);
      const instance = new THREE.Object3D();
      let windowIndex = 0;
      for (const group of buildings) {
        const body = group.children[0];
        const height = body.scale.y;
        const width = body.scale.x;
        const depth = body.scale.z;
        const floors = Math.max(1, Math.min(3, Math.floor(height / 0.4)));
        for (let floor = 0; floor < floors; floor += 1) {
          const y = (height / floors) * floor + height / floors * 0.48;
          for (const side of [-1, 1]) {
            instance.position.set(group.position.x + (random() - 0.5) * width * 0.42, y, group.position.z + side * (depth / 2 + 0.014));
            instance.rotation.set(0, 0, 0);
            instance.scale.set(1, 1, 1);
            instance.updateMatrix();
            windows.setMatrixAt(windowIndex++, instance.matrix);
            instance.position.set(group.position.x + side * (width / 2 + 0.014), y, group.position.z + (random() - 0.5) * depth * 0.42);
            instance.rotation.set(0, Math.PI / 2, 0);
            instance.updateMatrix();
            windows.setMatrixAt(windowIndex++, instance.matrix);
          }
        }
      }
      windows.count = windowIndex;
      windows.instanceMatrix.needsUpdate = true;
      mapWorld.add(windows);

      // Street lamps and a few small vehicles add scale while staying lightweight.
      const lampPoleGeometry = new THREE.CylinderGeometry(0.022, 0.032, 0.88, 6);
      const lampHeadGeometry = new THREE.BoxGeometry(0.16, 0.045, 0.075);
      const boulevardLampSamples = samplePath(rajaiRoute, 2.35);
      for (const side of [-1, 1]) {
        const poles = new THREE.InstancedMesh(lampPoleGeometry, materials.bridgeRail, boulevardLampSamples.length);
        const heads = new THREE.InstancedMesh(lampHeadGeometry, materials.lamp, boulevardLampSamples.length);
        const lampTransform = new THREE.Object3D();
        boulevardLampSamples.forEach(([x, z], index) => {
          const position = offsetPath([[x, z], [x, z + 0.1]], side * sidewalkOffset)[0];
          lampTransform.rotation.set(0, 0, 0);
          lampTransform.position.set(position[0], 0.48, position[1]);
          lampTransform.updateMatrix();
          poles.setMatrixAt(index, lampTransform.matrix);
          lampTransform.position.set(position[0] + side * 0.075, 0.91, position[1]);
          lampTransform.rotation.set(0, 0, side * -0.12);
          lampTransform.updateMatrix();
          heads.setMatrixAt(index, lampTransform.matrix);
        });
        poles.instanceMatrix.needsUpdate = true;
        heads.instanceMatrix.needsUpdate = true;
        mapWorld.add(poles, heads);
      }
      const addCar = (x, z, color, rotation = 0) => {
        const car = new THREE.Group();
        car.position.set(x, 0.045, z);
        car.rotation.y = rotation;
        mapWorld.add(car);
        const body = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.08 });
        const chassis = new THREE.Mesh(sharedBox, body);
        chassis.position.y = 0.12;
        chassis.scale.set(0.19, 0.15, 0.39);
        car.add(chassis);
        const cabin = new THREE.Mesh(sharedBox, materials.carGlass);
        cabin.position.set(0, 0.225, -0.015);
        cabin.scale.set(0.145, 0.095, 0.19);
        car.add(cabin);
        const wheelGeometry = new THREE.CylinderGeometry(0.047, 0.047, 0.035, 8);
        for (const wheelX of [-0.103, 0.103]) {
          for (const wheelZ of [-0.12, 0.12]) {
            const wheel = new THREE.Mesh(wheelGeometry, materials.bridgeRail);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(wheelX, 0.07, wheelZ);
            car.add(wheel);
          }
        }
      };
      addCar(-carriagewayOffset, -5.6, 0x627c83, Math.PI);
      addCar(carriagewayOffset, -0.85, 0xc7b79b);
      addCar(-carriagewayOffset, 3.0, 0x8d72a9, Math.PI);

      // Approximate the oval ground-level Ehsan junction from the satellite footprint.
      const roundaboutRoad = new THREE.Mesh(
        new THREE.RingGeometry(0.67, 1, 72),
        materials.road,
      );
      roundaboutRoad.rotation.x = -Math.PI / 2;
      roundaboutRoad.position.set(ehsanRoundaboutSite.x, 0.026, ehsanRoundaboutSite.z);
      roundaboutRoad.scale.set(roundaboutRadiusX, roundaboutRadiusZ, 1);
      mapWorld.add(roundaboutRoad);
      const roundaboutIsland = new THREE.Mesh(
        new THREE.CircleGeometry(1, 48),
        materials.park,
      );
      roundaboutIsland.rotation.x = -Math.PI / 2;
      roundaboutIsland.position.set(ehsanRoundaboutSite.x, 0.035, ehsanRoundaboutSite.z);
      roundaboutIsland.scale.set(roundaboutRadiusX * 0.65, roundaboutRadiusZ * 0.65, 1);
      mapWorld.add(roundaboutIsland);
      const roundaboutCurb = new THREE.Mesh(
        new THREE.RingGeometry(1, 1.045, 72),
        materials.curb,
      );
      roundaboutCurb.rotation.x = -Math.PI / 2;
      roundaboutCurb.position.set(ehsanRoundaboutSite.x, 0.05, ehsanRoundaboutSite.z);
      roundaboutCurb.scale.set(roundaboutRadiusX, roundaboutRadiusZ, 1);
      mapWorld.add(roundaboutCurb);
      const roundaboutLaneMark = new THREE.MeshBasicMaterial({ color: 0xe8e4d2 });
      const roundaboutDashGeometry = new THREE.BoxGeometry(0.22, 0.014, 0.045);
      for (let mark = 0; mark < 40; mark += 1) {
        const angle = (mark / 40) * Math.PI * 2;
        const laneX = roundaboutRadiusX * 0.835;
        const laneZ = roundaboutRadiusZ * 0.835;
        const dash = new THREE.Mesh(roundaboutDashGeometry, roundaboutLaneMark);
        dash.position.set(
          ehsanRoundaboutSite.x + Math.cos(angle) * laneX,
          0.046,
          ehsanRoundaboutSite.z + Math.sin(angle) * laneZ,
        );
        dash.rotation.y = Math.atan2(-laneX * Math.sin(angle), laneZ * Math.cos(angle));
        mapWorld.add(dash);
      }
      const islandTreeGeometry = new THREE.ConeGeometry(0.14, 0.42, 7);
      const islandTreePoints = [[0, 0], [-0.62, 0.32], [0.62, -0.32], [-0.62, -0.32], [0.62, 0.32], [0.12, 0.82], [-0.12, -0.82]];
      for (const [dx, dz] of islandTreePoints) {
        const islandTree = new THREE.Mesh(islandTreeGeometry, materials.tree);
        islandTree.position.set(ehsanRoundaboutSite.x + dx, 0.25, ehsanRoundaboutSite.z + dz);
        mapWorld.add(islandTree);
      }

      // Restore the approved Ehsan flyover across the roundabout; the map's
      // right-hand Maali Abad exit remains a separate ground-level branch.
      const bridgeElevationProfile = (points) => {
        const segmentLengths = points.slice(1).map((point, index) => Math.hypot(
          point[0] - points[index][0], point[1] - points[index][1],
        ));
        const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0) || 1;
        let traveled = 0;
        return points.map((_, index) => {
          const elevation = 0.42 * Math.sin(Math.PI * traveled / totalLength);
          traveled += segmentLengths[index] ?? 0;
          return elevation;
        });
      };
      const bridgeCenterElevations = bridgeElevationProfile(ehsanOverpassCenterline);
      const bridgeDeckWidth = 2 * (carriagewayOffset + 0.36);
      const bridgeLaneWidth = 0.52;
      addRoad(ehsanOverpassCenterline, bridgeDeckWidth, materials.bridge, false, bridgeCenterElevations, -0.01);
      for (const [routeIndex, route] of ehsanOverpassRoutes.entries()) {
        const elevations = bridgeElevationProfile(route);
        addRoad(route, bridgeLaneWidth, materials.road, true, elevations, 0, false);
        const outerSide = routeIndex === 0 ? -1 : 1;
        const edge = offsetPath(route, outerSide * (0.72 / 2 - 0.04));
        for (let index = 0; index < edge.length - 1; index += 1) {
          addSlopedLinearBar(
            edge[index], edge[index + 1], 0.045, 0.085,
            elevations[index] + 0.11,
            elevations[index + 1] + 0.11,
            materials.bridgeRail,
          );
        }
      }
      const overpassNavigator = createPolylineNavigator(ehsanOverpassCenterline);
      for (const [x, z] of samplePath(ehsanOverpassCenterline, 3.2)) {
        if (Math.hypot(x - ehsanRoundaboutSite.x, z - ehsanRoundaboutSite.z) < roundaboutRadiusX + 0.3) continue;
        const station = overpassNavigator.closestStation([x, z]);
        const roadElevation = elevationOnPath(ehsanOverpassCenterline, bridgeCenterElevations, station);
        const supportHeight = Math.max(0.08, roadElevation - 0.06);
        if (supportHeight <= 0.12) continue;
        addBox(x, supportHeight / 2, z, 0.18, supportHeight, 0.2, materials.bridge);
      }

      // The pedestrian bridge is placed 20m south of the club pin along the street axis.
      const footbridge = new THREE.Group();
      footbridge.position.set(pedestrianBridgeSite.x, 0, pedestrianBridgeSite.z);
      mapWorld.add(footbridge);
      for (const laneCenter of [-carriagewayOffset, carriagewayOffset]) {
        for (const stripeOffset of [-0.18, -0.06, 0.06, 0.18]) {
          addBox(
            pedestrianBridgeSite.x + laneCenter + stripeOffset,
            0.038,
            pedestrianBridgeSite.z,
            0.075,
            0.018,
            0.12,
            materials.line,
          );
        }
      }
      addBox(0.38, 0.78, 0, 3.3, 0.12, 0.34, materials.bridge, footbridge);
      addBox(0.38, 0.99, -0.15, 3.3, 0.08, 0.07, materials.bridgeRail, footbridge);
      addBox(0.38, 0.99, 0.15, 3.3, 0.08, 0.07, materials.bridgeRail, footbridge);
      for (const x of [-0.42, 1.18]) {
        addBox(x, 0.35, 0, 0.12, 0.7, 0.12, materials.bridge, footbridge);
      }
      for (const side of [-1, 1]) {
        const stair = addBox(side * 2.1, 0.37, 0, 0.92, 0.1, 0.29, materials.bridge, footbridge);
        stair.rotation.z = side * -0.2;
        for (let step = 0; step < 6; step += 1) {
          addBox(side * (1.2 + step * 0.18), 0.15 + step * 0.08, 0, 0.19, 0.07, 0.32, materials.bridge, footbridge);
        }
        for (const railZ of [-0.22, 0.22]) {
          const handrail = addBox(side * 1.78, 0.49, railZ, 1.28, 0.045, 0.045, materials.bridgeRail, footbridge);
          handrail.rotation.z = side * 0.34;
        }
      }
      // Marked crossings sit just beyond the bridge deck on both carriageways.
      for (const side of [-1, 1]) {
        for (const zOffset of [-0.78, 0.78]) {
          for (let stripe = -2; stripe <= 2; stripe += 1) {
            addBox(
              pedestrianBridgeSite.x + side * carriagewayOffset,
              0.044,
              pedestrianBridgeSite.z + zOffset + stripe * 0.13,
              0.43,
              0.016,
              0.065,
              materials.line,
            );
          }
        }
      }

      // Nearby reference buildings from the supplied pin: the petrol station
      // north-west of the club and Ehsan sports complex farther west.
      const petrolStation = new THREE.Group();
      petrolStation.position.set(petrolStationSite.x, 0, petrolStationSite.z);
      mapWorld.add(petrolStation);
      const stationPad = new THREE.MeshStandardMaterial({ color: 0xaaa2bb, roughness: 0.88 });
      const stationCanopy = new THREE.MeshStandardMaterial({ color: 0xd8c8e7, roughness: 0.62 });
      const stationAccent = new THREE.MeshStandardMaterial({ color: 0x8d72a9, roughness: 0.56 });
      addBox(0, 0.035, 0, 2.15, 0.07, 1.62, stationPad, petrolStation);
      addBox(0, 0.79, -0.05, 1.72, 0.16, 1.22, stationCanopy, petrolStation);
      for (const x of [-0.62, 0.62]) {
        for (const z of [-0.48, 0.38]) addBox(x, 0.41, z, 0.065, 0.76, 0.065, materials.bridgeRail, petrolStation);
      }
      for (const x of [-0.4, 0.4]) {
        addBox(x, 0.25, 0, 0.18, 0.36, 0.2, materials.bridge, petrolStation);
        addBox(x, 0.31, 0.106, 0.11, 0.1, 0.025, stationAccent, petrolStation);
        addBox(x - 0.11, 0.3, -0.12, 0.055, 0.18, 0.035, stationAccent, petrolStation);
        const hose = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.012, 5, 10, Math.PI), materials.bridgeRail);
        hose.rotation.set(Math.PI / 2, 0, Math.PI / 2);
        hose.position.set(x + 0.1, 0.24, 0.12);
        petrolStation.add(hose);
      }
      addBox(-0.82, 0.28, -0.53, 0.52, 0.42, 0.5, materials.bridge, petrolStation);
      addBox(-0.82, 0.51, -0.53, 0.58, 0.08, 0.56, stationAccent, petrolStation);
      addBox(0.88, 0.76, 0.72, 0.8, 0.58, 0.28, materials.bridge, petrolStation);
      addBox(0.88, 0.92, 0.57, 0.66, 0.17, 0.045, stationAccent, petrolStation);

      const sportsComplex = new THREE.Group();
      sportsComplex.position.set(ehsanSportsSite.x, 0, ehsanSportsSite.z);
      mapWorld.add(sportsComplex);
      addBox(0, 0.035, 0, 2.15, 0.07, 1.75, materials.park, sportsComplex);
      addBox(0, 0.4, 0, 1.72, 0.68, 1.28, materials.darkWindow, sportsComplex);
      addBox(0, 0.77, 0, 1.84, 0.09, 1.4, materials.slab, sportsComplex);
      for (const x of [-0.52, 0, 0.52]) addBox(x, 0.4, 0.655, 0.24, 0.31, 0.025, materials.window, sportsComplex);

      // VIP pastry shop between the club and the pedestrian crossing.
      const vipBakery = new THREE.Group();
      vipBakery.position.set(vipBakerySite.x, 0, vipBakerySite.z);
      vipBakery.rotation.y = -Math.PI / 2;
      mapWorld.add(vipBakery);
      const bakeryBody = new THREE.MeshStandardMaterial({ color: 0xd5c5b8, roughness: 0.78 });
      const bakeryAwning = new THREE.MeshStandardMaterial({ color: 0xc3a3d7, roughness: 0.58 });
      const bakeryWindow = new THREE.MeshStandardMaterial({ color: 0x9fb7b8, roughness: 0.28, metalness: 0.16, emissive: 0x172522 });
      addBox(0, 0.03, 0, 0.82, 0.06, 0.68, stationPad, vipBakery);
      addBox(0, 0.39, 0, 0.7, 0.72, 0.56, bakeryBody, vipBakery);
      addBox(0, 0.77, 0.3, 0.76, 0.1, 0.08, bakeryAwning, vipBakery);
      addBox(-0.17, 0.4, 0.291, 0.26, 0.31, 0.035, bakeryWindow, vipBakery);
      addBox(0.17, 0.4, 0.291, 0.26, 0.31, 0.035, bakeryWindow, vipBakery);
      addBox(-0.35, 0.4, 0.31, 0.045, 0.35, 0.055, stationAccent, vipBakery);
      addBox(0.35, 0.4, 0.31, 0.045, 0.35, 0.055, stationAccent, vipBakery);
      addBox(0, 0.2, 0.31, 0.13, 0.36, 0.055, bakeryBody, vipBakery);
      addBox(0, 0.9, 0.31, 0.62, 0.16, 0.055, stationAccent, vipBakery);
      const bakeryCake = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 7), new THREE.MeshStandardMaterial({ color: 0xf5e9d0, roughness: 0.52 }));
      bakeryCake.position.set(-0.32, 0.68, 0.44);
      bakeryCake.scale.set(1.2, 0.55, 0.62);
      vipBakery.add(bakeryCake);

      // Distant Negin Fars landmark: kept visually smaller than the nearby blocks.
      const neginComplex = new THREE.Group();
      neginComplex.position.set(neginSite.x, 0, neginSite.z);
      mapWorld.add(neginComplex);
      const neginBody = new THREE.MeshStandardMaterial({ color: 0xd5d0c2, roughness: 0.74 });
      const neginGlass = new THREE.MeshStandardMaterial({ color: 0x6d9394, roughness: 0.28, metalness: 0.2, emissive: 0x132627 });
      const neginAccent = new THREE.MeshStandardMaterial({ color: 0x69aaa1, roughness: 0.58 });
      addBox(0, 0.96, 0, 2.2, 1.92, 1.65, neginBody, neginComplex);
      addBox(-1.24, 0.62, -0.12, 0.42, 1.24, 1.38, neginBody, neginComplex);
      addBox(1.23, 0.52, 0.08, 0.38, 1.04, 1.26, neginBody, neginComplex);
      addBox(0, 1.97, 0, 2.34, 0.12, 1.78, neginAccent, neginComplex);
      for (let floor = 0; floor < 3; floor += 1) {
        addBox(0, 0.17 + floor * 0.53, 0.846, 2.18, 0.035, 0.025, neginAccent, neginComplex);
        for (const x of [-0.78, -0.26, 0.26, 0.78]) {
          addBox(x, 0.42 + floor * 0.53, 0.833, 0.34, 0.28, 0.035, neginGlass, neginComplex);
        }
      }
      addBox(0, 2.12, 0, 1.35, 0.22, 0.06, materials.bridgeRail, neginComplex);

      // Main MG FitClub building: multi-floor facade, warm cladding, windows and rooftop sign.
      const club = new THREE.Group();
      club.position.set(clubSite.x, 0, clubSite.z);
      // The local front is +Z; this rotation plus the mirrored map world turns it east,
      // toward Rajai Blvd and the public street frontage.
      club.rotation.y = -Math.PI / 2;
      mapWorld.add(club);
      const clubWidth = 1.42;
      const clubDepth = 0.82;
      const clubHeight = 2.55;
      const clubBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x805331, roughness: 0.74 });
      const clubBody = new THREE.Mesh(sharedBox, clubBodyMaterial);
      clubBody.position.y = clubHeight / 2;
      clubBody.scale.set(clubWidth, clubHeight, clubDepth);
      club.add(clubBody);
      const base = new THREE.Mesh(sharedBox, new THREE.MeshStandardMaterial({ color: 0x363c35, roughness: 0.78 }));
      base.position.set(0, 0.2, 0);
      base.scale.set(clubWidth + 0.1, 0.4, clubDepth + 0.1);
      club.add(base);
      const ledgeMaterial = new THREE.MeshStandardMaterial({ color: 0xad7643, roughness: 0.62 });
      for (let floor = 1; floor <= 4; floor += 1) {
        const ledge = new THREE.Mesh(sharedBox, ledgeMaterial);
        ledge.position.set(0, floor * 0.42 + 0.37, clubDepth / 2 + 0.025);
        ledge.scale.set(clubWidth + 0.12, 0.055, 0.07);
        club.add(ledge);
      }
      const clubWindowMaterial = new THREE.MeshStandardMaterial({ color: 0xa7c4c1, roughness: 0.3, metalness: 0.12, emissive: 0x18201d });
      for (let floor = 0; floor < 5; floor += 1) {
        for (const x of [-0.48, -0.16, 0.16, 0.48]) {
          const window = new THREE.Mesh(sharedBox, clubWindowMaterial);
          window.position.set(x, 0.51 + floor * 0.4, clubDepth / 2 + 0.018);
          window.scale.set(0.2, 0.29, 0.045);
          club.add(window);
        }
      }
      for (const edge of [-1, 1]) {
        const column = new THREE.Mesh(sharedBox, ledgeMaterial);
        column.position.set(edge * (clubWidth / 2 - 0.075), clubHeight / 2, clubDepth / 2 + 0.055);
        column.scale.set(0.1, clubHeight, 0.1);
        club.add(column);
      }
      const roof = new THREE.Mesh(sharedBox, new THREE.MeshStandardMaterial({ color: 0x403c32, roughness: 0.9 }));
      roof.position.y = clubHeight + 0.1;
      roof.scale.set(clubWidth + 0.18, 0.2, clubDepth + 0.14);
      club.add(roof);
      const entryCanopy = new THREE.Mesh(sharedBox, new THREE.MeshStandardMaterial({ color: 0x323b34, roughness: 0.7 }));
      entryCanopy.position.set(0, 0.78, clubDepth / 2 + 0.24);
      entryCanopy.scale.set(0.7, 0.08, 0.42);
      club.add(entryCanopy);
      const entrance = new THREE.Mesh(sharedBox, clubWindowMaterial);
      entrance.position.set(0, 0.47, clubDepth / 2 + 0.035);
      entrance.scale.set(0.38, 0.72, 0.05);
      club.add(entrance);
      for (const side of [-1, 1]) {
        const rooftopUnit = new THREE.Mesh(sharedBox, materials.darkWindow);
        rooftopUnit.position.set(side * 0.38, clubHeight + 0.25, 0.12);
        rooftopUnit.scale.set(0.24, 0.16, 0.2);
        club.add(rooftopUnit);
      }

      const makeTextSprite = (text, opts = {}) => {
        const width = 512;
        const height = 144;
        const tile = document.createElement("canvas");
        tile.width = width;
        tile.height = height;
        const ctx = tile.getContext("2d");
        const bg = opts.background || "rgba(15, 21, 17, .94)";
        const border = opts.border || "#c6ff3f";
        const fg = opts.foreground || "#f4f4e9";
        const radius = 26;
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(radius, 5);
        ctx.arcTo(width - 5, 5, width - 5, height - 5, radius);
        ctx.arcTo(width - 5, height - 5, 5, height - 5, radius);
        ctx.arcTo(5, height - 5, 5, 5, radius);
        ctx.arcTo(5, 5, width - 5, 5, radius);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = border;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.fillStyle = fg;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.direction = /[\u0600-\u06ff]/.test(text) ? "rtl" : "ltr";
        ctx.font = `700 ${opts.fontSize || 42}px "B Esfehan", Tahoma, sans-serif`;
        ctx.fillText(text, width / 2, height / 2 + 2, width - 50);
        const texture = new THREE.CanvasTexture(tile);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }));
        sprite.scale.set(opts.scale || 2.6, (opts.scale || 2.6) * height / width, 1);
        mapWorld.add(sprite);
        return sprite;
      };

      // Compact, physical landmark signs: a framed 3D board, lit edge, posts,
      // and a crisp canvas face. Unlike map labels, these belong to the building.
      const makeBillboardFace = (title, subtitle, accent = "#c6ff3f", monogram = "MG") => {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 1024, 512);
        gradient.addColorStop(0, "#19221b");
        gradient.addColorStop(0.56, "#0b100d");
        gradient.addColorStop(1, "#20201a");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 512);
        ctx.fillStyle = accent;
        ctx.fillRect(0, 0, 20, 512);
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(760, 0);
        ctx.lineTo(1024, 0);
        ctx.lineTo(1024, 512);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(255,255,255,.22)";
        ctx.lineWidth = 5;
        ctx.strokeRect(28, 28, 968, 456);

        ctx.fillStyle = accent;
        const markRadius = 34;
        ctx.beginPath();
        ctx.moveTo(62 + markRadius, 98);
        ctx.arcTo(312, 98, 312, 348, markRadius);
        ctx.arcTo(312, 348, 62, 348, markRadius);
        ctx.arcTo(62, 348, 62, 98, markRadius);
        ctx.arcTo(62, 98, 312, 98, markRadius);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#10150f";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.direction = "ltr";
        ctx.font = "900 110px Arial, sans-serif";
        ctx.fillText(monogram, 187, 218, 220);
        ctx.fillStyle = "#f2f5eb";
        ctx.textAlign = "right";
        ctx.direction = /[\u0600-\u06ff]/.test(title) ? "rtl" : "ltr";
        ctx.font = '800 72px "B Esfehan", Tahoma, sans-serif';
        ctx.fillText(title, 940, 198, 575);
        ctx.fillStyle = accent;
        ctx.fillRect(364, 270, 570, 10);
        ctx.fillStyle = "#d4d7cc";
        ctx.font = '600 38px "B Esfehan", Tahoma, sans-serif';
        ctx.fillText(subtitle, 940, 340, 575);
        ctx.textAlign = "left";
        ctx.direction = "ltr";
        ctx.fillStyle = "rgba(255,255,255,.68)";
        ctx.font = "700 24px Arial, sans-serif";
        ctx.fillText("SHIRAZ  •  MG FITCLUB", 370, 425, 540);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        return texture;
      };

      const addBuildingBillboard = (parent, {
        title,
        subtitle,
        accent = "#c6ff3f",
        monogram = "MG",
        width,
        height,
        x = 0,
        y,
        z,
        yaw = 0,
        postBottom = y,
      }) => {
        const sign = new THREE.Group();
        sign.position.set(x, 0, z);
        sign.rotation.y = yaw;
        parent.add(sign);

        const boardDepth = Math.max(0.055, height * 0.16);
        const centerY = y;
        const accentColor = new THREE.Color(accent);
        const frameMaterial = new THREE.MeshStandardMaterial({
          color: 0x242b25,
          metalness: 0.76,
          roughness: 0.3,
        });
        const trimMaterial = new THREE.MeshStandardMaterial({
          color: accentColor,
          emissive: accentColor,
          emissiveIntensity: 0.42,
          metalness: 0.24,
          roughness: 0.34,
        });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.07, height + 0.07, boardDepth), frameMaterial);
        frame.position.set(0, centerY, 0);
        sign.add(frame);

        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(width - 0.045, height - 0.045),
          new THREE.MeshBasicMaterial({
            map: makeBillboardFace(title, subtitle, accent, monogram),
            toneMapped: false,
            side: THREE.DoubleSide,
          }),
        );
        face.position.set(0, centerY, boardDepth / 2 + 0.006);
        sign.add(face);

        const topRail = new THREE.Mesh(new THREE.BoxGeometry(width + 0.13, 0.035, boardDepth + 0.05), trimMaterial);
        topRail.position.set(0, centerY + height / 2 + 0.032, 0);
        sign.add(topRail);
        const lowerRail = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.022, boardDepth + 0.045), trimMaterial);
        lowerRail.position.set(0, centerY - height / 2 - 0.025, 0);
        sign.add(lowerRail);

        const postMaterial = new THREE.MeshStandardMaterial({ color: 0x545d51, metalness: 0.7, roughness: 0.38 });
        const postHeight = Math.max(0.04, centerY - height / 2 - postBottom);
        for (const postX of [-width * 0.34, width * 0.34]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, postHeight, 0.055), postMaterial);
          post.position.set(postX, postBottom + postHeight / 2, 0);
          sign.add(post);
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.1), frameMaterial);
          foot.position.set(postX, postBottom + 0.018, 0);
          sign.add(foot);
        }
        const boltMaterial = new THREE.MeshStandardMaterial({ color: 0xc7cec2, metalness: 0.82, roughness: 0.28 });
        const boltGeometry = new THREE.SphereGeometry(Math.min(0.022, height * 0.04), 7, 5);
        for (const boltX of [-width / 2 + 0.04, width / 2 - 0.04]) {
          for (const boltY of [centerY - height / 2 + 0.04, centerY + height / 2 - 0.04]) {
            const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
            bolt.position.set(boltX, boltY, boardDepth / 2 + 0.012);
            sign.add(bolt);
          }
        }
        return sign;
      };

      // A real facade-mounted sign keeps the club identity attached to its building.
      const signCanvas = document.createElement("canvas");
      signCanvas.width = 640;
      signCanvas.height = 210;
      const signContext = signCanvas.getContext("2d");
      signContext.fillStyle = "#151a15";
      signContext.fillRect(0, 0, signCanvas.width, signCanvas.height);
      signContext.strokeStyle = "#c6ff3f";
      signContext.lineWidth = 10;
      signContext.strokeRect(7, 7, signCanvas.width - 14, signCanvas.height - 14);
      signContext.direction = "rtl";
      signContext.textAlign = "center";
      signContext.textBaseline = "middle";
      signContext.fillStyle = "#eff5e8";
      signContext.font = '700 50px "B Esfehan", Tahoma, sans-serif';
      signContext.fillText("باشگاه بدنسازی بانوان", 320, 78, 590);
      signContext.direction = "ltr";
      signContext.fillStyle = "#c6ff3f";
      signContext.font = "900 66px Arial, sans-serif";
      signContext.fillText("MG FITCLUB", 320, 155, 590);
      const signTexture = new THREE.CanvasTexture(signCanvas);
      signTexture.colorSpace = THREE.SRGBColorSpace;
      const facadeSign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.28, 0.44),
        new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false }),
      );
      facadeSign.position.set(0, 2.16, clubDepth / 2 + 0.045);
      club.add(facadeSign);
      const pinGeometry = new THREE.CylinderGeometry(0.025, 0.04, 0.44, 8);
      const pinMaterial = new THREE.MeshStandardMaterial({ color: 0xc6ff3f, emissive: 0x455b0e, roughness: 0.4 });
      const markerGeometry = new THREE.SphereGeometry(0.105, 12, 9);
      const ringGeometry = new THREE.TorusGeometry(0.23, 0.022, 6, 24);
      const addPin = (x, z, label, color = 0xc6ff3f, tagScale = 2.6, labelOffset = [0, 0], showBadge = true) => {
        const material = color === 0xc6ff3f ? pinMaterial : new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.16 });
        const stem = new THREE.Mesh(pinGeometry, material);
        stem.position.set(x, 0.34, z);
        mapWorld.add(stem);
        const ball = new THREE.Mesh(markerGeometry, material);
        ball.position.set(x, 0.58, z);
        mapWorld.add(ball);
        const ring = new THREE.Mesh(ringGeometry, material);
        ring.position.set(x, 0.045, z);
        ring.rotation.x = Math.PI / 2;
        mapWorld.add(ring);
        if (!showBadge) return null;
        const badge = makeTextSprite(label, { scale: tagScale, border: `#${color.toString(16).padStart(6, "0")}` });
        badge.position.set(x + labelOffset[0], 1.08, z + labelOffset[1]);
        return badge;
      };
      addBuildingBillboard(club, {
        title: "باشگاه بدنسازی بانوان",
        subtitle: "باشگاه ام‌جی شیراز",
        accent: "#c6ff3f",
        monogram: "MG",
        width: 1.12,
        height: 0.52,
        y: 3.4,
        z: clubDepth / 2 + 0.045,
        postBottom: clubHeight + 0.19,
      });
      addBuildingBillboard(vipBakery, {
        title: "شیرینی VIP",
        subtitle: "قنادی و کافه",
        accent: "#d1a8e7",
        monogram: "VIP",
        width: 0.66,
        height: 0.31,
        y: 1.1,
        z: 0.37,
        postBottom: 0.82,
      });
      addBuildingBillboard(sportsComplex, {
        title: "ورزشی احسان",
        subtitle: "مجموعه ورزشی",
        accent: "#84d874",
        monogram: "ES",
        width: 0.82,
        height: 0.32,
        y: 1.02,
        z: 0.7,
        yaw: -Math.PI / 2,
        postBottom: 0.78,
      });
      addBuildingBillboard(petrolStation, {
        title: "پمپ بنزین",
        subtitle: "سوخت‌رسانی شبانه‌روزی",
        accent: "#c3a3d7",
        monogram: "24H",
        width: 0.76,
        height: 0.34,
        x: 0.88,
        y: 1.3,
        z: 0.63,
        yaw: -Math.PI / 2,
        postBottom: 0.99,
      });
      addBuildingBillboard(neginComplex, {
        title: "مجتمع تجاری نگین",
        subtitle: "معالی‌آباد • شیراز",
        accent: "#72c8bd",
        monogram: "N",
        width: 1.12,
        height: 0.4,
        y: 2.36,
        z: 0.92,
        yaw: -Math.PI / 2,
        postBottom: 2.05,
      });
      addPin(ehsanRoundaboutSite.x, ehsanRoundaboutSite.z, "میدان احسان", 0xf4a340, 2.15, [-1.15, 0.42]);
      addPin(pedestrianBridgeSite.x, pedestrianBridgeSite.z, "پل عابر • ۲۰م جنوب", 0xf4a340, 2.65, [-2.8, -0.32]);
      addPin(petrolStationSite.x, petrolStationSite.z, "پمپ بنزین", 0xc3a3d7, 2.0, [0.6, 0.35], false);
      addPin(ehsanSportsSite.x, ehsanSportsSite.z, "ورزشی احسان", 0x84d874, 2.2, [-0.55, -0.65], false);
      addPin(vipBakerySite.x, vipBakerySite.z, "شیرینی VIP", 0xc3a3d7, 1.9, [3.0, -0.18], false);
      addPin(neginSite.x, neginSite.z, "مجتمع نگین", 0x69aaa1, 2.2, [-2.4, 0.55], false);
      addPin(maaliAbadSite.x, maaliAbadSite.z, "معالی‌آباد", 0xf4a340, 2.15, [1.15, 0.25]);
      addPin(7.05, 8.65, "فرهنگ‌شهر", 0xf4a340, 2.35);
      const roadLabelStyle = { background: "rgba(36, 48, 51, .94)", border: "#b7cbd0", foreground: "#eef2e8", fontSize: 34 };
      const roadLabels = [
        { text: "بلوار رجایی", x: 0.95, z: -4.25, scale: 1.8 },
        { text: "کوچه ۵۲", x: 5.25, z: -3.05, scale: 1.6 },
        { text: "خیابان پرستار", x: -2.75, z: 9.72, scale: 2.0 },
        { text: "خیابان معالی‌آباد", x: 2.45, z: 6.85, scale: 1.8 },
        { text: "خیابان بهاران", x: 5.15, z: 1.9, scale: 1.6 },
      ];
      for (const label of roadLabels) {
        const sprite = makeTextSprite(label.text, { ...roadLabelStyle, scale: label.scale });
        sprite.position.set(label.x, 0.22, label.z);
      }

      const defaultTheta = 2.25; // reference view from Rajai Blvd, matching the supplied screenshot
      const defaultPhi = 0.94;
      const streetNavigator = createPolylineNavigator(streetTravelRoute.map(([x, z]) => [-x, z]));
      const homeRoadStation = streetNavigator.closestStation([-clubSite.x, clubSite.z]);
      const homeRoadPoint = streetNavigator.at(homeRoadStation).point;
      const maxStreetOffsetUnits = Math.min(
        LOCKED_STREET_LIMIT_UNITS,
        homeRoadStation,
        streetNavigator.length - homeRoadStation,
      );
      const homeTarget = new THREE.Vector3(-clubSite.x, 0.1, clubSite.z);
      const target = homeTarget.clone();
      const orbit = { theta: defaultTheta, phi: defaultPhi, radius: 33 };
      let streetOffsetUnits = 0;
      let angleLocked = true;
      let userAdjustedView = false;
      const lockButton = toolbar.querySelector('[data-map-action="toggle-lock"]');
      const modeLabel = toolbar.querySelector("[data-map-mode-label]");
      const updateLockButton = () => {
        lockButton.setAttribute("aria-pressed", String(angleLocked));
        lockButton.setAttribute("aria-label", angleLocked
          ? "زاویه قفل است؛ برای چرخش آزاد باز کنید"
          : "قفل زاویه روی نمای مرجع");
        lockButton.title = angleLocked ? "زاویه ثابت؛ حرکت در امتداد خیابان" : "قفل زاویه روی نمای مرجع";
        modeLabel.textContent = angleLocked ? "زاویه ثابت · حرکت روی خیابان" : "چرخش آزاد";
      };
      const setStreetOffset = (offset) => {
        streetOffsetUnits = clamp(offset, -maxStreetOffsetUnits, maxStreetOffsetUnits);
        const roadPoint = streetNavigator.at(homeRoadStation + streetOffsetUnits).point;
        target.copy(homeTarget).add(new THREE.Vector3(
          roadPoint[0] - homeRoadPoint[0],
          0,
          roadPoint[1] - homeRoadPoint[1],
        ));
      };
      const updateCamera = () => {
        orbit.phi = clamp(orbit.phi, 0.42, 1.34);
        orbit.radius = clamp(orbit.radius, 18, 40);
        const spherical = new THREE.Spherical(orbit.radius, orbit.phi, orbit.theta);
        camera.position.setFromSpherical(spherical).add(target);
        camera.lookAt(target);
      };
      updateCamera();

      const resize = () => {
        const width = Math.max(1, viewport.clientWidth);
        const height = Math.max(1, viewport.clientHeight);
        const narrow = width / height < 0.82;
        camera.fov = narrow ? 50 : 34;
        if (!userAdjustedView) {
          orbit.radius = narrow ? 37 : 33;
          homeTarget.set(-clubSite.x, 0.1, clubSite.z + (narrow ? 1.6 : 0));
          setStreetOffset(0);
        }
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        updateCamera();
        renderer.setSize(width, height, false);
        renderer.render(scene, camera);
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(viewport);
      resize();

      let active = false;
      const activate = () => {
        if (active || document.hidden) return;
        active = true;
        renderer.render(scene, camera);
      };
      const deactivate = () => {
        active = false;
      };
      const visibilityObserver = new IntersectionObserver(([entry]) => {
        entry.isIntersecting ? activate() : deactivate();
      }, { rootMargin: "120px" });
      visibilityObserver.observe(MAP);
      document.addEventListener("visibilitychange", () => document.hidden ? deactivate() : activate());

      let pointer = null;
      canvas.addEventListener("pointerdown", (event) => {
        pointer = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!pointer) return;
        const dx = event.clientX - pointer.x;
        const dy = event.clientY - pointer.y;
        pointer = { x: event.clientX, y: event.clientY };
        if (angleLocked) {
          const roadFrame = streetNavigator.at(homeRoadStation + streetOffsetUnits);
          const streetTangent = new THREE.Vector3(roadFrame.tangent[0], 0, roadFrame.tangent[1]);
          const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
          const axisScreenX = streetTangent.dot(cameraRight);
          const axisScreenY = -streetTangent.dot(cameraUp);
          const projectedAxisLength = Math.hypot(axisScreenX, axisScreenY);
          const focalPixels = viewport.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
          const pixelsPerWorldUnit = (focalPixels / orbit.radius) * projectedAxisLength;
          setStreetOffset(offsetFromStreetDrag({
            currentOffsetUnits: streetOffsetUnits,
            deltaX: dx,
            deltaY: dy,
            axisScreenX,
            axisScreenY,
            pixelsPerWorldUnit,
          }));
        } else {
          orbit.theta -= dx * 0.006;
          orbit.phi += dy * 0.0045;
        }
        userAdjustedView = true;
        updateCamera();
        renderer.render(scene, camera);
      });
      const stopDrag = () => { pointer = null; };
      canvas.addEventListener("pointerup", stopDrag);
      canvas.addEventListener("pointercancel", stopDrag);
      canvas.addEventListener("lostpointercapture", stopDrag);
      canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        orbit.radius *= event.deltaY > 0 ? 1.08 : 0.92;
        userAdjustedView = true;
        updateCamera();
        renderer.render(scene, camera);
      }, { passive: false });
      canvas.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 0.14 : 0.08;
        if (angleLocked && event.key === "ArrowUp") setStreetOffset(streetOffsetUnits - step * 2);
        else if (angleLocked && event.key === "ArrowDown") setStreetOffset(streetOffsetUnits + step * 2);
        else if (angleLocked && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          event.preventDefault();
          return;
        }
        else if (!angleLocked && event.key === "ArrowLeft") orbit.theta += step;
        else if (!angleLocked && event.key === "ArrowRight") orbit.theta -= step;
        else if (!angleLocked && event.key === "ArrowUp") orbit.phi = clamp(orbit.phi - step, 0.42, 1.34);
        else if (!angleLocked && event.key === "ArrowDown") orbit.phi = clamp(orbit.phi + step, 0.42, 1.34);
        else if (event.key === "+" || event.key === "=") orbit.radius *= 0.92;
        else if (event.key === "-") orbit.radius *= 1.08;
        else return;
        event.preventDefault();
        userAdjustedView = true;
        updateCamera();
        renderer.render(scene, camera);
      });

      const reset = () => {
        const narrow = viewport.clientWidth / Math.max(1, viewport.clientHeight) < 0.82;
        homeTarget.set(-clubSite.x, 0.1, clubSite.z + (narrow ? 1.6 : 0));
        setStreetOffset(0);
        orbit.theta = defaultTheta;
        orbit.phi = defaultPhi;
        userAdjustedView = false;
        angleLocked = true;
        updateLockButton();
        orbit.radius = narrow ? 37 : 33;
        updateCamera();
        renderer.render(scene, camera);
      };
      toolbar.addEventListener("click", (event) => {
        const button = event.target.closest("[data-map-action]");
        if (!button) return;
        const action = button.dataset.mapAction;
        if (action === "toggle-lock") {
          angleLocked = !angleLocked;
          if (angleLocked) {
            orbit.theta = defaultTheta;
            orbit.phi = defaultPhi;
          }
          updateLockButton();
          userAdjustedView = true;
          updateCamera();
          renderer.render(scene, camera);
          return;
        }
        if (action === "focus") {
          homeTarget.set(-clubSite.x, 0.8, clubSite.z);
          setStreetOffset(0);
          orbit.radius = 22;
        } else if (action === "zoom-in") orbit.radius *= 0.84;
        else if (action === "zoom-out") orbit.radius *= 1.19;
        else if (action === "reset") return reset();
        userAdjustedView = true;
        updateCamera();
        renderer.render(scene, camera);
      });

      MAP.classList.add("is-ready");
      updateLockButton();
      toolbar.hidden = false;
      if (status) {
        status.hidden = true;
        status.textContent = "";
      }
    } catch (error) {
      console.warn("MG location 3D view could not start; keeping the illustrated map visible.", error);
      showFallback("نمای سه‌بعدی در این مرورگر فعال نشد؛ نقشهٔ تصویری نشانی نمایش داده می‌شود.");
    }
  };

  if ("IntersectionObserver" in window) {
    const loader = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      loader.disconnect();
      start();
    }, { rootMargin: "320px 0px" });
    loader.observe(MAP);
  } else {
    start();
  }
}
