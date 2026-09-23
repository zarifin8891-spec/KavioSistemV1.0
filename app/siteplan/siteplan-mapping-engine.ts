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

function pixelStats(data: Uint8ClampedArray, index: number) {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const gray = (299 * r + 587 * g + 114 * b) / 1000;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return { gray, chroma };
}

function buildBarrierMask(imageData: ImageData): PixelMask {
  const { width, height, data } = imageData;
  const gray = new Uint8Array(width * height);
  const chroma = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[y * width + x] = Math.round((299 * r + 587 * g + 114 * b) / 1000);
      chroma[y * width + x] = Math.max(r, g, b) - Math.min(r, g, b);
    }
  }

  // Lightweight 5×5 Gaussian blur (separable) suppresses small text strokes
  // while preserving the longer CAD boundary lines.
  const kernel = [1, 4, 6, 4, 1];
  const horizontal = new Float32Array(gray.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let weight = 0;
      for (let k = -2; k <= 2; k += 1) {
        const nx = Math.max(0, Math.min(width - 1, x + k));
        const w = kernel[k + 2];
        sum += gray[y * width + nx] * w;
        weight += w;
      }
      horizontal[y * width + x] = sum / weight;
    }
  }

  const blurredGray = new Uint8Array(gray.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let weight = 0;
      for (let k = -2; k <= 2; k += 1) {
        const ny = Math.max(0, Math.min(height - 1, y + k));
        const w = kernel[k + 2];
        sum += horizontal[ny * width + x] * w;
        weight += w;
      }
      blurredGray[y * width + x] = Math.round(sum / weight);
    }
  }

  const raw = new Uint8Array(width * height);
  for (let i = 0; i < raw.length; i += 1) {
    raw[i] = blurredGray[i] < 245 || chroma[i] > 18 ? 1 : 0;
  }

  // Morphological close + small dilation closes anti-aliased breaks in thin
  // boundaries so a lot remains isolated from the road and neighbouring lots.
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
  }

  const closed = new Uint8Array(raw.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let open = 0;
      for (let oy = -1; oy <= 1 && !open; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height || !dilated[ny * width + nx]) {
            open = 1;
            break;
          }
        }
      }
      closed[y * width + x] = open ? 0 : 1;
    }
  }

  const finalMask = new Uint8Array(raw.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let blocked = closed[y * width + x];
      if (!blocked) {
        for (let oy = -1; oy <= 0 && !blocked; oy += 1) {
          for (let ox = -1; ox <= 0; ox += 1) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && closed[ny * width + nx]) {
              blocked = 1;
              break;
            }
          }
        }
      }
      finalMask[y * width + x] = blocked;
    }
  }

  return { width, height, data: finalMask };
}
function findOpenSeed(mask: PixelMask, x: number, y: number, radius = 10): [number, number] | null {
  const startX = Math.round(x);
  const startY = Math.round(y);
  const px = Math.max(0, Math.min(mask.width - 1, startX));
  const py = Math.max(0, Math.min(mask.height - 1, startY));
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

type Component = {
  pixels: number[];
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function floodComponent(mask: PixelMask, seed: [number, number]): Component {
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

  while (head < tail) {
    const index = queue[head++];
    const y = Math.floor(index / width);
    const x = index - y * width;
    pixels.push(index);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

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
  }

  return {
    pixels,
    area: pixels.length,
    minX,
    minY,
    maxX,
    maxY,
  };
}

type Edge = {
  a: [number, number];
  b: [number, number];
};

function edgeKey(point: [number, number]) {
  return point[0] + ':' + point[1];
}

function collectOuterBoundary(component: Component, width: number, height: number) {
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

  const adjacency = new Map<string, Array<[number, number]>>();
  for (const edge of edges) {
    const ka = edgeKey(edge.a);
    const kb = edgeKey(edge.b);
    const listA = adjacency.get(ka) ?? [];
    const listB = adjacency.get(kb) ?? [];
    listA.push(edge.b);
    listB.push(edge.a);
    adjacency.set(ka, listA);
    adjacency.set(kb, listB);
  }

  const used = new Set<string>();
  const loops: Array<Array<[number, number]>> = [];

  for (const edge of edges) {
    const startKey = edgeKey(edge.a);
    const edgeId = startKey + '>' + edgeKey(edge.b);
    if (used.has(edgeId)) continue;

    const loop: Array<[number, number]> = [];
    let current = edge.a;
    let next = edge.b;
    loop.push(current);

    for (let guard = 0; guard < edges.length + 10; guard += 1) {
      const from = edgeKey(current);
      const to = edgeKey(next);
      const id = from + '>' + to;
      used.add(id);
      current = next;
      loop.push(current);
      if (edgeKey(current) === edgeKey(edge.a)) break;

      const candidates = (adjacency.get(edgeKey(current)) ?? []).filter((point) => !used.has(edgeKey(current) + '>' + edgeKey(point)));
      if (!candidates.length) break;

      next = candidates[0];
    }

    if (loop.length >= 4 && edgeKey(loop[0]) === edgeKey(loop[loop.length - 1])) {
      loops.push(loop.slice(0, -1));
    }
  }

  if (!loops.length) return [];
  const signedArea = (points: Array<[number, number]>) => {
    let area = 0;
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      area += x1 * y2 - x2 * y1;
    }
    return area / 2;
  };
  return loops.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)))[0];
}

function perpendicularDistance(point: MappingPoint, start: MappingPoint, end: MappingPoint) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy);
  const projectedX = start[0] + Math.max(0, Math.min(1, t)) * dx;
  const projectedY = start[1] + Math.max(0, Math.min(1, t)) * dy;
  return Math.hypot(point[0] - projectedX, point[1] - projectedY);
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
  const firstHalf = simplifyRdp(points.concat([points[0]]), epsilon);
  return firstHalf.slice(0, -1);
}

export async function loadSiteplanImage(src: string) {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  await image.decode();
  return image;
}

export async function detectLotPolygon(
  image: HTMLImageElement,
  seedX: number,
  seedY: number,
  options: { maxAreaRatio?: number } = {},
): Promise<AutoMappingResult> {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas context tidak tersedia.');

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const barrier = buildBarrierMask(imageData);
  const seed = findOpenSeed(barrier, seedX, seedY);
  if (!seed) throw new Error('Titik klik berada di garis/batas dan area kavling tidak dapat ditemukan.');

  const component = floodComponent(barrier, seed);
  const maxAreaRatio = options.maxAreaRatio ?? 0.03;
  const areaRatio = component.area / (barrier.width * barrier.height);
  if (component.area < 80) throw new Error('Area terdeteksi terlalu kecil. Klik lebih ke tengah kavling.');
  if (areaRatio > maxAreaRatio) throw new Error('Area terlalu besar. Klik tepat di dalam kavling, bukan jalan atau area kosong.');

  const boundary = collectOuterBoundary(component, barrier.width, barrier.height);
  if (boundary.length < 6) throw new Error('Batas polygon belum berhasil ditemukan.');

  const span = Math.max(component.maxX - component.minX, component.maxY - component.minY);
  const simplified = simplifyClosed(boundary as MappingPoint[], Math.max(1.5, span * 0.012));
  const label: MappingPoint = seed;

  const confidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        95
        - Math.min(25, areaRatio * 2000)
        - Math.min(15, Math.abs(simplified.length - boundary.length) / Math.max(1, boundary.length) * 30),
      ),
    ),
  );

  return {
    polygon: simplified,
    label,
    confidence,
    area: component.area,
    bbox: {
      x: component.minX,
      y: component.minY,
      width: component.maxX - component.minX + 1,
      height: component.maxY - component.minY + 1,
    },
  };
}
