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

      const sharedBox = new THREE.BoxGeometry(1, 1, 1);
      const materials = {
        slab: new THREE.MeshStandardMaterial({ color: 0x29352d, roughness: 0.9 }),
        ground: new THREE.MeshStandardMaterial({ color: 0xd8ddd3, roughness: 1 }),
        curb: new THREE.MeshBasicMaterial({ color: 0xb3bdb4 }),
        road: new THREE.MeshStandardMaterial({ color: 0x687782, roughness: 0.88 }),
        sideRoad: new THREE.MeshStandardMaterial({ color: 0x89949a, roughness: 0.9 }),
        line: new THREE.MeshBasicMaterial({ color: 0xe8e4d2 }),
        lime: new THREE.MeshStandardMaterial({ color: 0xc6ff3f, roughness: 0.55 }),
        park: new THREE.MeshStandardMaterial({ color: 0x8fab72, roughness: 0.95 }),
        tree: new THREE.MeshStandardMaterial({ color: 0x497354, roughness: 0.92 }),
        treeLight: new THREE.MeshStandardMaterial({ color: 0x71935d, roughness: 0.92 }),
        window: new THREE.MeshStandardMaterial({ color: 0x8ba2a2, roughness: 0.4, metalness: 0.14 }),
        darkWindow: new THREE.MeshStandardMaterial({ color: 0x31413e, roughness: 0.42, metalness: 0.12 }),
      };
      const addBox = (x, y, z, sx, sy, sz, material, parent = scene) => {
        const mesh = new THREE.Mesh(sharedBox, material);
        mesh.position.set(x, y, z);
        mesh.scale.set(sx, sy, sz);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        parent.add(mesh);
        return mesh;
      };

      // A compact neighborhood diorama. Street labels and named landmarks mirror
      // the club's supplied location artwork; proportions are illustrative, not survey data.
      addBox(0, -0.34, 0, 16.8, 0.42, 20.4, materials.slab);
      addBox(0, -0.105, 0, 16.45, 0.08, 20.05, materials.ground);

      const addRoad = (points, width, material, dashed = false) => {
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
          mesh.position.y = 0.008;
          mesh.rotation.x = 0;
          scene.add(mesh);
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
              mark.position.set(a[0] + dx * t, 0.036, a[1] + dz * t);
              mark.rotation.y = angle;
              scene.add(mark);
            }
          }
        }
      };

      addRoad([[-7.55, -7.9], [-4.4, -4.25], [-1.25, -0.3], [2.1, 3.7], [6.95, 8.35]], 1.36, materials.road, true);
      addRoad([[-7.8, -2.65], [-3.5, -1.75], [1.15, -0.55], [7.8, 0.65]], 0.82, materials.sideRoad, true);
      addRoad([[-6.7, 7.75], [-3.35, 4.25], [0.2, 0.8], [3.4, -2.85], [6.6, -7.7]], 0.74, materials.sideRoad, false);
      addRoad([[-7.7, 4.7], [-4.2, 4.05], [-0.6, 3.55], [3.2, 3.15], [7.7, 2.45]], 0.52, materials.sideRoad, false);

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
      const xs = [-6.5, -4.35, -2.15, 0.45, 2.8, 5.15, 6.8];
      const zs = [-7.45, -5.15, -2.75, -0.35, 2.05, 4.45, 6.85, 8.1];
      for (const z of zs) {
        for (const x of xs) {
          const mainRoadDistance = Math.abs(x - (0.72 * z - 1.1));
          const crossingRoadDistance = Math.abs(z - (-0.23 * x - 0.9));
          const parkDistance = Math.hypot(x - 4.65, z + 5.55);
          const clubDistance = Math.hypot(x + 0.55, z - 1.0);
          if (mainRoadDistance < 1.05 || crossingRoadDistance < 0.72 || parkDistance < 1.7 || clubDistance < 1.5) continue;
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
          scene.add(group);
          buildings.push(group);
        }
      }

      // A small shared instanced window set gives the city depth without hundreds of draw calls.
      const windowGeometry = new THREE.BoxGeometry(0.19, 0.15, 0.025);
      const windows = new THREE.InstancedMesh(windowGeometry, materials.window, buildings.length * 6);
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
          }
        }
      }
      windows.count = windowIndex;
      windows.instanceMatrix.needsUpdate = true;
      scene.add(windows);

      // Mellat Park as a visible green pocket in the district.
      addBox(4.65, -0.008, -5.55, 2.55, 0.065, 2.45, materials.park);
      const trunkGeometry = new THREE.CylinderGeometry(0.055, 0.075, 0.35, 7);
      const crownGeometry = new THREE.SphereGeometry(0.28, 9, 7);
      const parkTrees = new THREE.Group();
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          const x = 3.75 + column * 0.57 + (row % 2) * 0.18;
          const z = -6.25 + row * 0.66;
          const trunk = new THREE.Mesh(trunkGeometry, new THREE.MeshStandardMaterial({ color: 0x79694a, roughness: 1 }));
          trunk.position.set(x, 0.17, z);
          parkTrees.add(trunk);
          const crown = new THREE.Mesh(crownGeometry, row % 2 ? materials.tree : materials.treeLight);
          crown.position.set(x, 0.51, z);
          crown.scale.set(1, 0.88 + random() * 0.26, 1);
          parkTrees.add(crown);
        }
      }
      scene.add(parkTrees);

      // Main MG FitClub building: multi-floor facade, warm cladding, windows and rooftop sign.
      const club = new THREE.Group();
      club.position.set(-0.55, 0, 1.0);
      scene.add(club);
      const clubWidth = 2.28;
      const clubDepth = 2.0;
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
        scene.add(sprite);
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
      const addPin = (x, z, label, color = 0xc6ff3f, tagScale = 2.6) => {
        const material = color === 0xc6ff3f ? pinMaterial : new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.16 });
        const stem = new THREE.Mesh(pinGeometry, material);
        stem.position.set(x, 0.34, z);
        scene.add(stem);
        const ball = new THREE.Mesh(markerGeometry, material);
        ball.position.set(x, 0.58, z);
        scene.add(ball);
        const ring = new THREE.Mesh(ringGeometry, material);
        ring.position.set(x, 0.045, z);
        ring.rotation.x = Math.PI / 2;
        scene.add(ring);
        const badge = makeTextSprite(label, { scale: tagScale, border: `#${color.toString(16).padStart(6, "0")}` });
        badge.position.set(x, 1.08, z);
        return badge;
      };
      addPin(-5.8, 1.55, "پل احسان", 0xf4a340, 2.15);
      addPin(-5.3, -7.35, "معالی‌آباد", 0xf4a340, 2.45);
      addPin(5.85, 7.6, "فرهنگ‌شهر", 0xf4a340, 2.45);
      addPin(4.65, -5.55, "پارک ملت", 0x84d874, 2.1);

      const dena = makeTextSprite("Dena St", { scale: 1.9, background: "rgba(36, 48, 51, .94)", border: "#b7cbd0", foreground: "#eef2e8", fontSize: 38 });
      dena.position.set(4.5, 0.22, -1.25);
      const baharan = makeTextSprite("Baharan St", { scale: 2.0, background: "rgba(36, 48, 51, .94)", border: "#b7cbd0", foreground: "#eef2e8", fontSize: 37 });
      baharan.position.set(3.8, 0.24, 2.9);
      const rajai = makeTextSprite("50th Rajai", { scale: 2.0, background: "rgba(36, 48, 51, .94)", border: "#b7cbd0", foreground: "#eef2e8", fontSize: 36 });
      rajai.position.set(3.1, 0.24, 6.95);

      const target = new THREE.Vector3(0, 0.1, 0);
      const orbit = { theta: 0.62, phi: 0.94, radius: 33 };
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
          target.z = narrow ? 1.6 : 0;
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
        target.set(0, 0.1, narrow ? 1.6 : 0);
        orbit.theta = 0.62;
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
          target.set(-0.55, 0.8, 1.0);
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
