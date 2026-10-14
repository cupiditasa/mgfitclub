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

      // North-up neighborhood diorama aligned to the supplied Google Maps pin.
      // Latitude/longitude is exact; street geometry remains illustrative, not survey data.
      const clubSite = {
        latitude: Number(MAP.dataset.locationLat),
        longitude: Number(MAP.dataset.locationLon),
        x: 1.9,
        z: -0.75,
      };
      const MAP_METERS_PER_UNIT = 12;
      const ehsanRoundaboutSite = { x: -1.18, z: 8.05 };
      const pedestrianBridgeSite = {
        x: 0.08,
        z: clubSite.z - 20 / MAP_METERS_PER_UNIT,
      };
      const vipBakerySite = {
        x: (clubSite.x + pedestrianBridgeSite.x) / 2,
        z: (clubSite.z + pedestrianBridgeSite.z) / 2,
      };
      const petrolStationSite = { x: -2.5, z: 5.1 };
      const ehsanSportsSite = { x: -6.8, z: 6.4 };
      const neginSite = { x: -3.75, z: 10.8 };
      if (!Number.isFinite(clubSite.latitude) || !Number.isFinite(clubSite.longitude)) {
        throw new Error("MG location pin coordinates are missing.");
      }
      addBox(0, -0.34, 0, 18.2, 0.42, 24.4, materials.slab);
      addBox(0, -0.105, 0, 17.85, 0.08, 24.05, materials.ground);

      const addRoad = (points, width, material, dashed = false, baseY = 0) => {
        const outline = [];
        const inner = [];
        const segments = [];
        for (let index = 0; index < points.length - 1; index += 1) {
          const a = points[index];
          const b = points[index + 1];
          const dx = b[0] - a[0];
          const dz = b[1] - a[1];
          const length = Math.hypot(dx, dz) || 1;
          const nx = -dz / length;
          const nz = dx / length;
          segments.push({ a, b, dx, dz, length, nx, nz });
          for (const [target, half] of [[outline, width / 2 + 0.1], [inner, width / 2]]) {
            target.push(
              [a[0] + nx * half, a[1] + nz * half],
              [b[0] + nx * half, b[1] + nz * half],
              [b[0] - nx * half, b[1] - nz * half],
              [a[0] - nx * half, a[1] - nz * half],
            );
          }
        }
        const makeStrip = (vertices, y, mat) => {
          const positions = [];
          const indices = [];
          for (let i = 0; i < vertices.length; i += 4) {
            const offset = positions.length / 3;
            for (const [x, z] of vertices.slice(i, i + 4)) positions.push(x, y, z);
            indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
          }
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          const mesh = new THREE.Mesh(geometry, mat);
          mesh.position.y = 0.008 + baseY;
          mesh.rotation.x = 0;
          mapWorld.add(mesh);
        };
        makeStrip(outline, 0, materials.curb);
        makeStrip(inner, 0.012, material);
        if (dashed) {
          for (const { a, dx, dz, length } of segments) {
            const count = Math.floor(length / 0.74);
            for (let n = 1; n < count; n += 2) {
              const t = n / count;
              const angle = Math.atan2(dx, dz);
              const mark = new THREE.Mesh(
                new THREE.BoxGeometry(0.045, 0.018, Math.min(0.34, length / count * 0.62)),
                materials.line,
              );
              mark.position.set(a[0] + dx * t, 0.036 + baseY, a[1] + dz * t);
              mark.rotation.y = angle;
              mapWorld.add(mark);
            }
          }
        }
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
      const addLandscapedMedian = (points, baseY = 0, skipRoundabout = false) => {
        addRoad(points, medianWidth, materials.median, false, baseY);
        const plantGeometry = new THREE.SphereGeometry(0.075, 6, 5);
        const plants = new THREE.InstancedMesh(plantGeometry, materials.medianPlant, 48);
        const plant = new THREE.Object3D();
        let count = 0;
        for (const [x, z] of samplePath(points, 0.72)) {
          if (skipRoundabout && Math.hypot(x - ehsanRoundaboutSite.x, z - ehsanRoundaboutSite.z) < 1.4) continue;
          plant.position.set(x, 0.12 + baseY, z);
          plant.scale.set(1.2, 0.72, 0.82);
          plant.updateMatrix();
          plants.setMatrixAt(count++, plant.matrix);
        }
        plants.count = count;
        plants.instanceMatrix.needsUpdate = true;
        mapWorld.add(plants);
      };
      const addDividedRoad = (points, baseY = 0, landscaped = true) => {
        addRoad(offsetPath(points, -carriagewayOffset), carriagewayWidth, materials.road, true, baseY);
        addRoad(offsetPath(points, carriagewayOffset), carriagewayWidth, materials.road, true, baseY);
        if (landscaped) addLandscapedMedian(points, baseY, true);
        else addRoad(points, medianWidth, materials.bridge, false, baseY);
      };

      const neighborhoodRoads = [
        // The raised Ehsan route and divided Rajai Boulevard are separate axes.
        { name: "Ehsan Overpass", points: [[-1.35, 10.7], [-1.28, 9.2], [-1.2, 7.9], [-1.1, 6.2], [-0.92, 4.8]], width: 1.35, material: materials.road, dashed: true, divided: true, elevated: true },
        { name: "Rajai Blvd", points: [[-0.02, 10], [-0.02, 8], [-0.01, 6], [0.02, 4], [0.04, 1.5], [0.1, -1], [0.18, -4], [0.26, -7], [0.34, -10]], width: 1.35, material: materials.road, dashed: true, divided: true },
        { name: "Maali Abad Bypass", points: [[-0.1, 8.05], [0.68, 7.88], [1.78, 7.46], [2.95, 7.08], [4.55, 6.55]], width: 0.62, material: materials.sideRoad, dashed: false },
        { name: "Parastar Blvd", points: [[-1.92, 8.82], [-2.48, 9.38], [-3.15, 10.08], [-3.75, 10.7]], width: 0.68, material: materials.road, dashed: true },
        { name: "Jazayeri St", points: [[-8.25, 0.95], [-6, 0.87], [-3.5, 0.78], [-1.45, 0.72], [-0.01, 0.7]], width: 0.55, material: materials.sideRoad, dashed: false },
        { name: "Baharan 8th", points: [[0.12, 3.0], [1.45, 3.75], [2.9, 4.75], [4.6, 5.8]], width: 0.5, material: materials.sideRoad, dashed: false },
        { name: "50th Rajaei", points: [[0.08, -2.15], [1.4, -3.05], [2.8, -4.25], [4.4, -5.45], [6.55, -6.8]], width: 0.54, material: materials.sideRoad, dashed: false },
        { name: "Alley 52", points: [[0.24, -2.45], [1.5, -2.52], [2.8, -2.38], [4.25, -1.95]], width: 0.38, material: materials.sideRoad, dashed: false },
        { name: "Baharan St", points: [[5.55, 10], [5.5, 5], [5.5, 0], [5.45, -5], [5.4, -10]], width: 0.52, material: materials.sideRoad, dashed: false },
        { name: "1st Rahmati St", points: [[-7.35, -10], [-7.3, -5], [-7.25, 0], [-7.2, 5], [-7.15, 10]], width: 0.46, material: materials.sideRoad, dashed: false },
      ];
      for (const road of neighborhoodRoads) {
        if (road.divided) addDividedRoad(road.points, road.elevated ? 0.62 : 0, !road.elevated);
        else addRoad(road.points, road.width, road.material, road.dashed);
      }

      // Raised paving strips separate the divided boulevard from adjacent blocks.
      const rajaiRoute = neighborhoodRoads.find((road) => road.name === "Rajai Blvd").points;
      const sidewalkOffset = medianWidth / 2 + carriagewayWidth + 0.095;
      for (const side of [-1, 1]) {
        addRoad(offsetPath(rajaiRoute, side * sidewalkOffset), 0.19, materials.sidewalk);
      }
      for (const roadName of ["Baharan 8th", "50th Rajaei", "Alley 52", "Baharan St"]) {
        const road = neighborhoodRoads.find((item) => item.name === roadName);
        if (!road) continue;
        const pathOffset = road.width / 2 + 0.08;
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
          if (roadClearance || clubDistance < 2.2 || petrolDistance < 1.8 || sportsDistance < 1.9 || bakeryDistance < 1.7 || neginDistance < 2.1) continue;
          if (random() < 0.12) continue;
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

      // Ehsan's ground-level circle sits under the raised through-route.
      const roundaboutRoad = new THREE.Mesh(
        new THREE.RingGeometry(0.64, 1.08, 48),
        materials.road,
      );
      roundaboutRoad.rotation.x = -Math.PI / 2;
      roundaboutRoad.position.set(ehsanRoundaboutSite.x, 0.026, ehsanRoundaboutSite.z);
      mapWorld.add(roundaboutRoad);
      const roundaboutIsland = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 32),
        materials.park,
      );
      roundaboutIsland.rotation.x = -Math.PI / 2;
      roundaboutIsland.position.set(ehsanRoundaboutSite.x, 0.035, ehsanRoundaboutSite.z);
      mapWorld.add(roundaboutIsland);
      const roundaboutCurb = new THREE.Mesh(
        new THREE.RingGeometry(1.08, 1.18, 48),
        materials.curb,
      );
      roundaboutCurb.rotation.x = -Math.PI / 2;
      roundaboutCurb.position.set(ehsanRoundaboutSite.x, 0.05, ehsanRoundaboutSite.z);
      mapWorld.add(roundaboutCurb);
      const roundaboutLaneMark = new THREE.MeshBasicMaterial({ color: 0xe8e4d2 });
      for (let mark = 0; mark < 12; mark += 1) {
        const angle = (mark / 12) * Math.PI * 2;
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.014, 0.035), roundaboutLaneMark);
        dash.position.set(
          ehsanRoundaboutSite.x + Math.cos(angle) * 0.88,
          0.046,
          ehsanRoundaboutSite.z + Math.sin(angle) * 0.88,
        );
        dash.rotation.y = -angle;
        mapWorld.add(dash);
      }
      const islandTreeGeometry = new THREE.ConeGeometry(0.14, 0.42, 7);
      for (const [dx, dz] of [[0, 0], [-0.26, 0.18], [0.24, -0.2]]) {
        const islandTree = new THREE.Mesh(islandTreeGeometry, materials.tree);
        islandTree.position.set(ehsanRoundaboutSite.x + dx, 0.25, ehsanRoundaboutSite.z + dz);
        mapWorld.add(islandTree);
      }

      // Short piers and parapets make the Ehsan route read as a real overpass.
      for (const z of [6.25, 9.9]) {
        for (const dx of [-0.4, 0.4]) {
          addBox(ehsanRoundaboutSite.x + dx, 0.32, z, 0.16, 0.64, 0.18, materials.bridge);
        }
      }
      for (const dx of [-0.76, 0.76]) {
        addBox(ehsanRoundaboutSite.x + dx, 0.92, 8.05, 0.07, 0.28, 4.2, materials.bridgeRail);
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
      mapWorld.add(vipBakery);
      const bakeryBody = new THREE.MeshStandardMaterial({ color: 0xd5c5b8, roughness: 0.78 });
      const bakeryAwning = new THREE.MeshStandardMaterial({ color: 0xc3a3d7, roughness: 0.58 });
      const bakeryWindow = new THREE.MeshStandardMaterial({ color: 0x9fb7b8, roughness: 0.28, metalness: 0.16, emissive: 0x172522 });
      addBox(0, 0.4, 0, 0.92, 0.8, 0.78, bakeryBody, vipBakery);
      addBox(0, 0.83, 0.42, 1.04, 0.12, 0.08, bakeryAwning, vipBakery);
      addBox(-0.18, 0.42, 0.401, 0.36, 0.34, 0.035, bakeryWindow, vipBakery);
      addBox(0.24, 0.42, 0.401, 0.32, 0.34, 0.035, bakeryWindow, vipBakery);
      addBox(-0.45, 0.42, 0.43, 0.055, 0.38, 0.07, stationAccent, vipBakery);
      addBox(0.45, 0.42, 0.43, 0.055, 0.38, 0.07, stationAccent, vipBakery);
      addBox(0, 0.2, 0.43, 0.16, 0.38, 0.055, bakeryBody, vipBakery);
      addBox(0, 0.99, 0.43, 0.82, 0.22, 0.06, stationAccent, vipBakery);
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
      club.rotation.y = Math.PI / 2;
      mapWorld.add(club);
      const clubWidth = 2.05;
      const clubDepth = 1.86;
      const clubHeight = 3.5;
      const clubBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x805331, roughness: 0.74 });
      const clubBody = new THREE.Mesh(sharedBox, clubBodyMaterial);
      clubBody.position.y = clubHeight / 2;
      clubBody.scale.set(clubWidth, clubHeight, clubDepth);
      club.add(clubBody);
      const base = new THREE.Mesh(sharedBox, new THREE.MeshStandardMaterial({ color: 0x363c35, roughness: 0.78 }));
      base.position.set(0, 0.28, 0);
      base.scale.set(clubWidth + 0.1, 0.56, clubDepth + 0.1);
      club.add(base);
      const ledgeMaterial = new THREE.MeshStandardMaterial({ color: 0xad7643, roughness: 0.62 });
      for (let floor = 1; floor <= 4; floor += 1) {
        const ledge = new THREE.Mesh(sharedBox, ledgeMaterial);
        ledge.position.set(0, floor * 0.68 + 0.25, clubDepth / 2 + 0.025);
        ledge.scale.set(clubWidth + 0.12, 0.07, 0.07);
        club.add(ledge);
      }
      const clubWindowMaterial = new THREE.MeshStandardMaterial({ color: 0xa7c4c1, roughness: 0.3, metalness: 0.12, emissive: 0x18201d });
      for (let floor = 0; floor < 5; floor += 1) {
        for (let col = 0; col < 4; col += 1) {
          const window = new THREE.Mesh(sharedBox, clubWindowMaterial);
          window.position.set(-0.79 + col * 0.53, 0.76 + floor * 0.65, clubDepth / 2 + 0.018);
          window.scale.set(0.29, 0.38, 0.045);
          club.add(window);
        }
      }
      for (const edge of [-1, 1]) {
        const column = new THREE.Mesh(sharedBox, ledgeMaterial);
        column.position.set(edge * (clubWidth / 2 - 0.09), 1.95, clubDepth / 2 + 0.055);
        column.scale.set(0.12, 3.55, 0.12);
        club.add(column);
      }
      const roof = new THREE.Mesh(sharedBox, new THREE.MeshStandardMaterial({ color: 0x403c32, roughness: 0.9 }));
      roof.position.y = clubHeight + 0.12;
      roof.scale.set(clubWidth + 0.22, 0.24, clubDepth + 0.18);
      club.add(roof);
      const entryCanopy = new THREE.Mesh(sharedBox, new THREE.MeshStandardMaterial({ color: 0x323b34, roughness: 0.7 }));
      entryCanopy.position.set(0, 0.87, clubDepth / 2 + 0.28);
      entryCanopy.scale.set(0.9, 0.09, 0.52);
      club.add(entryCanopy);
      const entrance = new THREE.Mesh(sharedBox, clubWindowMaterial);
      entrance.position.set(0, 0.47, clubDepth / 2 + 0.035);
      entrance.scale.set(0.56, 0.78, 0.05);
      club.add(entrance);
      for (const side of [-1, 1]) {
        const rooftopUnit = new THREE.Mesh(sharedBox, materials.darkWindow);
        rooftopUnit.position.set(side * 0.56, clubHeight + 0.32, 0.18);
        rooftopUnit.scale.set(0.32, 0.18, 0.3);
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
        new THREE.PlaneGeometry(1.92, 0.63),
        new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false }),
      );
      facadeSign.position.set(0, 3.08, clubDepth / 2 + 0.045);
      club.add(facadeSign);
      const pinGeometry = new THREE.CylinderGeometry(0.025, 0.04, 0.44, 8);
      const pinMaterial = new THREE.MeshStandardMaterial({ color: 0xc6ff3f, emissive: 0x455b0e, roughness: 0.4 });
      const markerGeometry = new THREE.SphereGeometry(0.105, 12, 9);
      const ringGeometry = new THREE.TorusGeometry(0.23, 0.022, 6, 24);
      const addPin = (x, z, label, color = 0xc6ff3f, tagScale = 2.6, labelOffset = [0, 0]) => {
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
        const badge = makeTextSprite(label, { scale: tagScale, border: `#${color.toString(16).padStart(6, "0")}` });
        badge.position.set(x + labelOffset[0], 1.08, z + labelOffset[1]);
        return badge;
      };
      const vipSign = makeTextSprite("VIP", { scale: 0.92, fontSize: 56, border: "#c3a3d7", background: "rgba(35, 25, 42, .96)" });
      vipSign.position.set(vipBakerySite.x, 1.62, vipBakerySite.z + 0.4);
      const stationSign = makeTextSprite("24H", { scale: 0.86, fontSize: 50, border: "#c3a3d7", background: "rgba(35, 25, 42, .96)" });
      stationSign.position.set(petrolStationSite.x + 0.88, 1.34, petrolStationSite.z + 0.57);
      const neginSign = makeTextSprite("NEGIN", { scale: 1.12, fontSize: 48, border: "#69aaa1", background: "rgba(18, 37, 37, .96)" });
      neginSign.position.set(neginSite.x, 2.45, neginSite.z + 0.9);
      addPin(ehsanRoundaboutSite.x, ehsanRoundaboutSite.z, "میدان احسان", 0xf4a340, 2.15, [-1.15, 0.42]);
      addPin(pedestrianBridgeSite.x, pedestrianBridgeSite.z, "پل عابر • ۲۰م جنوب", 0xf4a340, 2.65, [-2.8, -0.32]);
      addPin(petrolStationSite.x, petrolStationSite.z, "پمپ بنزین", 0xc3a3d7, 2.0, [0.6, 0.35]);
      addPin(ehsanSportsSite.x, ehsanSportsSite.z, "ورزشی احسان", 0x84d874, 2.2, [-0.55, -0.65]);
      addPin(vipBakerySite.x, vipBakerySite.z, "شیرینی VIP", 0xc3a3d7, 1.9, [3.0, -0.18]);
      addPin(neginSite.x, neginSite.z, "مجتمع نگین", 0x69aaa1, 2.2, [-2.4, 0.55]);
      addPin(4.55, 6.55, "معالی‌آباد", 0xf4a340, 2.15, [1.15, 0.25]);
      addPin(7.05, 8.65, "فرهنگ‌شهر", 0xf4a340, 2.35);

      const roadLabelStyle = { background: "rgba(36, 48, 51, .94)", border: "#b7cbd0", foreground: "#eef2e8", fontSize: 34 };
      const roadLabels = [
        { text: "بلوار رجایی", x: 0.95, z: -4.25, scale: 1.8 },
        { text: "کوچه ۵۲", x: 5.25, z: -3.05, scale: 1.6 },
        { text: "خیابان پرستار", x: -2.75, z: 9.72, scale: 2.0 },
        { text: "کنارگذر", x: 2.45, z: 7.1, scale: 1.8 },
      ];
      for (const label of roadLabels) {
        const sprite = makeTextSprite(label.text, { ...roadLabelStyle, scale: label.scale });
        sprite.position.set(label.x, 0.22, label.z);
      }

      const target = new THREE.Vector3(-clubSite.x, 0.1, clubSite.z);
      const defaultTheta = -2.9; // approach from the south with a slight west angle; keep north nearly upright
      const orbit = { theta: defaultTheta, phi: 0.94, radius: 33 };
      let userAdjustedView = false;
      const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
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
          target.set(-clubSite.x, 0.1, clubSite.z + (narrow ? 1.6 : 0));
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
        orbit.theta -= dx * 0.006;
        orbit.phi += dy * 0.0045;
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
        if (event.key === "ArrowLeft") orbit.theta += step;
        else if (event.key === "ArrowRight") orbit.theta -= step;
        else if (event.key === "ArrowUp") orbit.phi = clamp(orbit.phi - step, 0.42, 1.34);
        else if (event.key === "ArrowDown") orbit.phi = clamp(orbit.phi + step, 0.42, 1.34);
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
        target.set(-clubSite.x, 0.1, clubSite.z + (narrow ? 1.6 : 0));
        orbit.theta = defaultTheta;
        orbit.phi = 0.94;
        userAdjustedView = false;
        orbit.radius = narrow ? 37 : 33;
        updateCamera();
        renderer.render(scene, camera);
      };
      toolbar.addEventListener("click", (event) => {
        const button = event.target.closest("[data-map-action]");
        if (!button) return;
        const action = button.dataset.mapAction;
        if (action === "focus") {
          target.set(-clubSite.x, 0.8, clubSite.z);
          orbit.radius = 22;
        } else if (action === "zoom-in") orbit.radius *= 0.84;
        else if (action === "zoom-out") orbit.radius *= 1.19;
        else if (action === "reset") return reset();
        userAdjustedView = true;
        updateCamera();
        renderer.render(scene, camera);
      });

      MAP.classList.add("is-ready");
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
