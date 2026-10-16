/**
 * PixelForge Studio — Vector Boolean Shape Operations Engine (Pathfinder)
 * Zero-dependency, high-precision 2D polygon & Bézier constructive solid geometry (CSG):
 *   - Operations: Union, Subtract (Difference), Intersect, Exclude (XOR)
 *   - Exact parametric segment-segment intersections with degenerate point merging
 *   - Greiner-Hormann polygon clipping algorithm for arbitrary non-convex polygons
 *   - Subpath & Bézier curve adaptive linearization and reconstruction
 *   - Seamless integration with PixelForge Shape Layers & Vector PathManager
 */

class VectorPathfinder {
  static EPSILON = 1e-7;

  /**
   * Computes the 2D signed area of a polygon (positive = clockwise in screen coords, or counter-clockwise in Cartesian)
   * @param {Array<{x: number, y: number}>} poly
   * @returns {number}
   */
  static signedArea(poly) {
    if (!poly || poly.length < 3) return 0;
    let area = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    return area / 2;
  }

  /**
   * Ensures polygon vertices are in standard clockwise winding order
   * @param {Array<{x: number, y: number}>} poly
   * @returns {Array<{x: number, y: number}>}
   */
  static ensureClockwise(poly) {
    if (this.signedArea(poly) < 0) {
      return [...poly].reverse();
    }
    return [...poly];
  }

  /**
   * Tests whether a point lies inside a polygon (Ray-casting algorithm)
   * @param {{x: number, y: number}} pt
   * @param {Array<{x: number, y: number}>} poly
   * @returns {boolean}
   */
  static pointInPolygon(pt, poly) {
    if (!poly || poly.length < 3) return false;
    let inside = false;
    const n = poly.length;
    const px = pt.x;
    const py = pt.y;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;

      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Calculates the intersection of two 2D line segments [p1, p2] and [p3, p4]
   * Returns { t, u, pt: {x, y} } or null if parallel / no intersection
   */
  static segmentIntersection(p1, p2, p3, p4) {
    const dx12 = p2.x - p1.x;
    const dy12 = p2.y - p1.y;
    const dx34 = p4.x - p3.x;
    const dy34 = p4.y - p3.y;

    const denom = dx12 * dy34 - dy12 * dx34;
    if (Math.abs(denom) < this.EPSILON) return null; // Parallel or collinear

    const dx13 = p1.x - p3.x;
    const dy13 = p1.y - p3.y;

    const t = (dx13 * dy34 - dy13 * dx34) / -denom;
    const u = (dx12 * dy13 - dy12 * dx13) / denom;

    if (t >= -this.EPSILON && t <= 1 + this.EPSILON && u >= -this.EPSILON && u <= 1 + this.EPSILON) {
      const clampedT = Math.max(0, Math.min(1, t));
      return {
        t: clampedT,
        u: Math.max(0, Math.min(1, u)),
        pt: {
          x: p1.x + clampedT * dx12,
          y: p1.y + clampedT * dy12
        }
      };
    }
    return null;
  }

  /**
   * Performs boolean clipping of two polygons using Greiner-Hormann algorithm
   * @param {Array<{x: number, y: number}>} polyA Subject polygon
   * @param {Array<{x: number, y: number}>} polyB Clip polygon
   * @param {'union'|'subtract'|'intersect'|'exclude'} operation
   * @returns {Array<Array<{x: number, y: number}>>} Array of resulting polygon rings
   */
  static polygonBoolean(polyA, polyB, operation = 'union') {
    if (!polyA || polyA.length < 3) {
      if (operation === 'union' || operation === 'exclude') return polyB ? [polyB] : [];
      return [];
    }
    if (!polyB || polyB.length < 3) {
      if (operation === 'union' || operation === 'subtract' || operation === 'exclude') return [polyA];
      return [];
    }

    // Fast-path for axis-aligned rectangles
    if (this._isAxisAlignedRect(polyA) && this._isAxisAlignedRect(polyB)) {
      const rectResult = this._rectBoolean(polyA, polyB, operation);
      if (rectResult !== null) return rectResult;
    }

    // Node representation for Greiner-Hormann doubly-linked list
    class Node {
      constructor(pt, isIntersection = false) {
        this.pt = { x: pt.x, y: pt.y };
        this.next = null;
        this.prev = null;
        this.neighbor = null;
        this.isIntersection = isIntersection;
        this.entry = false;
        this.visited = false;
        this.alpha = 0;
      }
    }

    // Build circular linked list for polygon
    const buildList = (poly) => {
      let head = null, prev = null;
      for (const pt of poly) {
        const node = new Node(pt);
        if (!head) head = node;
        if (prev) {
          prev.next = node;
          node.prev = prev;
        }
        prev = node;
      }
      prev.next = head;
      head.prev = prev;
      return head;
    };

    const ringA = buildList(polyA);
    const ringB = buildList(polyB);

    // 1. Identify all edge intersections
    let currA = ringA;
    let hasIntersections = false;

    do {
      const nextA = currA.next;
      const edgeA1 = currA.pt;
      const edgeA2 = nextA.pt;

      let currB = ringB;
      const intersectionsOnEdgeA = [];

      do {
        const nextB = currB.next;
        const edgeB1 = currB.pt;
        const edgeB2 = nextB.pt;

        const isect = this.segmentIntersection(edgeA1, edgeA2, edgeB1, edgeB2);
        if (isect && isect.t > 1e-5 && isect.t < 1 - 1e-5 && isect.u > 1e-5 && isect.u < 1 - 1e-5) {
          hasIntersections = true;
          intersectionsOnEdgeA.push({
            t: isect.t,
            u: isect.u,
            pt: isect.pt,
            nodeB: currB,
            nextB: nextB
          });
        }

        currB = nextB;
      } while (currB !== ringB);

      // Sort intersections along edge A
      intersectionsOnEdgeA.sort((x, y) => x.t - y.t);

      // Insert intersection nodes into ring A and ring B
      let lastNodeA = currA;
      for (const hit of intersectionsOnEdgeA) {
        const nodeA = new Node(hit.pt, true);
        nodeA.alpha = hit.t;

        const nodeB = new Node(hit.pt, true);
        nodeB.alpha = hit.u;

        nodeA.neighbor = nodeB;
        nodeB.neighbor = nodeA;

        // Insert nodeA between lastNodeA and nextA
        nodeA.next = nextA;
        nodeA.prev = lastNodeA;
        lastNodeA.next = nodeA;
        nextA.prev = nodeA;
        lastNodeA = nodeA;

        // Insert nodeB into ring B in sorted order along edge B
        let insB = hit.nodeB;
        while (insB.next !== hit.nextB && insB.next.isIntersection && insB.next.alpha < hit.u) {
          insB = insB.next;
        }
        nodeB.next = insB.next;
        nodeB.prev = insB;
        insB.next.prev = nodeB;
        insB.next = nodeB;
      }

      currA = nextA;
    } while (currA !== ringA);

    // Handle disjoint or completely nested polygons
    if (!hasIntersections) {
      const aInB = this.pointInPolygon(polyA[0], polyB);
      const bInA = this.pointInPolygon(polyB[0], polyA);

      switch (operation) {
        case 'union':
          if (aInB) return [polyB];
          if (bInA) return [polyA];
          return [polyA, polyB]; // disjoint
        case 'subtract':
          if (bInA) return [polyA]; // B is a hole inside A (or clipped)
          if (aInB) return [];      // A completely eaten by B
          return [polyA];           // disjoint
        case 'intersect':
          if (aInB) return [polyA];
          if (bInA) return [polyB];
          return [];                // disjoint
        case 'exclude':
          if (aInB || bInA) return [polyA, polyB];
          return [polyA, polyB];
      }
    }

    // 2. Classify entry/exit flags for intersections
    // For ring A:
    let isInsideB = this.pointInPolygon(ringA.pt, polyB);
    currA = ringA;
    do {
      if (currA.isIntersection) {
        currA.entry = !isInsideB;
        isInsideB = !isInsideB;
      }
      currA = currA.next;
    } while (currA !== ringA);

    // For ring B:
    let isInsideA = this.pointInPolygon(ringB.pt, polyA);
    let currB = ringB;
    do {
      if (currB.isIntersection) {
        currB.entry = !isInsideA;
        isInsideA = !isInsideA;
      }
      currB = currB.next;
    } while (currB !== ringB);

    // 3. Trace result polygons
    const resultPolygons = [];

    // Reset visited flags
    currA = ringA;
    do {
      currA.visited = false;
      currA = currA.next;
    } while (currA !== ringA);

    currB = ringB;
    do {
      currB.visited = false;
      currB = currB.next;
    } while (currB !== ringB);

    // Helper to find next unvisited intersection
    const findStartIntersection = () => {
      let node = ringA;
      do {
        if (node.isIntersection && !node.visited) {
          if (operation === 'union' && !node.entry) return node;
          if (operation === 'subtract' && node.entry) return node;
          if (operation === 'intersect' && node.entry) return node;
          if (operation === 'exclude') return node;
        }
        node = node.next;
      } while (node !== ringA);
      return null;
    };

    let start = findStartIntersection();
    let safetyCounter = 0;

    while (start && safetyCounter++ < 500) {
      const polygon = [];
      let current = start;

      while (current && (!current.visited || current === start) && polygon.length < 2000) {
        if (current === start && polygon.length > 0) break;
        current.visited = true;
        if (current.neighbor) current.neighbor.visited = true;

        polygon.push({ x: current.pt.x, y: current.pt.y });

        if (current.isIntersection) {
          let switchNext = false;
          if (operation === 'union') {
            switchNext = current.entry;
          } else if (operation === 'subtract') {
            switchNext = !current.entry;
          } else if (operation === 'intersect') {
            switchNext = !current.entry;
          } else if (operation === 'exclude') {
            switchNext = current.entry;
          }

          if (switchNext) {
            current = current.neighbor ? current.neighbor.next : current.next;
          } else {
            current = current.neighbor ? current.neighbor.prev : current.prev;
          }
        } else {
          current = current.next;
        }
      }

      if (polygon.length >= 3) {
        resultPolygons.push(this.cleanPolygon(polygon));
      }

      start = findStartIntersection();
    }

    return resultPolygons.length > 0 ? resultPolygons : [polyA];
  }

  /**
   * Removes duplicate or collinear vertices
   */
  static cleanPolygon(poly) {
    if (!poly || poly.length <= 2) return poly;
    const clean = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i];
      const prev = clean[clean.length - 1];
      if (!prev || Math.hypot(cur.x - prev.x, cur.y - prev.y) > 0.5) {
        clean.push(cur);
      }
    }
    if (clean.length > 2 && Math.hypot(clean[0].x - clean[clean.length - 1].x, clean[0].y - clean[clean.length - 1].y) < 0.5) {
      clean.pop();
    }
    return clean;
  }

  /**
   * Approximates a cubic Bézier curve segment into discrete 2D points
   */
  static flattenCubicBezier(p0, c0, c1, p1, steps = 12) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = mt * mt * mt * p0.x + 3 * mt * mt * t * c0.x + 3 * mt * t * t * c1.x + t * t * t * p1.x;
      const y = mt * mt * mt * p0.y + 3 * mt * mt * t * c0.y + 3 * mt * t * t * c1.y + t * t * t * p1.y;
      pts.push({ x, y });
    }
    return pts;
  }

  /**
   * Converts a PixelForge Subpath (from js/paths.js) into a linearized polygon
   */
  static subpathToPolygon(subpath, stepsPerSegment = 10) {
    if (!subpath || !subpath.points || subpath.points.length === 0) return [];
    const poly = [];
    const pts = subpath.points;
    const n = pts.length;

    for (let i = 0; i < n; i++) {
      const pA = pts[i];
      const pB = pts[(i + 1) % n];

      if (i === n - 1 && !subpath.closed) {
        poly.push({ x: pA.x, y: pA.y });
        break;
      }

      const hasBezier = pA.handleOut || pB.handleIn;
      if (hasBezier) {
        const c0 = pA.handleOut ? { x: pA.x + pA.handleOut.x, y: pA.y + pA.handleOut.y } : { x: pA.x, y: pA.y };
        const c1 = pB.handleIn ? { x: pB.x + pB.handleIn.x, y: pB.y + pB.handleIn.y } : { x: pB.x, y: pB.y };
        const segment = this.flattenCubicBezier(pA, c0, c1, pB, stepsPerSegment);
        // exclude last point to prevent duplicates
        for (let s = 0; s < segment.length - 1; s++) {
          poly.push(segment[s]);
        }
      } else {
        poly.push({ x: pA.x, y: pA.y });
      }
    }
    return poly;
  }

  /**
   * Converts a polygon back to a PixelForge Subpath
   */
  static polygonToSubpath(poly, closed = true) {
    if (typeof Subpath === 'undefined') {
      return { points: poly.map(p => ({ x: p.x, y: p.y })), closed };
    }
    const sp = new Subpath();
    sp.closed = closed;
    for (const pt of poly) {
      sp.addPoint(pt.x, pt.y);
    }
    return sp;
  }

  /**
   * High-level Vector Boolean operation on two Subpaths
   * @param {Subpath} subpathA
   * @param {Subpath} subpathB
   * @param {'union'|'subtract'|'intersect'|'exclude'} operation
   * @returns {Array<Subpath>}
   */
  static combineSubpaths(subpathA, subpathB, operation = 'union') {
    const polyA = this.subpathToPolygon(subpathA);
    const polyB = this.subpathToPolygon(subpathB);
    const resultPolys = this.polygonBoolean(polyA, polyB, operation);
    return resultPolys.map(p => this.polygonToSubpath(p, true));
  }

  /**
   * Combines two Vector Shape Layers in the layer stack into a unified compound shape
   */
  static combineShapeLayers(layerA, layerB, operation = 'union', layerManager = null) {
    if (!layerA || !layerB) return null;

    // Helper to get polygon from shape properties
    const getShapePolygon = (layer) => {
      const p = layer.properties || {};
      const type = layer.type || p.shapeType || 'rect';
      const x = layer.x || 0;
      const y = layer.y || 0;
      const w = layer.width || p.width || 100;
      const h = layer.height || p.height || 100;

      if (p.subpath) {
        return VectorPathfinder.subpathToPolygon(p.subpath);
      }
      if (type === 'shape-ellipse' || type === 'ellipse') {
        const poly = [];
        const cx = x + w / 2, cy = y + h / 2;
        const rx = w / 2, ry = h / 2;
        for (let i = 0; i < 32; i++) {
          const theta = (i / 32) * Math.PI * 2;
          poly.push({ x: cx + rx * Math.cos(theta), y: cy + ry * Math.sin(theta) });
        }
        return poly;
      }
      if (type === 'shape-polygon' || type === 'polygon') {
        const sides = p.sides || 5;
        const poly = [];
        const cx = x + w / 2, cy = y + h / 2;
        const r = Math.min(w, h) / 2;
        for (let i = 0; i < sides; i++) {
          const theta = (i / sides) * Math.PI * 2 - Math.PI / 2;
          poly.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
        }
        return poly;
      }
      // Default: Rectangle
      return [
        { x: x, y: y },
        { x: x + w, y: y },
        { x: x + w, y: y + h },
        { x: x, y: y + h }
      ];
    };

    const polyA = getShapePolygon(layerA);
    const polyB = getShapePolygon(layerB);
    const resultPolys = this.polygonBoolean(polyA, polyB, operation);

    if (resultPolys.length === 0) return null;

    // Primary resulting polygon
    const primePoly = resultPolys[0];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of primePoly) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }

    const subpath = this.polygonToSubpath(primePoly, true);

    if (layerManager && typeof layerManager.addShapeLayer === 'function') {
      const mergedLayer = layerManager.addShapeLayer('path', minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY), {
        fill: layerA.properties ? layerA.properties.fill : true,
        fillColor: layerA.properties ? layerA.properties.fillColor : '#3b82f6',
        stroke: layerA.properties ? layerA.properties.stroke : true,
        strokeColor: layerA.properties ? layerA.properties.strokeColor : '#000000',
        strokeWidth: layerA.properties ? layerA.properties.strokeWidth : 2,
        subpath: subpath
      });
      return mergedLayer;
    }

    return {
      type: 'shape-path',
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      subpath,
      polygons: resultPolys
    };
  }

  static _isAxisAlignedRect(poly) {
    if (!poly || poly.length !== 4) return false;
    const xs = new Set(poly.map(p => Math.round(p.x * 1000) / 1000));
    const ys = new Set(poly.map(p => Math.round(p.y * 1000) / 1000));
    return xs.size === 2 && ys.size === 2;
  }

  static _getRectBounds(poly) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  static _makeRectPoly(minX, minY, maxX, maxY) {
    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ];
  }

  static _rectBoolean(polyA, polyB, operation) {
    const a = this._getRectBounds(polyA);
    const b = this._getRectBounds(polyB);

    const ix1 = Math.max(a.minX, b.minX);
    const iy1 = Math.max(a.minY, b.minY);
    const ix2 = Math.min(a.maxX, b.maxX);
    const iy2 = Math.min(a.maxY, b.maxY);

    const overlaps = ix1 < ix2 && iy1 < iy2;

    if (!overlaps) {
      if (operation === 'union' || operation === 'exclude') return [polyA, polyB];
      if (operation === 'subtract') return [polyA];
      return []; // intersect
    }

    if (operation === 'intersect') {
      return [this._makeRectPoly(ix1, iy1, ix2, iy2)];
    }

    if (operation === 'union') {
      if (Math.abs(a.minY - b.minY) < 1e-4 && Math.abs(a.maxY - b.maxY) < 1e-4) {
        return [this._makeRectPoly(Math.min(a.minX, b.minX), a.minY, Math.max(a.maxX, b.maxX), a.maxY)];
      }
      if (Math.abs(a.minX - b.minX) < 1e-4 && Math.abs(a.maxX - b.maxX) < 1e-4) {
        return [this._makeRectPoly(a.minX, Math.min(a.minY, b.minY), a.maxX, Math.max(a.maxY, b.maxY))];
      }
    }

    if (operation === 'subtract') {
      if (Math.abs(a.minY - b.minY) < 1e-4 && Math.abs(a.maxY - b.maxY) < 1e-4) {
        if (b.minX <= a.minX && b.maxX < a.maxX) {
          return [this._makeRectPoly(b.maxX, a.minY, a.maxX, a.maxY)];
        }
        if (b.minX > a.minX && b.maxX >= a.maxX) {
          return [this._makeRectPoly(a.minX, a.minY, b.minX, a.maxY)];
        }
        if (b.minX <= a.minX && b.maxX >= a.maxX) {
          return [];
        }
      }
      if (Math.abs(a.minX - b.minX) < 1e-4 && Math.abs(a.maxX - b.maxX) < 1e-4) {
        if (b.minY <= a.minY && b.maxY < a.maxY) {
          return [this._makeRectPoly(a.minX, b.maxY, a.maxX, a.maxY)];
        }
        if (b.minY > a.minY && b.maxY >= a.maxY) {
          return [this._makeRectPoly(a.minX, a.minY, a.maxX, b.minY)];
        }
        if (b.minY <= a.minY && b.maxY >= a.maxY) {
          return [];
        }
      }
    }

    // Return null to allow generalized Greiner-Hormann fallback for arbitrary rectilinear shapes
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.VectorPathfinder = VectorPathfinder;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VectorPathfinder;
}
