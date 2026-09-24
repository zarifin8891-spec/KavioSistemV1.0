'use client';

export type MappingPoint = [number, number];

export type AutoMappingResult = {
  polygon: MappingPoint[];
  label: MappingPoint;
  confidence: number;
  area: number;
  bbox: { x: number; y: number; width: number; height: number };
};

type PixelMask = {
  width: number;
  height: number;
  data: Uint8Array;
};

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
  return { gray, chroma };
}

/**
 * KAVIO Auto Mapping V4
 *
 * The reliable historical implementation used the complete Siteplan ink,
 * not a single color. That is important because the lot boundaries in the
 * current drawing are a mix of red parcel lines, dark CAD lines and thin
 * anti-aliased strokes.
 *
 * Text inside a lot is harmless here: flood-fill finds the connected WHITE
 * face containing the click, and the outer boundary of that face is used.
 */
function buildInkBarrierMask(imageData: ImageData): PixelMask {
  const { width, height, data } = imageData;
  const raw = new Uint8Array(width * height);

  for (let i = 0, p = 0; i < raw.length; i += 1, p += 4) {
    const { gray, chroma } = pixelStats(data, p);

    // Same core idea as the historical working engine:
    // anything visibly inked becomes a barrier; near-white paper stays open.
    raw[i] = gray < 245 || chroma > 14 ? 1 : 0;
  }

  // One-pixel dilation closes tiny anti-aliased gaps without creating a wide
  // synthetic boundary that could swallow neighbouring lots.
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
    if (y > 0 && y % 96 === 0) await yieldToBrowser();
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

async function floodComponent(
  mask: PixelMask,
  seed: [number, number],
): Promise<Component> {
  const { width, height, data } = mask;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const seedIndex = seed[1] * width + seed[0];

  if (data[seedIndex]) {
    return {
      pixels: [],
      area: 0,
      minX: seed[0],
      minY: seed[1],
      maxX: seed[0],
      maxY: seed[1],
    };
  }

  queue[tail++] = seedIndex;
  visited[seedIndex] = 1;

  const pixels: number[] = [];
  let minX = seed[0];
  let minY = seed[1];
  let maxX = seed[0];
  let maxY = seed[1];

  while (head < tail) {
    const index = queue[head++];
    const y = Math.floor(index / width);
    const x = index - y * width;

    pixels.push(index);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    if (x > 0) {
      const n = index - 1;
      if (!visited[n] && !data[n]) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (x < width - 1) {
      const n = index + 1;
      if (!visited[n] && !data[n]) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (y > 0) {
      const n = index - width;
      if (!visited[n] && !data[n]) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (y < height - 1) {
      const n = index + width;
      if (!visited[n] && !data[n]) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }

    if (head % 20000 === 0) await yieldToBrowser();
  }

  return { pixels, area: pixels.length, minX, minY, maxX, maxY };
}

type Edge = { a: MappingPoint; b: MappingPoint };

function edgeKey(point: MappingPoint) {
  return point[0] + ':' + point[1];
}

function collectOuterBoundary(
  component: Component,
  width: number,
  height: number,
): MappingPoint[] {
  const pixelSet = new Set(component.pixels);
  const edges: Edge[] = [];

  for (const index of component.pixels) {
    const y = Math.floor(index / width);
    const x = index - y * width;

    if (y === 0 || !pixelSet.has(index - width)) {
      edges.push({ a: [x, y], b: [x + 1, y] });
    }
    if (x === width - 1 || !pixelSet.has(index + 1)) {
      edges.push({ a: [x + 1, y], b: [x + 1, y + 1] });
    }
    if (y === height - 1 || !pixelSet.has(index + width)) {
      edges.push({ a: [x + 1, y + 1], b: [x, y + 1] });
    }
    if (x === 0 || !pixelSet.has(index - 1)) {
      edges.push({ a: [x, y + 1], b: [x, y] });
    }
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

      const next =
        candidates.find((point) => edgeKey(point) !== edgeKey(previous)) ??
        candidates[0];

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

function perpendicularDistance(
  point: MappingPoint,
  start: MappingPoint,
  end: MappingPoint,
) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  if (dx === 0 && dy === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  const t =
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
    (dx * dx + dy * dy);

  const projectedX = start[0] + Math.max(0, Math.min(1, t)) * dx;
  const projectedY = start[1] + Math.max(0, Math.min(1, t)) * dy;

  return Math.hypot(point[0] - projectedX, point[1] - projectedY);
}

function simplifyRdp(points: MappingPoint[], epsilon: number): MappingPoint[] {
  if (points.length <= 4) return points;

  let maxDistance = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(
      points[i],
      points[0],
      points[points.length - 1],
    );

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
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
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

function segmentsIntersect(
  a: MappingPoint,
  b: MappingPoint,
  c: MappingPoint,
  d: MappingPoint,
) {
  const cross = (p: MappingPoint, q: MappingPoint, r: MappingPoint) =>
    (q[0] - p[0]) * (r[1] - p[1]) -
    (q[1] - p[1]) * (r[0] - p[0]);

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
  ) {
    return true;
  }

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
  ) {
    return false;
  }

  if (pointInPolygon(a[0], b) || pointInPolygon(b[0], a)) return true;

  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];

    for (let j = 0; j < b.length; j += 1) {
      if (segmentsIntersect(a1, a2, b[j], b[(j + 1) % b.length])) {
        return true;
      }
    }
  }

  return false;
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

  const radii = [140, 190, 260, 360, 500];

  for (const radius of radii) {
    await yieldToBrowser();

    const x0 = Math.max(0, Math.round(seedX) - radius);
    const y0 = Math.max(0, Math.round(seedY) - radius);
    const x1 = Math.min(canvas.width, Math.round(seedX) + radius + 1);
    const y1 = Math.min(canvas.height, Math.round(seedY) + radius + 1);
    const cropWidth = x1 - x0;
    const cropHeight = y1 - y0;

    if (cropWidth < 20 || cropHeight < 20) continue;

    const cropImageData = context.getImageData(
      x0,
      y0,
      cropWidth,
      cropHeight,
    );

    const barrier = await buildInkBarrierMask(cropImageData);

    const localSeed = findOpenSeed(
      barrier,
      Math.round(seedX) - x0,
      Math.round(seedY) - y0,
      18,
    );

    if (!localSeed) continue;

    const component = await floodComponent(barrier, localSeed);

    if (component.area < 150) continue;

    const touchesCrop =
      component.minX <= 1 ||
      component.minY <= 1 ||
      component.maxX >= cropWidth - 2 ||
      component.maxY >= cropHeight - 2;

    // A valid lot face should be comfortably smaller than its analysis crop.
    const areaRatio = component.area / Math.max(1, cropWidth * cropHeight);
    const widthRatio =
      (component.maxX - component.minX + 1) / Math.max(1, cropWidth);
    const heightRatio =
      (component.maxY - component.minY + 1) / Math.max(1, cropHeight);

    if (areaRatio > 0.20 || widthRatio > 0.85 || heightRatio > 0.85) {
      continue;
    }

    if (touchesCrop) {
      // The lot is not fully enclosed at this radius. Expand the crop rather
      // than accepting a partial boundary that could overlap neighbours.
      continue;
    }

    const localBoundary = collectOuterBoundary(
      component,
      cropWidth,
      cropHeight,
    );

    if (localBoundary.length < 6) continue;

    const sourceBoundary = localBoundary.map(
      ([x, y]) => [x + x0, y + y0] as MappingPoint,
    );

    const span = Math.max(
      component.maxX - component.minX,
      component.maxY - component.minY,
    );

    const polygon = simplifyClosed(
      sourceBoundary,
      Math.max(1.5, Math.min(5, span * 0.012)),
    );

    if (polygon.length < 6) continue;

    const clickPoint: MappingPoint = [
      Math.round(seedX),
      Math.round(seedY),
    ];

    if (!pointInPolygon(clickPoint, polygon)) continue;

    const conflict = (options.conflictPolygons ?? []).some((other) =>
      polygonsConflict(polygon, other),
    );

    if (conflict) {
      throw new Error(
        'Hasil Auto Detect bertabrakan dengan mapping kavling yang sudah tersimpan. Mapping tidak disimpan.',
      );
    }

    const area = polygonArea(polygon);
    const bb = bbox(polygon);
    const spread = Math.max(bb.width, bb.height);
    const confidence = Math.max(
      55,
      Math.min(99, Math.round(97 - Math.max(0, spread - 120) / 24)),
    );

    return {
      polygon,
      label: clickPoint,
      confidence,
      area,
      bbox: bb,
    };
  }

  throw new Error(
    'Batas kavling belum berhasil ditemukan. Klik benar-benar di area putih bagian dalam kavling.',
  );
}
