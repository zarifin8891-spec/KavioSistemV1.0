'use client';

export type MappingPoint = [number, number];

export type AutoMappingResult = {
  polygon: MappingPoint[];
  label: MappingPoint;
  confidence: number;
  area: number;
  bbox: { x: number; y: number; width: number; height: number };
};

type PixelMask = { width: number; height: number; data: Uint8Array };
type Component = {
  pixels: number[];
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const yieldToBrowser = () =>
  new Promise<void>((resolve) => {
    if (typeof window === 'undefined') return resolve();
    window.requestAnimationFrame(() => resolve());
  });

function pixelStats(data: Uint8ClampedArray, index: number) {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const gray = (299 * r + 587 * g + 114 * b) / 1000;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return { r, g, b, gray, chroma };
}

/**
 * Boundary model for the supplied KAVIO Siteplan:
 * lot boundaries are the red/magenta CAD linework.
 * Neutral/grey engineering lines are NOT used as parcel barriers because
 * they connect roads, ROW and other technical details across parcels.
 */
function isParcelBoundaryPixel(data: Uint8ClampedArray, index: number) {
  const { r, g, b } = pixelStats(data, index);
  const red =
    r > 145 &&
    r - g > 55 &&
    r - b > 55 &&
    g < 175 &&
    b < 175;
  const magenta =
    r > 125 &&
    b > 95 &&
    g < 170 &&
    r - g > 30 &&
    b - g > 20;
  return red || magenta;
}

function buildParcelMask(imageData: ImageData): PixelMask {
  const { width, height, data } = imageData;
  const raw = new Uint8Array(width * height);

  for (let i = 0, p = 0; i < raw.length; i += 1, p += 4) {
    raw[i] = isParcelBoundaryPixel(data, p) ? 1 : 0;
  }

  // Thicken red/magenta linework only enough to bridge anti-aliased 1px gaps.
  const dilated = new Uint8Array(raw.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let blocked = 0;
      for (let oy = -1; oy <= 1 && !blocked; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && raw[ny * width + nx]) {
            blocked = 1;
            break;
          }
        }
      }
      dilated[y * width + x] = blocked;
    }
    if (y > 0 && y % 96 === 0) void yieldToBrowser();
  }

  return { width, height, data: dilated };
}

function findOpenSeed(mask: PixelMask, x: number, y: number, radius = 14): [number, number] | null {
  const px = Math.max(0, Math.min(mask.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(mask.height - 1, Math.round(y)));

  if (!mask.data[py * mask.width + px]) return [px, py];

  for (let r = 1; r <= radius; r += 1) {
    for (let oy = -r; oy <= r; oy += 1) {
      for (let ox = -r; ox <= r; ox += 1) {
        const nx = px + ox;
        const ny = py + oy;
        if (nx < 0 || nx >= mask.width || ny < 0 || ny >= mask.height) continue;
        if (!mask.data[ny * mask.width + nx]) return [nx, ny];
      }
    }
  }

  return null;
}

async function floodComponent(mask: PixelMask, seed: [number, number], hardRadius: number): Promise<Component> {
  const { width, height, data } = mask;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const seedIndex = seed[1] * width + seed[0];

  if (data[seedIndex]) {
    return { pixels: [], area: 0, minX: seed[0], minY: seed[1], maxX: seed[0], maxY: seed[1] };
  }

  queue[tail++] = seedIndex;
  visited[seedIndex] = 1;
  const pixels: number[] = [];
  let minX = seed[0];
  let minY = seed[1];
  let maxX = seed[0];
  let maxY = seed[1];
  const radiusSq = hardRadius * hardRadius;

  while (head < tail) {
    const index = queue[head++];
    const y = Math.floor(index / width);
    const x = index - y * width;
    const dx = x - seed[0];
    const dy = y - seed[1];
    if (dx * dx + dy * dy > radiusSq) continue;

    pixels.push(index);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    if (x > 0) {
      const n = index - 1;
      if (!visited[n] && !data[n]) { visited[n] = 1; queue[tail++] = n; }
    }
    if (x < width - 1) {
      const n = index + 1;
      if (!visited[n] && !data[n]) { visited[n] = 1; queue[tail++] = n; }
    }
    if (y > 0) {
      const n = index - width;
      if (!visited[n] && !data[n]) { visited[n] = 1; queue[tail++] = n; }
    }
    if (y < height - 1) {
      const n = index + width;
      if (!visited[n] && !data[n]) { visited[n] = 1; queue[tail++] = n; }
    }

    if (head % 25000 === 0) await yieldToBrowser();
  }

  return { pixels, area: pixels.length, minX, minY, maxX, maxY };
}

type Edge = { a: MappingPoint; b: MappingPoint };

function edgeKey(point: MappingPoint) {
  return point[0] + ':' + point[1];
}

function collectOuterBoundary(component: Component, width: number, height: number): MappingPoint[] {
  const pixelSet = new Set(component.pixels);
  const edges: Edge[] = [];

  for (const index of component.pixels) {
    const y = Math.floor(index / width);
    const x = index - y * width;
    if (y === 0 || !pixelSet.has(index - width)) edges.push({ a: [x, y], b: [x + 1, y] });
    if (x === width - 1 || !pixelSet.has(index + 1)) edges.push({ a: [x + 1, y], b: [x + 1, y + 1] });
    if (y === height - 1 || !pixelSet.has(index + width)) edges.push({ a: [x + 1, y + 1], b: [x, y + 1] });
    if (x === 0 || !pixelSet.has(index - 1)) edges.push({ a: [x, y + 1], b: [x, y] });
  }

  const edgeId = (a: MappingPoint, b: MappingPoint) => {
    const ka = edgeKey(a);
    const kb = edgeKey(b);
    return ka < kb ? ka + '|' + kb : kb + '|' + ka;
  };

  const adjacency = new Map<string, MappingPoint[]>();
  for (const edge of edges) {
    const ka = edgeKey(edge.a);
    const kb = edgeKey(edge.b);
    if (!adjacency.has(ka)) adjacency.set(ka, []);
    if (!adjacency.has(kb)) adjacency.set(kb, []);
    adjacency.get(ka)!.push(edge.b);
    adjacency.get(kb)!.push(edge.a);
  }

  const used = new Set<string>();
  const loops: MappingPoint[][] = [];

  for (const edge of edges) {
    const firstId = edgeId(edge.a, edge.b);
    if (used.has(firstId)) continue;

    const loop: MappingPoint[] = [edge.a];
    let previous = edge.a;
    let current = edge.b;
    used.add(firstId);

    for (let guard = 0; guard < edges.length + 20; guard += 1) {
      loop.push(current);
      if (edgeKey(current) === edgeKey(loop[0])) break;

      const candidates = (adjacency.get(edgeKey(current)) ?? []).filter(
        (point) => !used.has(edgeId(current, point)),
      );
      if (!candidates.length) break;

      const next = candidates.find((point) => edgeKey(point) !== edgeKey(previous)) ?? candidates[0];
      used.add(edgeId(current, next));
      previous = current;
      current = next;
    }

    if (loop.length >= 4 && edgeKey(loop[0]) === edgeKey(loop[loop.length - 1])) {
      loops.push(loop.slice(0, -1));
    }
  }

  const area = (points: MappingPoint[]) => {
    let value = 0;
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      value += x1 * y2 - x2 * y1;
    }
    return Math.abs(value / 2);
  };

  return loops.sort((a, b) => area(b) - area(a))[0] ?? [];
}

function perpendicularDistance(point: MappingPoint, start: MappingPoint, end: MappingPoint) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy);
  const px = start[0] + Math.max(0, Math.min(1, t)) * dx;
  const py = start[1] + Math.max(0, Math.min(1, t)) * dy;
  return Math.hypot(point[0] - px, point[1] - py);
}

function simplifyRdp(points: MappingPoint[], epsilon: number): MappingPoint[] {
  if (points.length <= 4) return points;

  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance > epsilon) {
    const left = simplifyRdp(points.slice(0, index + 1), epsilon);
    const right = simplifyRdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function simplifyClosed(points: MappingPoint[], epsilon: number) {
  if (points.length < 8) return points;
  return simplifyRdp(points.concat([points[0]]), epsilon).slice(0, -1);
}

function polygonArea(points: MappingPoint[]) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

function bbox(points: MappingPoint[]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function pointInPolygon(point: MappingPoint, polygon: MappingPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi || 1e-9) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function segmentsIntersect(a: MappingPoint, b: MappingPoint, c: MappingPoint, d: MappingPoint) {
  const cross = (p: MappingPoint, q: MappingPoint, r: MappingPoint) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);

  const onSegment = (p: MappingPoint, q: MappingPoint, r: MappingPoint) =>
    Math.min(p[0], r[0]) <= q[0] + 0.5 &&
    q[0] <= Math.max(p[0], r[0]) + 0.5 &&
    Math.min(p[1], r[1]) <= q[1] + 0.5 &&
    q[1] <= Math.max(p[1], r[1]) + 0.5;

  const c1 = cross(a, b, c);
  const c2 = cross(a, b, d);
  const c3 = cross(c, d, a);
  const c4 = cross(c, d, b);

  if (
    ((c1 > 0 && c2 < 0) || (c1 < 0 && c2 > 0)) &&
    ((c3 > 0 && c4 < 0) || (c3 < 0 && c4 > 0))
  ) return true;

  return (
    (Math.abs(c1) < 0.5 && onSegment(a, c, b)) ||
    (Math.abs(c2) < 0.5 && onSegment(a, d, b)) ||
    (Math.abs(c3) < 0.5 && onSegment(c, a, d)) ||
    (Math.abs(c4) < 0.5 && onSegment(c, b, d))
  );
}

export function polygonsConflict(a: MappingPoint[], b: MappingPoint[]) {
  if (a.length < 3 || b.length < 3) return false;

  const ba = bbox(a);
  const bb = bbox(b);
  if (
    ba.x + ba.width < bb.x ||
    bb.x + bb.width < ba.x ||
    ba.y + ba.height < bb.y ||
    bb.y + bb.height < ba.y
  ) return false;

  if (pointInPolygon(a[0], b) || pointInPolygon(b[0], a)) return true;

  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j += 1) {
      if (segmentsIntersect(a1, a2, b[j], b[(j + 1) % b.length])) return true;
    }
  }

  return false;
}

function nearestParcelHit(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  searchRadius = 2,
) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  let best: number | null = null;

  for (let oy = -searchRadius; oy <= searchRadius; oy += 1) {
    for (let ox = -searchRadius; ox <= searchRadius; ox += 1) {
      const nx = ix + ox;
      const ny = iy + oy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const p = (ny * width + nx) * 4;
      if (isParcelBoundaryPixel(data, p)) {
        const d = ox * ox + oy * oy;
        if (best === null || d < best) best = d;
      }
    }
  }

  return best;
}

function radialBoundary(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
) {
  const samples = 180;
  const maxDistance = 520;
  const distances: Array<number | null> = new Array(samples).fill(null);

  for (let i = 0; i < samples; i += 1) {
    const theta = (i / samples) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    for (let distance = 8; distance <= maxDistance; distance += 1) {
      const x = seedX + cos * distance;
      const y = seedY + sin * distance;
      if (x < 0 || x >= width || y < 0 || y >= height) break;

      if (nearestParcelHit(data, width, height, x, y, 2) !== null) {
        distances[i] = distance;
        break;
      }
    }
  }

  const finite = distances.filter((value): value is number => value !== null);
  if (finite.length < samples * 0.55) return null;

  // Robust smoothing: internal red labels are local outliers; parcel edges are
  // spatially coherent across neighbouring rays.
  const smoothed = distances.map((value, i) => {
    const window: number[] = [];
    for (let k = -4; k <= 4; k += 1) {
      const candidate = distances[(i + k + samples) % samples];
      if (candidate !== null) window.push(candidate);
    }
    if (window.length < 4) return value;
    window.sort((a, b) => a - b);
    const median = window[Math.floor(window.length / 2)];
    if (value === null) return median;
    return Math.abs(value - median) > Math.max(12, median * 0.22) ? median : value;
  });

  const points: MappingPoint[] = [];
  for (let i = 0; i < samples; i += 3) {
    const distance = smoothed[i];
    if (distance === null) continue;
    const theta = (i / samples) * Math.PI * 2;
    points.push([
      Math.round(seedX + Math.cos(theta) * distance),
      Math.round(seedY + Math.sin(theta) * distance),
    ]);
  }

  if (points.length < 20) return null;

  const simplified = simplifyClosed(points, 3.5);
  if (simplified.length < 6) return null;
  if (!pointInPolygon([Math.round(seedX), Math.round(seedY)], simplified)) return null;

  return simplified;
}

async function floodDetect(
  context: CanvasRenderingContext2D,
  imageWidth: number,
  imageHeight: number,
  seedX: number,
  seedY: number,
) {
  const radii = [180, 260, 360, 480, 620];
  for (const radius of radii) {
    const x0 = Math.max(0, Math.round(seedX) - radius);
    const y0 = Math.max(0, Math.round(seedY) - radius);
    const x1 = Math.min(imageWidth, Math.round(seedX) + radius + 1);
    const y1 = Math.min(imageHeight, Math.round(seedY) + radius + 1);
    const width = x1 - x0;
    const height = y1 - y0;

    const imageData = context.getImageData(x0, y0, width, height);
    const mask = buildParcelMask(imageData);
    const localSeed = findOpenSeed(mask, Math.round(seedX) - x0, Math.round(seedY) - y0, 18);
    if (!localSeed) continue;

    const component = await floodComponent(mask, localSeed, radius);
    const boundary = collectOuterBoundary(component, width, height);
    if (component.area < 1200 || boundary.length < 8) continue;

    const polygon = simplifyClosed(
      boundary.map(([x, y]) => [x + x0, y + y0] as MappingPoint),
      3.0,
    );

    if (polygon.length < 6) continue;
    if (!pointInPolygon([Math.round(seedX), Math.round(seedY)], polygon)) continue;

    const area = polygonArea(polygon);
    const ratio = area / Math.max(1, Math.PI * radius * radius);
    if (ratio < 0.025 || ratio > 0.92) continue;

    return polygon;
  }
  return null;
}

export async function detectLotPolygon(
  image: HTMLImageElement,
  seedX: number,
  seedY: number,
  options: { conflictPolygons?: MappingPoint[][] } = {},
): Promise<AutoMappingResult> {
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('Gambar Siteplan belum siap dibaca. Tunggu sampai Siteplan selesai dimuat.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas context tidak tersedia.');

  context.drawImage(image, 0, 0);
  await yieldToBrowser();

  const clampedX = Math.max(0, Math.min(canvas.width - 1, seedX));
  const clampedY = Math.max(0, Math.min(canvas.height - 1, seedY));

  let polygon = await floodDetect(context, canvas.width, canvas.height, clampedX, clampedY);

  // Fallback is still geometry-driven: trace the nearest coherent red/magenta
  // boundary in multiple directions rather than inventing fixed lot coordinates.
  if (!polygon) {
    const localRadius = 600;
    const x0 = Math.max(0, Math.round(clampedX) - localRadius);
    const y0 = Math.max(0, Math.round(clampedY) - localRadius);
    const x1 = Math.min(canvas.width, Math.round(clampedX) + localRadius + 1);
    const y1 = Math.min(canvas.height, Math.round(clampedY) + localRadius + 1);
    const imageData = context.getImageData(x0, y0, x1 - x0, y1 - y0);
    polygon = radialBoundary(
      imageData.data,
      imageData.width,
      imageData.height,
      clampedX - x0,
      clampedY - y0,
    )?.map(([x, y]) => [x + x0, y + y0] as MappingPoint) ?? null;
  }

  if (!polygon) {
    throw new Error('Batas kavling belum berhasil ditemukan. Klik benar-benar di area putih bagian dalam kavling.');
  }

  const conflict = (options.conflictPolygons ?? []).some((other) => polygonsConflict(polygon!, other));
  if (conflict) {
    throw new Error('Hasil Auto Detect bertabrakan dengan mapping kavling yang sudah tersimpan. Mapping tidak disimpan.');
  }

  const area = polygonArea(polygon);
  const bb = bbox(polygon);
  const spread = Math.max(bb.width, bb.height);

  const confidence = Math.max(
    55,
    Math.min(
      99,
      Math.round(96 - Math.max(0, spread - 120) / 22),
    ),
  );

  return {
    polygon,
    label: [Math.round(clampedX), Math.round(clampedY)],
    confidence,
    area,
    bbox: bb,
  };
}
