/**
 * Saker Energy — dependency-free, projected 3D architectural scene.
 * All geometry is authored here. No model, image, font, GPU, or CDN dependency.
 * This is an illustrative station; its colors are presentation states, not telemetry.
 */
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const noop = () => {};

export function createStationScene(canvas, options = {}) {
  const empty = { setScenario: noop, setFocus: noop, setView: noop, reset: noop, zoom: noop, setAutoRotate: noop, destroy: noop };
  if (!canvas || typeof canvas.getContext !== 'function') return empty;
  let context;
  try { context = canvas.getContext('2d', { alpha: true }); } catch { /* Graceful fallback below. */ }
  if (!context) {
    canvas.setAttribute('aria-label', '充储场站示意：12 个充电终端、1 MWh 储能、500 kW PCS。当前浏览器不支持交互画布。');
    const fallback = document.createElement('p');
    fallback.className = 'scene-fallback';
    fallback.textContent = '12 个充电终端 · 1 MWh 储能 · 500 kW PCS';
    canvas.insertAdjacentElement('afterend', fallback);
    return { ...empty, destroy() { fallback.remove(); } };
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reducedMotion.matches;
  let width = 1;
  let height = 1;
  let scale = 1;
  let dpr = 1;
  let yaw = -0.52;
  let pitch = 0.58;
  let targetYaw = yaw;
  let targetPitch = pitch;
  let zoomLevel = 1;
  let scenario = 'normal';
  let focus = 'all';
  let automatic = !reduced;
  let visible = true;
  let destroyed = false;
  let animationFrame = 0;
  let lastFrame = 0;
  let lastInteraction = 0;
  let animationTime = 0;
  let pointer = null;
  let faces = [];
  let lines = [];
  let ground = [];
  let hitAreas = [];
  const removers = [];
  const surface = '#f4f4ec';
  const dark = '#254139';
  const accent = '#c6ed80';
  const warning = '#eea052';

  const listen = (target, event, handler, settings) => {
    target.addEventListener(event, handler, settings);
    removers.push(() => target.removeEventListener(event, handler, settings));
  };

  const color = (value, amount = 1) => {
    const rgb = value.slice(1).match(/.{2}/g).map(v => parseInt(v, 16));
    return `rgb(${rgb.map(v => Math.round(clamp(v * amount, 0, 255))).join(' ')})`;
  };

  function polygon(points, fill, group = '', details = {}) {
    faces.push({ points, fill, group, ...details });
  }

  function line(points, stroke, lineWidth = 1, group = '', details = {}) {
    lines.push({ points, stroke, lineWidth, group, ...details });
  }

  function cuboid(x, y, z, w, h, d, fill, group = '', details = {}) {
    const p = [
      [x - w / 2, y, z - d / 2], [x + w / 2, y, z - d / 2],
      [x + w / 2, y, z + d / 2], [x - w / 2, y, z + d / 2],
      [x - w / 2, y + h, z - d / 2], [x + w / 2, y + h, z - d / 2],
      [x + w / 2, y + h, z + d / 2], [x - w / 2, y + h, z + d / 2],
    ];
    const specifications = [[0, 1, 5, 4, 0.69], [1, 2, 6, 5, 0.82], [2, 3, 7, 6, 0.91], [3, 0, 4, 7, 0.77], [4, 5, 6, 7, 1.04]];
    for (const [a, b, c, dIndex, shade] of specifications) polygon([p[a], p[b], p[c], p[dIndex]], color(fill, shade), group, details);
  }

  function groundPolygon(points, fill, stroke = null, lineWidth = 1) {
    ground.push({ points, fill, stroke, lineWidth });
  }

  function surfaceRectangle(x, z, w, d, fill, stroke = null) {
    groundPolygon([[x - w / 2, 0.015, z - d / 2], [x + w / 2, 0.015, z - d / 2], [x + w / 2, 0.015, z + d / 2], [x - w / 2, 0.015, z + d / 2]], fill, stroke);
  }

  function tree(x, z, size = 1) {
    cuboid(x, 0, z, 0.17 * size, 1.3 * size, 0.17 * size, '#a4a58b');
    const radius = 0.65 * size;
    const tiers = [0, 0.55, 1.1, 1.55];
    const radii = [0.4, 1, 0.78, 0.08];
    for (let tier = 0; tier < tiers.length - 1; tier++) {
      for (let segment = 0; segment < 7; segment++) {
        const a = segment / 7 * TAU;
        const b = (segment + 1) / 7 * TAU;
        const lo = 0.75 * size + tiers[tier] * size;
        const hi = 0.75 * size + tiers[tier + 1] * size;
        polygon([
          [x + Math.cos(a) * radius * radii[tier], lo, z + Math.sin(a) * radius * radii[tier]],
          [x + Math.cos(b) * radius * radii[tier], lo, z + Math.sin(b) * radius * radii[tier]],
          [x + Math.cos(b) * radius * radii[tier + 1], hi, z + Math.sin(b) * radius * radii[tier + 1]],
          [x + Math.cos(a) * radius * radii[tier + 1], hi, z + Math.sin(a) * radius * radii[tier + 1]],
        ], ['#759483', '#839d87', '#658773', '#6b8e79', '#a0b48b', '#8fa67e', '#799777'][segment]);
      }
    }
  }

  function car(x, z, paint) {
    cuboid(x, 0.15, z, 1.28, 0.42, 2.5, paint, 'charging');
    cuboid(x, 0.56, z - 0.08, 1.13, 0.44, 1.45, '#384f4a', 'charging');
    cuboid(x, 0.99, z - 0.13, 1.10, 0.06, 0.88, paint, 'charging');
    cuboid(x, 0.40, z + 1.26, 1.12, 0.08, 0.025, '#e8efd8', 'charging');
    cuboid(x, 0.37, z - 1.26, 0.92, 0.07, 0.025, '#b8c5b4', 'charging');
    for (const offsetX of [-0.66, 0.66]) {
      for (const offsetZ of [-0.77, 0.77]) {
        cuboid(x + offsetX, 0.07, z + offsetZ, 0.13, 0.35, 0.43, '#344039', 'charging');
        cuboid(x + offsetX * 1.02, 0.12, z + offsetZ, 0.14, 0.24, 0.28, '#8d9b91', 'charging');
      }
    }
  }

  function buildModel() {
    faces = [];
    lines = [];
    ground = [];
    const chargeColor = scenario === 'charger' ? warning : accent;
    const batteryColor = scenario === 'battery' ? warning : accent;
    const gridColor = scenario === 'grid' ? warning : accent;

    // The plinth is rendered separately so distant buildings cannot be occluded by it.
    surfaceRectangle(0, 0, 21.2, 13.4, '#eceee6');
    surfaceRectangle(-3.2, -0.7, 12.6, 10.0, '#e2e7de');
    surfaceRectangle(6.25, -0.1, 5.3, 10.9, '#e5e8df');
    surfaceRectangle(-3.2, 4.2, 12.5, 1.45, '#d7ded4');
    surfaceRectangle(2.9, -0.1, 0.30, 11.5, '#c4d2bc');
    for (let i = 0; i < 6; i++) {
      const x = -8 + i * 1.9;
      for (const z of [-3.1, 1.35]) {
        surfaceRectangle(x, z + 1.32, 1.65, 2.75, '#e8ede1', '#c1cdbb');
        surfaceRectangle(x, z + 2.62, 1.65, 0.08, '#adbfa2');
      }
    }
    for (let x = -8; x <= 1; x += 2.0) surfaceRectangle(x, 5.5, 0.9, 0.07, '#fcfcf5');
    for (const x of [-9.8, 9.7]) {
      for (const z of [-5.7, 5.7]) {
        surfaceRectangle(x, z, 0.9, 0.85, '#c9d8be');
        tree(x, z, z < 0 ? 1.05 : 0.82);
      }
    }

    // Exactly twelve 120 kW charging terminals, arranged in two banks.
    for (let row = 0; row < 2; row++) {
      const z = row ? 1.35 : -3.1;
      for (let column = 0; column < 6; column++) {
        const x = -8 + column * 1.9;
        const selected = scenario === 'charger' && row === 1 && column === 2;
        cuboid(x, 0.025, z, 0.66, 0.13, 0.57, '#aab9ab', 'charging');
        cuboid(x, 0.15, z, 0.50, 1.27, 0.39, '#f2f4e9', 'charging');
        cuboid(x, 0.96, z + 0.205, 0.34, 0.33, 0.025, '#294d40', 'charging');
        cuboid(x, 0.16, z + 0.205, 0.45, 0.16, 0.025, selected ? warning : '#9bab96', 'charging');
        cuboid(x, 1.45, z, 0.53, 0.055, 0.42, selected ? warning : chargeColor, 'charging');
        line([[x + 0.28, 1.08, z], [x + 0.44, 0.98, z + 0.16], [x + 0.48, 0.29, z + 0.28], [x + 0.27, 0.27, z + 0.32]], '#364b3d', 1.8, 'charging');
      }
    }

    // Two photovoltaic canopies, with individually drawn panel seams and steel supports.
    for (const z of [-4.05, 0.4]) {
      for (const x of [-8.6, 2.05]) cuboid(x, 0, z, 0.13, 2.65, 0.13, '#9daea0', 'charging');
      cuboid(-3.27, 2.63, z, 11.55, 0.16, 1.9, '#b8c5b2', 'charging');
      cuboid(-3.27, 2.80, z, 11.35, 0.06, 1.75, '#21483d', 'charging');
      for (let i = 0; i <= 12; i++) {
        const x = -8.91 + i * 0.94;
        line([[x, 2.87, z - 0.83], [x, 2.87, z + 0.83]], '#6e9180', 0.55, 'charging');
      }
      for (let i = 0; i <= 3; i++) {
        const zz = z - 0.83 + i * 0.55;
        line([[-8.91, 2.87, zz], [2.37, 2.87, zz]], '#6e9180', 0.55, 'charging');
      }
      line([[-8.98, 2.76, z + 0.97], [2.45, 2.76, z + 0.97]], '#d9eca6', 1.9, 'charging');
    }

    car(-6.05, 3.13, '#fafbf1');
    car(-0.37, 3.13, '#9daf96');

    // Battery enclosure, ribbed doors, vents, status strip, and adjacent PCS.
    cuboid(6.15, 0.025, -2.60, 4.52, 0.20, 3.1, '#bac6b7', 'storage');
    cuboid(6.15, 0.23, -2.60, 4.15, 2.10, 2.65, surface, 'storage');
    cuboid(6.15, 2.33, -2.60, 4.27, 0.10, 2.77, '#d4dece', 'storage');
    cuboid(6.15, 0.29, -1.26, 4.12, 0.12, 0.04, batteryColor, 'storage');
    for (let i = 0; i < 12; i++) {
      const x = 4.18 + i * 0.36;
      line([[x, 0.53, -1.265], [x, 2.11, -1.265]], '#c0ccbd', 1.15, 'storage');
    }
    cuboid(6.06, 1.30, -1.22, 1.13, 0.43, 0.06, dark, 'storage');
    for (let i = 0; i < 7; i++) cuboid(8.24, 0.67 + i * 0.17, -2.45, 0.035, 0.035, 1.66, '#aebdac', 'storage');
    cuboid(5.18, 0.05, 1.06, 1.65, 1.58, 1.09, '#e3eadd', 'storage');
    cuboid(5.18, 1.63, 1.06, 1.72, 0.09, 1.16, '#a8b8a0', 'storage');
    cuboid(5.18, 1.15, 1.62, 0.43, 0.26, 0.02, '#385644', 'storage');
    for (let i = 0; i < 5; i++) cuboid(5.18, 0.35 + i * 0.11, 1.62, 1.2, 0.025, 0.02, '#9dac99', 'storage');

    // Read-only grid metering / switchgear representation; no device control UI.
    cuboid(7.53, 0.035, 3.78, 2.21, 0.16, 1.4, '#b8c4b0', 'grid');
    cuboid(7.53, 0.2, 3.78, 1.98, 1.74, 1.15, '#d3dfca', 'grid');
    cuboid(7.53, 1.94, 3.78, 2.06, 0.10, 1.23, '#839b7b', 'grid');
    cuboid(7.53, 1.25, 4.37, 0.62, 0.30, 0.025, '#304d39', 'grid');
    cuboid(7.53, 0.24, 4.37, 1.91, 0.07, 0.035, gridColor, 'grid');
    line([[7.53, 0.42, 4.375], [7.53, 1.08, 4.375]], '#a1b397', 0.9, 'grid');
    cuboid(8.8, 0, -0.1, 0.10, 3.25, 0.1, '#9dad96');
    cuboid(8.58, 3.25, -0.1, 0.61, 0.06, 0.23, '#e7ecdd');
  }

  function project([x, y, z]) {
    const cosine = Math.cos(yaw);
    const sine = Math.sin(yaw);
    const rx = x * cosine - z * sine;
    const rz = x * sine + z * cosine;
    return {
      x: width * 0.49 + rx * scale,
      y: height * 0.55 + (rz * Math.sin(pitch) - y * Math.cos(pitch)) * scale,
      depth: rz * Math.cos(pitch) + y * Math.sin(pitch),
    };
  }

  function path(points) {
    context.beginPath();
    points.forEach((point, index) => {
      const p = project(point);
      if (index) context.lineTo(p.x, p.y);
      else context.moveTo(p.x, p.y);
    });
  }

  function drawFace(face) {
    path(face.points);
    context.closePath();
    const dimmed = focus !== 'all' && face.group && face.group !== focus;
    context.globalAlpha = dimmed ? 0.48 : 1;
    context.fillStyle = face.fill;
    context.fill();
    // A fine same-color stroke closes subpixel seams between adjacent mesh faces.
    context.lineWidth = 0.52;
    context.strokeStyle = face.fill;
    context.stroke();
    context.globalAlpha = 1;
  }

  function drawRoute(points, shade, time, opacity = 1) {
    const projected = points.map(project);
    context.save();
    context.globalAlpha = opacity;
    context.beginPath();
    projected.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.strokeStyle = shade;
    context.lineWidth = 1.8;
    context.lineJoin = 'round';
    context.stroke();
    const lengths = projected.slice(1).map((p, i) => Math.hypot(p.x - projected[i].x, p.y - projected[i].y));
    const total = lengths.reduce((sum, value) => sum + value, 0);
    for (let dot = 0; dot < 3; dot++) {
      let distance = (((time * 0.11 + dot / 3) % 1) + 1) % 1 * total;
      for (let segment = 0; segment < lengths.length; segment++) {
        if (distance <= lengths[segment]) {
          const ratio = lengths[segment] ? distance / lengths[segment] : 0;
          const p = projected[segment];
          const next = projected[segment + 1];
          const x = mix(p.x, next.x, ratio);
          const y = mix(p.y, next.y, ratio);
          context.shadowColor = shade;
          context.shadowBlur = 9;
          context.fillStyle = '#f8ffe8';
          context.beginPath();
          context.arc(x, y, 2.5, 0, TAU);
          context.fill();
          break;
        }
        distance -= lengths[segment];
      }
    }
    context.restore();
  }

  function roundedRect(x, y, w, h, radius = 6) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + w, y, x + w, y + h, radius);
    context.arcTo(x + w, y + h, x, y + h, radius);
    context.arcTo(x, y + h, x, y, radius);
    context.arcTo(x, y, x + w, y, radius);
    context.closePath();
  }

  function label(anchor, text, group, offsetX, offsetY) {
    const p = project(anchor);
    const active = focus === 'all' || focus === group;
    const fault = (scenario === 'charger' && group === 'charging') || (scenario === 'battery' && group === 'storage') || (scenario === 'grid' && group === 'grid');
    const shade = fault ? '#c97b37' : '#698454';
    const fontSize = width < 500 ? 9 : 10;
    context.font = `600 ${fontSize}px system-ui, sans-serif`;
    const boxWidth = context.measureText(text).width + 28;
    const x = clamp(p.x + offsetX - boxWidth / 2, 8, width - boxWidth - 8);
    const y = clamp(p.y + offsetY, 8, height - 34);
    context.save();
    context.globalAlpha = active ? 1 : 0.55;
    context.beginPath();
    context.moveTo(p.x, p.y);
    context.lineTo(p.x, y + 26);
    context.lineTo(x + boxWidth / 2, y + 26);
    context.strokeStyle = fault ? '#d3ab86' : '#a8b8a0';
    context.lineWidth = 0.8;
    context.stroke();
    roundedRect(x, y, boxWidth, 26, 5);
    context.fillStyle = 'rgba(251,252,244,.95)';
    context.shadowColor = 'rgba(32,60,36,.08)';
    context.shadowBlur = 10;
    context.shadowOffsetY = 3;
    context.fill();
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.strokeStyle = 'rgba(130,151,114,.25)';
    context.stroke();
    context.beginPath();
    context.fillStyle = shade;
    context.arc(x + 10, y + 13, 2.4, 0, TAU);
    context.fill();
    context.fillStyle = '#41513a';
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText(text, x + 18, y + 13);
    context.restore();
    hitAreas.push({ x, y, w: boxWidth, h: 26, group, anchor: p });
  }

  function draw() {
    if (destroyed) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    scale = Math.min(width / 27.8, height / 19) * zoomLevel;
    // Soft ambient contact shadow preserves the CSS background rather than painting a rectangle.
    context.save();
    context.translate(width * 0.5, height * 0.62);
    context.scale(1, 0.36);
    const shadow = context.createRadialGradient(0, 0, 1, 0, 0, Math.min(width * 0.42, scale * 12));
    shadow.addColorStop(0, 'rgba(60,82,52,.18)');
    shadow.addColorStop(0.5, 'rgba(69,85,54,.08)');
    shadow.addColorStop(1, 'rgba(69,85,54,0)');
    context.fillStyle = shadow;
    context.fillRect(-width / 2, -height, width, height * 2);
    context.restore();

    // Foundation sides are always beneath all ground marks and upright geometry.
    const corners = [[-10.6, 0, -6.7], [10.6, 0, -6.7], [10.6, 0, 6.7], [-10.6, 0, 6.7]];
    const sides = corners.map((corner, index) => {
      const next = corners[(index + 1) % 4];
      return { points: [[corner[0], -0.38, corner[2]], [next[0], -0.38, next[2]], next, corner], fill: index % 2 ? '#c7d0c0' : '#d5dccf' };
    });
    sides.sort((a, b) => a.points.reduce((sum, p) => sum + project(p).depth, 0) - b.points.reduce((sum, p) => sum + project(p).depth, 0)).forEach(drawFace);
    for (const item of ground) {
      path(item.points);
      context.closePath();
      context.fillStyle = item.fill;
      context.fill();
      if (item.stroke) {
        context.lineWidth = item.lineWidth;
        context.strokeStyle = item.stroke;
        context.stroke();
      }
    }
    const time = reduced ? 0.3 : animationTime;
    drawRoute([[7.5, 0.05, 3.7], [6.4, 0.05, 2.6], [3.1, 0.05, 2.6], [3.1, 0.05, -1.6], [5.1, 0.05, -1.6]], scenario === 'grid' ? '#d19b60' : '#93af6d', time, 0.9);
    drawRoute([[5.2, 0.06, 1.05], [3.1, 0.06, 1.05], [3.1, 0.06, 4.6], [-8.1, 0.06, 4.6]], scenario === 'battery' ? '#d19b60' : '#a8c47b', -time, 0.9);

    const primitives = [
      ...faces.map(face => ({ ...face, depth: face.points.reduce((sum, point) => sum + project(point).depth, 0) / face.points.length })),
      ...lines.map(item => ({ ...item, isLine: true, depth: item.points.reduce((sum, point) => sum + project(point).depth, 0) / item.points.length + 0.02 })),
    ].sort((a, b) => a.depth - b.depth);
    for (const primitive of primitives) {
      if (!primitive.isLine) drawFace(primitive);
      else {
        context.globalAlpha = focus !== 'all' && primitive.group && primitive.group !== focus ? 0.4 : 1;
        path(primitive.points);
        context.strokeStyle = primitive.stroke;
        context.lineWidth = primitive.lineWidth;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.stroke();
        context.globalAlpha = 1;
      }
    }
    hitAreas = [];
    label([-5.0, 2.9, -4.1], 'CHARGING · 12 × 120 kW', 'charging', -12, -40);
    label([6.0, 2.5, -2.6], 'STORAGE · 1 MWh', 'storage', 20, -42);
    label([7.5, 2.1, 3.7], 'PCS · 500 kW', 'grid', 13, -39);

    if (scenario !== 'normal') {
      const anchor = scenario === 'charger' ? [-4.2, 1.65, 1.35] : scenario === 'battery' ? [6.2, 2.8, -2.6] : [7.5, 2.3, 3.7];
      const point = project(anchor);
      const pulse = reduced ? 0.5 : (Math.sin(animationTime * 2.8) + 1) / 2;
      context.beginPath();
      context.arc(point.x, point.y, 7 + pulse * 4, 0, TAU);
      context.fillStyle = `rgba(237,160,82,${0.12 + pulse * 0.12})`;
      context.fill();
      context.beginPath();
      context.arc(point.x, point.y, 3.7, 0, TAU);
      context.fillStyle = warning;
      context.fill();
    }
  }

  function shouldAnimate() {
    return !destroyed && visible && !document.hidden && !reduced;
  }

  function tick(now) {
    animationFrame = 0;
    if (!shouldAnimate()) return;
    if (now - lastFrame < 30) {
      animationFrame = requestAnimationFrame(tick);
      return;
    }
    const delta = Math.min((now - lastFrame) / 1000 || 0.033, 0.1);
    lastFrame = now;
    animationTime += delta;
    if (!pointer && automatic && now - lastInteraction > 2400) {
      const drift = Math.sin(animationTime * 0.15) * 0.055;
      yaw = mix(yaw, targetYaw + drift, 0.08);
    } else yaw = mix(yaw, targetYaw, 0.18);
    pitch = mix(pitch, targetPitch, 0.18);
    draw();
    animationFrame = requestAnimationFrame(tick);
  }

  function refresh() {
    if (destroyed) return;
    if (reduced) { yaw = targetYaw; pitch = targetPitch; }
    draw();
    if (shouldAnimate() && !animationFrame) animationFrame = requestAnimationFrame(tick);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(bounds.width || canvas.clientWidth || 720, 1);
    height = Math.max(bounds.height || canvas.clientHeight || 560, 1);
    dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    refresh();
  }

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  else listen(window, 'resize', resize);
  const intersectionObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) refresh();
    else if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = 0; }
  }, { rootMargin: '80px' }) : null;
  if (intersectionObserver) intersectionObserver.observe(canvas);

  listen(document, 'visibilitychange', () => {
    if (document.hidden && animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = 0; }
    else refresh();
  });
  const motionChange = event => {
    reduced = event.matches;
    if (reduced && animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = 0; }
    refresh();
  };
  if (typeof reducedMotion.addEventListener === 'function') listen(reducedMotion, 'change', motionChange);

  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
  if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', '仿真充储场站三维模型，拖动或使用左右方向键旋转，加减键缩放，R 键复位。可点击充电、储能与供电标签。');

  listen(canvas, 'pointerdown', event => {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, horizontal: event.pointerType !== 'touch', touch: event.pointerType === 'touch' };
    lastInteraction = performance.now();
    canvas.style.cursor = 'grabbing';
    if (!pointer.touch) canvas.setPointerCapture?.(event.pointerId);
  });
  listen(canvas, 'pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const totalX = event.clientX - pointer.startX;
    const totalY = event.clientY - pointer.startY;
    if (pointer.touch && !pointer.horizontal) {
      if (Math.abs(totalX) > 8 && Math.abs(totalX) > Math.abs(totalY) * 1.2) {
        pointer.horizontal = true;
        canvas.setPointerCapture?.(event.pointerId);
      } else return;
    }
    const dx = event.clientX - pointer.x;
    targetYaw += dx * 0.008;
    yaw = targetYaw;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.moved = pointer.moved || Math.abs(totalX) > 5 || Math.abs(totalY) > 5;
    lastInteraction = performance.now();
    refresh();
  });
  const finishPointer = event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const finished = pointer;
    pointer = null;
    canvas.style.cursor = 'grab';
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (event.type === 'pointerup' && !finished.moved && Math.hypot(event.clientX - finished.startX, event.clientY - finished.startY) < 7) {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const match = hitAreas.find(area => (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) || Math.hypot(area.anchor.x - x, area.anchor.y - y) < 30);
      if (match) { focus = match.group; options.onSelect?.(match.group); refresh(); }
    }
  };
  listen(canvas, 'pointerup', finishPointer);
  listen(canvas, 'pointercancel', finishPointer);
  listen(canvas, 'lostpointercapture', event => {
    if (pointer?.id === event.pointerId) { pointer = null; canvas.style.cursor = 'grab'; }
  });
  listen(canvas, 'keydown', event => {
    let handled = true;
    if (event.key === 'ArrowLeft') targetYaw -= 0.12;
    else if (event.key === 'ArrowRight') targetYaw += 0.12;
    else if (event.key === '+' || event.key === '=') zoomLevel = clamp(zoomLevel + 0.1, 0.7, 1.5);
    else if (event.key === '-') zoomLevel = clamp(zoomLevel - 0.1, 0.7, 1.5);
    else if (event.key.toLowerCase() === 'r') { targetYaw = -0.52; targetPitch = 0.58; zoomLevel = 1; }
    else handled = false;
    if (handled) { event.preventDefault(); lastInteraction = performance.now(); refresh(); }
  });

  buildModel();
  resize();
  options.onReady?.();

  return {
    setScenario(id) {
      if (!['normal', 'charger', 'battery', 'grid'].includes(id)) return;
      scenario = id;
      canvas.dataset.scenario = id;
      buildModel();
      refresh();
    },
    setFocus(id) {
      if (!['all', 'charging', 'storage', 'grid'].includes(id)) return;
      focus = id;
      canvas.dataset.focus = id;
      refresh();
    },
    setView(id) {
      const views = { iso: [-0.52, 0.58], top: [-0.12, 1.23], front: [-0.07, 0.35] };
      if (!views[id]) return;
      [targetYaw, targetPitch] = views[id];
      canvas.dataset.view = id;
      lastInteraction = performance.now();
      refresh();
    },
    reset() {
      targetYaw = -0.52;
      targetPitch = 0.58;
      zoomLevel = 1;
      focus = 'all';
      lastInteraction = performance.now();
      refresh();
    },
    zoom(delta) {
      if (!Number.isFinite(delta)) return;
      zoomLevel = clamp(zoomLevel + delta, 0.7, 1.5);
      lastInteraction = performance.now();
      refresh();
    },
    setAutoRotate(value) { automatic = Boolean(value); refresh(); },
    destroy() {
      destroyed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      removers.forEach(remove => remove());
      faces = []; lines = []; ground = []; hitAreas = [];
    },
  };
}
