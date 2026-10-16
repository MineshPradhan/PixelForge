// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Precision Vector & Bézier Path Engine
// ══════════════════════════════════════════════════════════════════════

class VectorPoint {
  constructor(x, y, cp1 = null, cp2 = null, type = 'smooth') {
    this.x = x;
    this.y = y;
    // cp1 = incoming control handle { x, y } (controls segment entering this point)
    this.cp1 = cp1 ? { x: cp1.x, y: cp1.y } : null;
    // cp2 = outgoing control handle { x, y } (controls segment leaving this point)
    this.cp2 = cp2 ? { x: cp2.x, y: cp2.y } : null;
    this.type = type; // 'corner' | 'smooth' | 'symmetric'
    this.selected = false;
  }

  get isCorner() {
    return this.type === 'corner';
  }

  set isCorner(val) {
    this.type = val ? 'corner' : 'smooth';
    if (val) {
      this.cp1 = null;
      this.cp2 = null;
    }
  }

  clone() {
    return new VectorPoint(
      this.x, this.y,
      this.cp1 ? { ...this.cp1 } : null,
      this.cp2 ? { ...this.cp2 } : null,
      this.type
    );
  }
}

class Subpath {
  constructor(points = [], closed = false) {
    this.points = points;
    this.closed = closed;
  }

  clone() {
    return new Subpath(this.points.map(p => p.clone()), this.closed);
  }

  addPoint(x, y, cp1 = null, cp2 = null, type = 'smooth') {
    const pt = new VectorPoint(x, y, cp1, cp2, type);
    this.points.push(pt);
    return pt;
  }

  close() {
    this.closed = true;
  }

  getBounds() {
    if (this.points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.cp1) {
        if (p.cp1.x < minX) minX = p.cp1.x;
        if (p.cp1.y < minY) minY = p.cp1.y;
        if (p.cp1.x > maxX) maxX = p.cp1.x;
        if (p.cp1.y > maxY) maxY = p.cp1.y;
      }
      if (p.cp2) {
        if (p.cp2.x < minX) minX = p.cp2.x;
        if (p.cp2.y < minY) minY = p.cp2.y;
        if (p.cp2.x > maxX) maxX = p.cp2.x;
        if (p.cp2.y > maxY) maxY = p.cp2.y;
      }
    }
    return {
      minX, minY, maxX, maxY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY)
    };
  }

  reverse() {
    this.points.reverse();
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const tmp = p.cp1;
      p.cp1 = p.cp2;
      p.cp2 = tmp;
    }
    return this;
  }
}

class PathManager {
  constructor(app = null) {
    this.app = app;
    this.subpaths = []; // Array of Subpath
    this.activeSubpathIndex = -1;
    this.activePointIndex = -1;

    // Direct / Multi-selection state
    this.selectedPoints = new Set(); // Set of "subpathIdx:pointIdx"
    this.marqueeBox = null; // { x1, y1, x2, y2 }

    // Interaction state
    this.dragTarget = null; // { type: 'anchor'|'cp1'|'cp2'|'newPoint'|'subpath'|'marquee', subpathIdx, pointIdx }
    this.dragStart = null;
    this.isCreatingPoint = false;
    this.rubberBandPoint = null; // Live preview point { x, y }

    // Curvature Pen & Freeform settings
    this.toolMode = 'pen'; // 'pen' | 'curvature-pen' | 'freeform-pen' | 'path-select' | 'direct-select' | 'pen-add' | 'pen-delete' | 'pen-convert'
    this.freeformPoints = [];
    this.freeformTolerance = 2.0;

    // Settings
    this.mode = 'path'; // 'path' | 'shape' | 'pixels'
    this.fillColor = '#3b82f6';
    this.strokeColor = '#ffffff';
    this.strokeWidth = 2;
    this.lineDash = [];
    this.lineCap = 'round'; // 'butt' | 'round' | 'square'
    this.lineJoin = 'round'; // 'miter' | 'round' | 'bevel'
    this.strokeAlign = 'center'; // 'center' | 'inside' | 'outside'

    // Saved Paths catalog (Photoshop Paths Panel Parity)
    this.savedPaths = []; // Array of { id, name, subpaths: [...] }
    this.activeSavedPathId = null;
    this.pathCounter = 0;
  }

  // ── Subpath & Point Management ──
  getActiveSubpath() {
    if (this.activeSubpathIndex >= 0 && this.activeSubpathIndex < this.subpaths.length) {
      return this.subpaths[this.activeSubpathIndex];
    }
    return null;
  }

  getActivePoint() {
    const sp = this.getActiveSubpath();
    if (sp && this.activePointIndex >= 0 && this.activePointIndex < sp.points.length) {
      return sp.points[this.activePointIndex];
    }
    return null;
  }

  newSubpath() {
    const sp = new Subpath();
    this.subpaths.push(sp);
    this.activeSubpathIndex = this.subpaths.length - 1;
    this.activePointIndex = -1;
    return sp;
  }

  clear() {
    this.subpaths = [];
    this.activeSubpathIndex = -1;
    this.activePointIndex = -1;
    this.selectedPoints.clear();
    this.marqueeBox = null;
    this.dragTarget = null;
    this.dragStart = null;
    this.isCreatingPoint = false;
    this.rubberBandPoint = null;
    this.freeformPoints = [];
  }

  isEmpty() {
    return this.subpaths.length === 0 || this.subpaths.every(sp => sp.points.length === 0);
  }

  getBounds() {
    if (this.isEmpty()) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const sp of this.subpaths) {
      const b = sp.getBounds();
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }
    return {
      minX, minY, maxX, maxY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY)
    };
  }

  // ── Hit Testing ──
  hitTest(x, y, radius = 8) {
    const rSq = radius * radius;

    // 1. Check control handles of active/selected points first (highest priority)
    const activePt = this.getActivePoint();
    if (activePt) {
      const spIdx = this.activeSubpathIndex;
      const ptIdx = this.activePointIndex;
      if (activePt.cp1) {
        const dSq = (activePt.cp1.x - x) ** 2 + (activePt.cp1.y - y) ** 2;
        if (dSq <= rSq) {
          return { type: 'cp1', subpathIdx: spIdx, pointIdx: ptIdx, point: activePt };
        }
      }
      if (activePt.cp2) {
        const dSq = (activePt.cp2.x - x) ** 2 + (activePt.cp2.y - y) ** 2;
        if (dSq <= rSq) {
          return { type: 'cp2', subpathIdx: spIdx, pointIdx: ptIdx, point: activePt };
        }
      }
    }

    // 2. Check anchor points across all subpaths
    for (let s = 0; s < this.subpaths.length; s++) {
      const sp = this.subpaths[s];
      for (let p = 0; p < sp.points.length; p++) {
        const pt = sp.points[p];
        const dSq = (pt.x - x) ** 2 + (pt.y - y) ** 2;
        if (dSq <= rSq) {
          return {
            type: 'anchor',
            subpathIdx: s,
            pointIdx: p,
            point: pt,
            isFirst: p === 0,
            isLast: p === sp.points.length - 1,
            isClosed: sp.closed
          };
        }
      }
    }

    // 3. Check curve segments
    for (let s = 0; s < this.subpaths.length; s++) {
      const sp = this.subpaths[s];
      const count = sp.points.length;
      if (count < 2) continue;

      const segCount = sp.closed ? count : count - 1;
      for (let i = 0; i < segCount; i++) {
        const p1 = sp.points[i];
        const p2 = sp.points[(i + 1) % count];
        const hit = this.hitTestBezierSegment(p1, p2, x, y, radius);
        if (hit) {
          return {
            type: 'segment',
            subpathIdx: s,
            segmentIdx: i,
            t: hit.t,
            x: hit.x,
            y: hit.y
          };
        }
      }
    }

    return null;
  }

  hitTestBezierSegment(p1, p2, x, y, radius = 8) {
    const rSq = radius * radius;
    const cp1 = p1.cp2 || { x: p1.x, y: p1.y };
    const cp2 = p2.cp1 || { x: p2.x, y: p2.y };

    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const bx = (1 - t) ** 3 * p1.x + 3 * (1 - t) ** 2 * t * cp1.x + 3 * (1 - t) * t ** 2 * cp2.x + t ** 3 * p2.x;
      const by = (1 - t) ** 3 * p1.y + 3 * (1 - t) ** 2 * t * cp1.y + 3 * (1 - t) * t ** 2 * cp2.y + t ** 3 * p2.y;
      const dSq = (bx - x) ** 2 + (by - y) ** 2;
      if (dSq <= rSq) {
        return { t, x: bx, y: by };
      }
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Curvature Pen Engine (Photoshop Parity)
  // ══════════════════════════════════════════════════════════════════════

  recomputeCurvatureSpline(subpath) {
    if (!subpath || subpath.points.length < 2) return;
    const pts = subpath.points;
    const n = pts.length;
    const isClosed = subpath.closed;

    for (let i = 0; i < n; i++) {
      const cur = pts[i];
      if (cur.type === 'corner') {
        cur.cp1 = null;
        cur.cp2 = null;
        continue;
      }

      // Smooth point: compute Centripetal Catmull-Rom tangent direction
      let prevIdx = i - 1;
      let nextIdx = i + 1;

      if (isClosed) {
        prevIdx = (i - 1 + n) % n;
        nextIdx = (i + 1) % n;
      } else {
        if (i === 0) {
          cur.cp1 = null;
          const next = pts[1];
          cur.cp2 = {
            x: cur.x + (next.x - cur.x) / 3,
            y: cur.y + (next.y - cur.y) / 3
          };
          continue;
        } else if (i === n - 1) {
          cur.cp2 = null;
          const prev = pts[n - 2];
          cur.cp1 = {
            x: cur.x - (cur.x - prev.x) / 3,
            y: cur.y - (cur.y - prev.y) / 3
          };
          continue;
        }
      }

      const prev = pts[prevIdx];
      const next = pts[nextIdx];

      const v1x = cur.x - prev.x;
      const v1y = cur.y - prev.y;
      const v2x = next.x - cur.x;
      const v2y = next.y - cur.y;

      const d1 = Math.hypot(v1x, v1y);
      const d2 = Math.hypot(v2x, v2y);

      if (d1 + d2 > 0.001) {
        const u1x = v1x / (d1 || 1);
        const u1y = v1y / (d1 || 1);
        const u2x = v2x / (d2 || 1);
        const u2y = v2y / (d2 || 1);

        let tx = u1x + u2x;
        let ty = u1y + u2y;
        const tLen = Math.hypot(tx, ty);
        if (tLen > 0.0001) {
          tx /= tLen;
          ty /= tLen;
        }

        const h1Len = d1 / 3;
        const h2Len = d2 / 3;

        cur.cp1 = { x: cur.x - tx * h1Len, y: cur.y - ty * h1Len };
        cur.cp2 = { x: cur.x + tx * h2Len, y: cur.y + ty * h2Len };
      }
    }
  }

  addCurvaturePoint(x, y, isCorner = false) {
    let sp = this.getActiveSubpath();
    if (!sp || sp.closed) {
      sp = this.newSubpath();
    }

    const type = isCorner ? 'corner' : 'smooth';
    const pt = sp.addPoint(x, y, null, null, type);
    this.activePointIndex = sp.points.length - 1;
    this.recomputeCurvatureSpline(sp);
    return pt;
  }

  toggleCurvatureCorner(subpathIdx, pointIdx) {
    const sp = this.subpaths[subpathIdx];
    if (!sp || !sp.points[pointIdx]) return;
    const pt = sp.points[pointIdx];
    pt.type = (pt.type === 'corner') ? 'smooth' : 'corner';
    this.recomputeCurvatureSpline(sp);
    return pt;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Freeform Pen Engine (Douglas-Peucker & Schneider Curve Fitting)
  // ══════════════════════════════════════════════════════════════════════

  _douglasPeucker(pts, epsilon) {
    if (pts.length <= 2) return pts;

    let maxDist = 0;
    let index = 0;
    const first = pts[0];
    const last = pts[pts.length - 1];

    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      // Perpendicular distance from p to line(first, last)
      const num = Math.abs((last.y - first.y) * p.x - (last.x - first.x) * p.y + last.x * first.y - last.y * first.x);
      const den = Math.hypot(last.y - first.y, last.x - first.x);
      const dist = den === 0 ? 0 : num / den;

      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    if (maxDist > epsilon) {
      const left = this._douglasPeucker(pts.slice(0, index + 1), epsilon);
      const right = this._douglasPeucker(pts.slice(index), epsilon);
      return left.slice(0, -1).concat(right);
    } else {
      return [first, last];
    }
  }

  finishFreeform(rawPoints, tolerance = 2.0, closeIfNear = true) {
    if (!rawPoints || rawPoints.length < 2) return null;

    // 1. Simplify raw digitized points using Douglas-Peucker
    let simplified = this._douglasPeucker(rawPoints, Math.max(1.0, tolerance));
    if (simplified.length < 2) simplified = [rawPoints[0], rawPoints[rawPoints.length - 1]];

    // 2. Check if endpoints are close enough to close the loop
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    let isClosed = false;
    if (closeIfNear && simplified.length > 2 && Math.hypot(last.x - first.x, last.y - first.y) < 18) {
      isClosed = true;
      simplified.pop(); // remove duplicate closing vertex
    }

    // 3. Construct subpath with smooth points and recompute curvature splines
    const sp = new Subpath([], isClosed);
    for (const p of simplified) {
      sp.addPoint(p.x, p.y, null, null, 'smooth');
    }
    this.recomputeCurvatureSpline(sp);

    this.subpaths.push(sp);
    this.activeSubpathIndex = this.subpaths.length - 1;
    this.activePointIndex = sp.points.length - 1;
    return sp;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Direct Selection & Multi-Selection Engine
  // ══════════════════════════════════════════════════════════════════════

  selectPoint(subpathIdx, pointIdx, addToSelection = false) {
    if (!addToSelection) {
      this.selectedPoints.clear();
      this.subpaths.forEach(sp => sp.points.forEach(p => p.selected = false));
    }
    this.activeSubpathIndex = subpathIdx;
    this.activePointIndex = pointIdx;

    const pt = this.getActivePoint();
    if (pt) {
      pt.selected = true;
      this.selectedPoints.add(`${subpathIdx}:${pointIdx}`);
    }
  }

  selectAllPoints(subpathIdx) {
    const sp = this.subpaths[subpathIdx];
    if (!sp) return;
    this.activeSubpathIndex = subpathIdx;
    for (let p = 0; p < sp.points.length; p++) {
      sp.points[p].selected = true;
      this.selectedPoints.add(`${subpathIdx}:${p}`);
    }
    this.activePointIndex = 0;
  }

  deselectAll() {
    this.selectedPoints.clear();
    this.subpaths.forEach(sp => sp.points.forEach(p => p.selected = false));
    this.activePointIndex = -1;
  }

  moveSelectedPoints(dx, dy) {
    for (const key of this.selectedPoints) {
      const [sIdx, pIdx] = key.split(':').map(Number);
      const sp = this.subpaths[sIdx];
      if (sp && sp.points[pIdx]) {
        const pt = sp.points[pIdx];
        pt.x += dx;
        pt.y += dy;
        if (pt.cp1) { pt.cp1.x += dx; pt.cp1.y += dy; }
        if (pt.cp2) { pt.cp2.x += dx; pt.cp2.y += dy; }
      }
    }
  }

  boxSelect(minX, minY, maxX, maxY, addToSelection = false) {
    if (!addToSelection) this.deselectAll();
    for (let s = 0; s < this.subpaths.length; s++) {
      const sp = this.subpaths[s];
      for (let p = 0; p < sp.points.length; p++) {
        const pt = sp.points[p];
        if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
          pt.selected = true;
          this.selectedPoints.add(`${s}:${p}`);
          this.activeSubpathIndex = s;
          this.activePointIndex = p;
        }
      }
    }
  }

  duplicateSubpath(subpathIdx) {
    const sp = this.subpaths[subpathIdx];
    if (!sp) return null;
    const cloned = sp.clone();
    // Offset by +15px
    for (const p of cloned.points) {
      p.x += 15;
      p.y += 15;
      if (p.cp1) { p.cp1.x += 15; p.cp1.y += 15; }
      if (p.cp2) { p.cp2.x += 15; p.cp2.y += 15; }
    }
    this.subpaths.push(cloned);
    this.activeSubpathIndex = this.subpaths.length - 1;
    this.activePointIndex = 0;
    this.selectAllPoints(this.activeSubpathIndex);
    return cloned;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Pointer Interaction Handlers
  // ══════════════════════════════════════════════════════════════════════

  handlePointerDown(x, y, isAlt = false, isShift = false, tool = 'pen') {
    this.toolMode = tool;

    // 1. Direct Selection Tool (White Arrow)
    if (tool === 'direct-select') {
      const hit = this.hitTest(x, y, 8);
      if (hit) {
        if (hit.type === 'anchor') {
          this.selectPoint(hit.subpathIdx, hit.pointIdx, isShift);
          this.dragTarget = { type: 'anchor', subpathIdx: hit.subpathIdx, pointIdx: hit.pointIdx };
          this.dragStart = { x, y, origX: hit.point.x, origY: hit.point.y };
          return { action: 'selected_anchor', point: hit.point };
        } else if (hit.type === 'cp1' || hit.type === 'cp2') {
          this.dragTarget = { type: hit.type, subpathIdx: hit.subpathIdx, pointIdx: hit.pointIdx };
          this.dragStart = { x, y };
          return { action: 'drag_handle', handle: hit.type };
        }
      }
      // Marquee box selection on background
      this.marqueeBox = { x1: x, y1: y, x2: x, y2: y };
      this.dragTarget = { type: 'marquee' };
      if (!isShift) this.deselectAll();
      return { action: 'start_marquee' };
    }

    // 2. Path Selection Tool (Black Arrow)
    if (tool === 'path-select') {
      const hit = this.hitTest(x, y, 8);
      if (hit) {
        let sIdx = hit.subpathIdx;
        if (isAlt) {
          // Alt+Drag duplicates subpath!
          const dup = this.duplicateSubpath(sIdx);
          sIdx = this.subpaths.length - 1;
        } else {
          this.selectAllPoints(sIdx);
        }
        this.dragTarget = { type: 'subpath', subpathIdx: sIdx };
        this.dragStart = { x, y };
        return { action: 'selected_subpath', subpath: this.subpaths[sIdx] };
      }
      this.deselectAll();
      return { action: 'none' };
    }

    // 3. Curvature Pen Tool
    if (tool === 'curvature-pen') {
      const hit = this.hitTest(x, y, 8);
      if (hit && hit.type === 'anchor') {
        const sp = this.subpaths[hit.subpathIdx];
        if (!sp.closed && hit.pointIdx === 0 && sp.points.length >= 2) {
          sp.close();
          this.recomputeCurvatureSpline(sp);
          return { action: 'closed', subpath: sp };
        }
        // Double-click or Alt-click toggles smooth vs corner
        this.toggleCurvatureCorner(hit.subpathIdx, hit.pointIdx);
        return { action: 'toggled_corner', point: hit.point };
      }
      const pt = this.addCurvaturePoint(x, y, isAlt);
      this.dragTarget = { type: 'anchor', subpathIdx: this.activeSubpathIndex, pointIdx: this.activePointIndex };
      this.dragStart = { x, y, origX: pt.x, origY: pt.y };
      return { action: 'added_curvature', point: pt };
    }

    // 4. Freeform Pen Tool
    if (tool === 'freeform-pen') {
      this.freeformPoints = [{ x, y }];
      this.dragTarget = { type: 'freeform' };
      return { action: 'start_freeform' };
    }

    // 5. Add / Delete / Convert Dedicated Tools
    if (tool === 'pen-add') {
      const hit = this.hitTest(x, y, 8);
      if (hit && hit.type === 'segment') {
        const pt = this.insertPointOnSegment(hit.subpathIdx, hit.segmentIdx, hit.t, hit.x, hit.y);
        return { action: 'inserted', point: pt };
      }
      return { action: 'none' };
    }

    if (tool === 'pen-delete') {
      const hit = this.hitTest(x, y, 8);
      if (hit && hit.type === 'anchor') {
        this.selectPoint(hit.subpathIdx, hit.pointIdx);
        this.deleteActivePoint();
        return { action: 'deleted' };
      }
      return { action: 'none' };
    }

    if (tool === 'pen-convert') {
      const hit = this.hitTest(x, y, 8);
      if (hit && hit.type === 'anchor') {
        this.convertPoint(hit.point);
        this.selectPoint(hit.subpathIdx, hit.pointIdx);
        return { action: 'converted', point: hit.point };
      }
      return { action: 'none' };
    }

    // 6. Classic Standard Bézier Pen Tool (Preserves 100% Milestone 2 behavior)
    const hit = this.hitTest(x, y, 8);

    if (hit) {
      if (hit.type === 'anchor') {
        const sp = this.subpaths[hit.subpathIdx];
        if (!sp.closed && hit.pointIdx === 0 && sp.points.length >= 2) {
          sp.close();
          this.activeSubpathIndex = hit.subpathIdx;
          this.activePointIndex = 0;
          return { action: 'closed', subpath: sp };
        }

        if (isAlt) {
          this.convertPoint(hit.point);
          this.activeSubpathIndex = hit.subpathIdx;
          this.activePointIndex = hit.pointIdx;
          return { action: 'converted', point: hit.point };
        }

        this.selectPoint(hit.subpathIdx, hit.pointIdx);
        this.dragTarget = { type: 'anchor', subpathIdx: hit.subpathIdx, pointIdx: hit.pointIdx };
        this.dragStart = { x, y, origX: hit.point.x, origY: hit.point.y };
        return { action: 'selected', point: hit.point };
      }

      if (hit.type === 'cp1' || hit.type === 'cp2') {
        this.dragTarget = { type: hit.type, subpathIdx: hit.subpathIdx, pointIdx: hit.pointIdx };
        this.dragStart = { x, y };
        return { action: 'drag_handle', handle: hit.type };
      }

      if (hit.type === 'segment') {
        const pt = this.insertPointOnSegment(hit.subpathIdx, hit.segmentIdx, hit.t, hit.x, hit.y);
        this.selectPoint(hit.subpathIdx, hit.segmentIdx + 1);
        this.dragTarget = { type: 'anchor', subpathIdx: hit.subpathIdx, pointIdx: hit.segmentIdx + 1 };
        this.dragStart = { x, y, origX: pt.x, origY: pt.y };
        return { action: 'inserted', point: pt };
      }
    }

    // Empty space: add new Bézier point
    let sp = this.getActiveSubpath();
    if (!sp || sp.closed) {
      sp = this.newSubpath();
    }

    const newPt = sp.addPoint(x, y, null, null, 'corner');
    this.activePointIndex = sp.points.length - 1;
    this.isCreatingPoint = true;
    this.dragTarget = { type: 'newPoint', subpathIdx: this.activeSubpathIndex, pointIdx: this.activePointIndex };
    this.dragStart = { x, y };

    return { action: 'added', point: newPt };
  }

  handlePointerMove(x, y, isAlt = false) {
    if (!this.dragTarget) {
      this.rubberBandPoint = { x, y };
      return false;
    }

    if (this.dragTarget.type === 'freeform') {
      this.freeformPoints.push({ x, y });
      return true;
    }

    if (this.dragTarget.type === 'marquee') {
      if (this.marqueeBox) {
        this.marqueeBox.x2 = x;
        this.marqueeBox.y2 = y;
        const minX = Math.min(this.marqueeBox.x1, this.marqueeBox.x2);
        const maxX = Math.max(this.marqueeBox.x1, this.marqueeBox.x2);
        const minY = Math.min(this.marqueeBox.y1, this.marqueeBox.y2);
        const maxY = Math.max(this.marqueeBox.y1, this.marqueeBox.y2);
        this.boxSelect(minX, minY, maxX, maxY);
      }
      return true;
    }

    if (this.dragTarget.type === 'subpath') {
      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;
      this.moveSelectedPoints(dx, dy);
      this.dragStart.x = x;
      this.dragStart.y = y;
      return true;
    }

    const sp = this.subpaths[this.dragTarget.subpathIdx];
    if (!sp) return false;
    const pt = sp.points[this.dragTarget.pointIdx];
    if (!pt) return false;

    if (this.dragTarget.type === 'newPoint' || this.isCreatingPoint) {
      const dx = x - pt.x;
      const dy = y - pt.y;

      if (Math.hypot(dx, dy) > 2) {
        pt.type = 'smooth';
        pt.cp2 = { x: pt.x + dx, y: pt.y + dy };
        if (!isAlt) {
          pt.cp1 = { x: pt.x - dx, y: pt.y - dy };
        }
      }
      return true;
    }

    if (this.dragTarget.type === 'anchor') {
      const dx = x - (this.lastDragX || this.dragStart.x);
      const dy = y - (this.lastDragY || this.dragStart.y);

      if (this.selectedPoints.size > 1 && this.selectedPoints.has(`${this.dragTarget.subpathIdx}:${this.dragTarget.pointIdx}`)) {
        this.moveSelectedPoints(dx, dy);
      } else {
        pt.x += dx;
        pt.y += dy;
        if (pt.cp1) { pt.cp1.x += dx; pt.cp1.y += dy; }
        if (pt.cp2) { pt.cp2.x += dx; pt.cp2.y += dy; }
      }
      this.lastDragX = x;
      this.lastDragY = y;
      if (this.toolMode === 'curvature-pen') {
        this.recomputeCurvatureSpline(sp);
      }
      return true;
    }

    if (this.dragTarget.type === 'cp1') {
      pt.cp1 = { x, y };
      if (pt.type === 'smooth' && !isAlt && pt.cp2) {
        const dx = pt.x - x;
        const dy = pt.y - y;
        const dist = Math.hypot(pt.cp2.x - pt.x, pt.cp2.y - pt.y);
        const curDist = Math.hypot(dx, dy) || 1;
        pt.cp2.x = pt.x + (dx / curDist) * dist;
        pt.cp2.y = pt.y + (dy / curDist) * dist;
      }
      return true;
    }

    if (this.dragTarget.type === 'cp2') {
      pt.cp2 = { x, y };
      if (pt.type === 'smooth' && !isAlt && pt.cp1) {
        const dx = pt.x - x;
        const dy = pt.y - y;
        const dist = Math.hypot(pt.cp1.x - pt.x, pt.cp1.y - pt.y);
        const curDist = Math.hypot(dx, dy) || 1;
        pt.cp1.x = pt.x + (dx / curDist) * dist;
        pt.cp1.y = pt.y + (dy / curDist) * dist;
      }
      return true;
    }

    return false;
  }

  handlePointerUp() {
    if (this.dragTarget && this.dragTarget.type === 'freeform') {
      this.finishFreeform(this.freeformPoints, this.freeformTolerance, true);
      this.freeformPoints = [];
    }

    this.dragTarget = null;
    this.dragStart = null;
    this.lastDragX = null;
    this.lastDragY = null;
    this.isCreatingPoint = false;
    this.marqueeBox = null;
  }

  convertPoint(pt) {
    if (pt.type === 'corner') {
      pt.type = 'smooth';
      const offset = 25;
      pt.cp1 = { x: pt.x - offset, y: pt.y };
      pt.cp2 = { x: pt.x + offset, y: pt.y };
    } else {
      pt.type = 'corner';
      pt.cp1 = null;
      pt.cp2 = null;
    }
  }

  insertPointOnSegment(subpathIdx, segmentIdx, t, x, y) {
    const sp = this.subpaths[subpathIdx];
    if (!sp) return null;
    const p1 = sp.points[segmentIdx];
    const p2 = sp.points[(segmentIdx + 1) % sp.points.length];

    // De Casteljau subdivision at parameter t
    const c1 = p1.cp2 || { x: p1.x, y: p1.y };
    const c2 = p2.cp1 || { x: p2.x, y: p2.y };

    const p12 = { x: (1 - t) * p1.x + t * c1.x, y: (1 - t) * p1.y + t * c1.y };
    const p23 = { x: (1 - t) * c1.x + t * c2.x, y: (1 - t) * c1.y + t * c2.y };
    const p34 = { x: (1 - t) * c2.x + t * p2.x, y: (1 - t) * c2.y + t * p2.y };

    const p123 = { x: (1 - t) * p12.x + t * p23.x, y: (1 - t) * p12.y + t * p23.y };
    const p234 = { x: (1 - t) * p23.x + t * p34.x, y: (1 - t) * p23.y + t * p34.y };

    p1.cp2 = p12;
    p2.cp1 = p34;

    const newPt = new VectorPoint(x, y, p123, p234, 'smooth');
    sp.points.splice(segmentIdx + 1, 0, newPt);
    return newPt;
  }

  deleteActivePoint() {
    const sp = this.getActiveSubpath();
    if (!sp || this.activePointIndex === -1) return false;

    sp.points.splice(this.activePointIndex, 1);
    if (sp.points.length === 0) {
      this.subpaths.splice(this.activeSubpathIndex, 1);
      this.activeSubpathIndex = Math.max(0, this.subpaths.length - 1);
      this.activePointIndex = -1;
    } else {
      this.activePointIndex = Math.min(this.activePointIndex, sp.points.length - 1);
      this.selectPoint(this.activeSubpathIndex, this.activePointIndex);
      if (this.toolMode === 'curvature-pen') {
        this.recomputeCurvatureSpline(sp);
      }
    }
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Parametric Vector Shape Generators
  // ══════════════════════════════════════════════════════════════════════

  createRectangle(x, y, w, h, radius = 0) {
    const sp = new Subpath([], true);
    radius = Math.max(0, Math.min(radius, Math.min(w / 2, h / 2)));

    if (radius <= 0) {
      sp.addPoint(x, y, null, null, 'corner');
      sp.addPoint(x + w, y, null, null, 'corner');
      sp.addPoint(x + w, y + h, null, null, 'corner');
      sp.addPoint(x, y + h, null, null, 'corner');
    } else {
      const k = 0.5522847498 * radius;
      sp.addPoint(x + radius, y, { x: x + radius - k, y }, null, 'smooth');
      sp.addPoint(x + w - radius, y, null, { x: x + w - radius + k, y }, 'smooth');
      sp.addPoint(x + w, y + radius, { x: x + w, y: y + radius - k }, null, 'smooth');
      sp.addPoint(x + w, y + h - radius, null, { x: x + w, y: y + h - radius + k }, 'smooth');
      sp.addPoint(x + w - radius, y + h, { x: x + w - radius + k, y: y + h }, null, 'smooth');
      sp.addPoint(x + radius, y + h, null, { x: x + radius - k, y: y + h }, 'smooth');
      sp.addPoint(x, y + h - radius, { x, y: y + h - radius + k }, null, 'smooth');
      sp.addPoint(x, y + radius, null, { x, y: y + radius - k }, 'smooth');
    }

    this.subpaths = [sp];
    this.activeSubpathIndex = 0;
    this.activePointIndex = 0;
    return sp;
  }

  createEllipse(cx, cy, rx, ry) {
    const sp = new Subpath([], true);
    const kx = 0.5522847498 * rx;
    const ky = 0.5522847498 * ry;

    sp.addPoint(cx, cy - ry, { x: cx - kx, y: cy - ry }, { x: cx + kx, y: cy - ry }, 'smooth');
    sp.addPoint(cx + rx, cy, { x: cx + rx, y: cy - ky }, { x: cx + rx, y: cy + ky }, 'smooth');
    sp.addPoint(cx, cy + ry, { x: cx + kx, y: cy + ry }, { x: cx - kx, y: cy + ry }, 'smooth');
    sp.addPoint(cx - rx, cy, { x: cx - rx, y: cy + ky }, { x: cx - rx, y: cy - ky }, 'smooth');

    this.subpaths = [sp];
    this.activeSubpathIndex = 0;
    this.activePointIndex = 0;
    return sp;
  }

  createPolygon(cx, cy, radius, sides = 5) {
    sides = Math.max(3, Math.min(32, sides));
    const sp = new Subpath([], true);

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      sp.addPoint(x, y, null, null, 'corner');
    }

    this.subpaths = [sp];
    this.activeSubpathIndex = 0;
    this.activePointIndex = 0;
    return sp;
  }

  createStar(cx, cy, outerR, innerR, points = 5) {
    points = Math.max(3, Math.min(32, points));
    const sp = new Subpath([], true);

    for (let i = 0; i < points * 2; i++) {
      const r = (i % 2 === 0) ? outerR : innerR;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      sp.addPoint(x, y, null, null, 'corner');
    }

    this.subpaths = [sp];
    this.activeSubpathIndex = 0;
    this.activePointIndex = 0;
    return sp;
  }

  createLine(x1, y1, x2, y2) {
    const sp = new Subpath([], false);
    sp.addPoint(x1, y1, null, null, 'corner');
    sp.addPoint(x2, y2, null, null, 'corner');

    this.subpaths = [sp];
    this.activeSubpathIndex = 0;
    this.activePointIndex = 1;
    return sp;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Vector Path Boolean Operations (Photoshop Pathfinder / Combine Shapes)
  // ══════════════════════════════════════════════════════════════════════

  buildCanvasPath(ctx, subpaths = null) {
    const paths = subpaths || this.subpaths;
    ctx.beginPath();
    paths.forEach(sp => {
      const count = sp.points.length;
      if (count === 0) return;

      ctx.moveTo(sp.points[0].x, sp.points[0].y);

      for (let i = 1; i < count; i++) {
        const prev = sp.points[i - 1];
        const cur = sp.points[i];
        if (prev.cp2 && cur.cp1) {
          ctx.bezierCurveTo(prev.cp2.x, prev.cp2.y, cur.cp1.x, cur.cp1.y, cur.x, cur.y);
        } else if (prev.cp2) {
          ctx.quadraticCurveTo(prev.cp2.x, prev.cp2.y, cur.x, cur.y);
        } else if (cur.cp1) {
          ctx.quadraticCurveTo(cur.cp1.x, cur.cp1.y, cur.x, cur.y);
        } else {
          ctx.lineTo(cur.x, cur.y);
        }
      }

      if (sp.closed && count > 1) {
        const last = sp.points[count - 1];
        const first = sp.points[0];
        if (last.cp2 && first.cp1) {
          ctx.bezierCurveTo(last.cp2.x, last.cp2.y, first.cp1.x, first.cp1.y, first.x, first.y);
        } else if (last.cp2) {
          ctx.quadraticCurveTo(last.cp2.x, last.cp2.y, first.x, first.y);
        } else if (first.cp1) {
          ctx.quadraticCurveTo(first.cp1.x, first.cp1.y, first.x, first.y);
        } else {
          ctx.closePath();
        }
      }
    });
  }

  combinePaths(operation = 'union', subpathsA = null, subpathsB = null) {
    let a = subpathsA;
    let b = subpathsB;

    if (!a && !b) {
      if (this.subpaths.length < 2) return this.subpaths;
      a = [this.subpaths[0]];
      b = this.subpaths.slice(1);
    } else if (!b) {
      return a;
    }

    // High-precision vector analytical CSG when VectorPathfinder is present
    if (typeof VectorPathfinder !== 'undefined' && a.length > 0 && b.length > 0) {
      try {
        let currentResult = [a[0]];
        for (let i = 1; i < a.length; i++) {
          currentResult = VectorPathfinder.combineSubpaths(currentResult[0], a[i], 'union');
        }
        for (const spB of b) {
          currentResult = VectorPathfinder.combineSubpaths(currentResult[0], spB, operation);
        }
        if (currentResult && currentResult.length > 0) {
          this.subpaths = currentResult;
          this.activeSubpathIndex = 0;
          this.activePointIndex = 0;
          return this.subpaths;
        }
      } catch (err) {
        // Fall back to buffer-based tracing
      }
    }

    // Determine bounding box with margin
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const sp of [...a, ...b]) {
      const box = sp.getBounds();
      if (box.minX < minX) minX = box.minX;
      if (box.minY < minY) minY = box.minY;
      if (box.maxX > maxX) maxX = box.maxX;
      if (box.maxY > maxY) maxY = box.maxY;
    }

    const pad = 20;
    const originX = Math.floor(minX) - pad;
    const originY = Math.floor(minY) - pad;
    const w = Math.ceil(maxX - minX) + pad * 2;
    const h = Math.ceil(maxY - minY) + pad * 2;

    const createBuffer = () => {
      if (typeof Utils !== 'undefined' && Utils.createCanvas) return Utils.createCanvas(w, h);
      if (typeof document !== 'undefined' && document.createElement) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
      }
      return null;
    };

    const canvas = createBuffer();
    if (!canvas) {
      // Fallback for mocked environments: return combined subpaths array
      if (operation === 'union') {
        this.subpaths = [...a, ...b];
      }
      return this.subpaths;
    }

    const ctx = canvas.getContext('2d');
    ctx.translate(-originX, -originY);

    // Draw A
    ctx.fillStyle = '#ffffff';
    this.buildCanvasPath(ctx, a);
    ctx.fill();

    // Composite B
    switch (operation) {
      case 'subtract':
      case 'difference':
        ctx.globalCompositeOperation = 'destination-out';
        break;
      case 'intersect':
      case 'intersection':
        ctx.globalCompositeOperation = 'source-in';
        break;
      case 'exclude':
      case 'xor':
        ctx.globalCompositeOperation = 'xor';
        break;
      case 'union':
      default:
        ctx.globalCompositeOperation = 'source-over';
        break;
    }

    this.buildCanvasPath(ctx, b);
    ctx.fill();

    // Extract contour from composite buffer
    const imgData = ctx.getImageData(0, 0, w, h);
    const resultSubpath = this._traceContourToSubpath(imgData, originX, originY, w, h);
    if (resultSubpath) {
      this.subpaths = [resultSubpath];
      this.activeSubpathIndex = 0;
      this.activePointIndex = 0;
    }
    return this.subpaths;
  }

  _traceContourToSubpath(imgData, originX, originY, w, h) {
    const d = imgData.data;
    const isSolid = (x, y) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return false;
      return d[(y * w + x) * 4 + 3] > 128;
    };

    // Find first solid pixel
    let startX = -1, startY = -1;
    for (let y = 0; y < h && startX === -1; y++) {
      for (let x = 0; x < w; x++) {
        if (isSolid(x, y)) {
          startX = x;
          startY = y;
          break;
        }
      }
    }

    if (startX === -1) return null;

    // Moore-Neighbor boundary tracing
    const boundary = [];
    let curX = startX, curY = startY;
    let bX = startX - 1, bY = startY; // backtrack pixel

    const dirs = [
      { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
      { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
    ];

    let maxSteps = w * h;
    while (maxSteps-- > 0) {
      boundary.push({ x: curX + originX, y: curY + originY });

      // Find index of backtrack
      let bIdx = 0;
      for (let i = 0; i < 8; i++) {
        if (curX + dirs[i].dx === bX && curY + dirs[i].dy === bY) {
          bIdx = i;
          break;
        }
      }

      let found = false;
      for (let i = 1; i <= 8; i++) {
        const nextIdx = (bIdx + i) % 8;
        const nx = curX + dirs[nextIdx].dx;
        const ny = curY + dirs[nextIdx].dy;
        if (isSolid(nx, ny)) {
          bX = curX + dirs[(nextIdx + 7) % 8].dx;
          bY = curY + dirs[(nextIdx + 7) % 8].dy;
          curX = nx;
          curY = ny;
          found = true;
          break;
        }
      }

      if (!found || (curX === startX && curY === startY)) break;
    }

    if (boundary.length < 3) return null;
    return this.finishFreeform(boundary, 1.5, true);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Text-on-Path (Arc-Length Parameterization & Tangent Sampling)
  // ══════════════════════════════════════════════════════════════════════

  getArcLengthData(subpathIndex = 0) {
    const sp = this.subpaths[subpathIndex] || this.getActiveSubpath();
    if (!sp || sp.points.length < 2) return null;

    const count = sp.points.length;
    const segCount = sp.closed ? count : count - 1;
    const samples = [];
    let totalLength = 0;

    for (let i = 0; i < segCount; i++) {
      const p1 = sp.points[i];
      const p2 = sp.points[(i + 1) % count];
      const cp1 = p1.cp2 || { x: p1.x, y: p1.y };
      const cp2 = p2.cp1 || { x: p2.x, y: p2.y };

      let lastX = p1.x;
      let lastY = p1.y;
      const steps = 30;

      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const bx = (1 - t) ** 3 * p1.x + 3 * (1 - t) ** 2 * t * cp1.x + 3 * (1 - t) * t ** 2 * cp2.x + t ** 3 * p2.x;
        const by = (1 - t) ** 3 * p1.y + 3 * (1 - t) ** 2 * t * cp1.y + 3 * (1 - t) * t ** 2 * cp2.y + t ** 3 * p2.y;

        // Tangent derivative
        const dx = 3 * (1 - t) ** 2 * (cp1.x - p1.x) + 6 * (1 - t) * t * (cp2.x - cp1.x) + 3 * t ** 2 * (p2.x - cp2.x);
        const dy = 3 * (1 - t) ** 2 * (cp1.y - p1.y) + 6 * (1 - t) * t * (cp2.y - cp1.y) + 3 * t ** 2 * (p2.y - cp2.y);
        const angle = Math.atan2(dy, dx);

        const d = Math.hypot(bx - lastX, by - lastY);
        totalLength += d;
        samples.push({ dist: totalLength, x: bx, y: by, angle });
        lastX = bx;
        lastY = by;
      }
    }

    return { totalLength, samples, closed: sp.closed };
  }

  samplePointAtDistance(targetDist, arcData) {
    if (!arcData || arcData.samples.length === 0) return null;
    const { totalLength, samples, closed } = arcData;

    let d = targetDist;
    if (closed && totalLength > 0) {
      d = ((d % totalLength) + totalLength) % totalLength;
    } else {
      d = Math.max(0, Math.min(totalLength, d));
    }

    let low = 0, high = samples.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (samples[mid].dist < d) low = mid + 1;
      else high = mid - 1;
    }

    const idx = Math.min(samples.length - 1, Math.max(0, low));
    return samples[idx];
  }

  // ══════════════════════════════════════════════════════════════════════
  // Selection & Raster Operations (with Feathering)
  // ══════════════════════════════════════════════════════════════════════

  makeSelection(width, height, feather = 0) {
    if (this.isEmpty()) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.subpaths.forEach(sp => {
      sp.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });

    minX = Math.max(0, Math.floor(minX - feather));
    minY = Math.max(0, Math.floor(minY - feather));
    maxX = Math.min(width - 1, Math.ceil(maxX + feather));
    maxY = Math.min(height - 1, Math.ceil(maxY + feather));

    const w = Math.max(1, maxX - minX + 1);
    const h = Math.max(1, maxY - minY + 1);

    const maskCanvas = (typeof Utils !== 'undefined' && Utils.createCanvas)
      ? Utils.createCanvas(width, height)
      : { getContext: () => ({ fill: () => {}, getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }) }) };

    const mCtx = maskCanvas.getContext('2d');
    if (mCtx) {
      mCtx.fillStyle = '#ffffff';
      this.buildCanvasPath(mCtx);
      mCtx.fill();
    }

    const imgData = mCtx ? mCtx.getImageData(0, 0, width, height) : { data: new Uint8ClampedArray(width * height * 4) };
    const d = imgData.data;
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = d[i * 4 + 3] > 128 ? 1 : 0;
    }

    return {
      type: 'path',
      x: minX,
      y: minY,
      w,
      h,
      mask,
      feather
    };
  }

  makeWorkPathFromSelection(selection, tolerance = 2.0) {
    if (!selection || !selection.mask) return null;
    const { x: offX, y: offY, w, h, mask } = selection;

    const imgData = { data: new Uint8ClampedArray(w * h * 4) };
    for (let i = 0; i < w * h; i++) {
      imgData.data[i * 4 + 3] = mask[i] ? 255 : 0;
    }

    const sp = this._traceContourToSubpath(imgData, offX, offY, w, h);
    if (sp) {
      this.subpaths = [sp];
      this.activeSubpathIndex = 0;
      this.activePointIndex = 0;
      return sp;
    }
    return null;
  }

  strokePath(ctx, strokeStyle = '#ffffff', lineWidth = 2, dash = [], lineCap = 'round', lineJoin = 'round', align = 'center', profile = 'uniform') {
    if (typeof VectorStrokeProfiler !== 'undefined' && profile && profile !== 'uniform') {
      const activeSp = this.getActiveSubpath() || (this.subpaths.length > 0 ? this.subpaths[0] : null);
      if (activeSp && activeSp.points && activeSp.points.length >= 2) {
        const polyPts = activeSp.points.map(p => ({ x: p.x, y: p.y }));
        VectorStrokeProfiler.renderVariableStroke(ctx, polyPts, lineWidth, profile, strokeStyle, activeSp.closed);
        return;
      }
    }

    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = lineCap;
    ctx.lineJoin = lineJoin;
    if (dash && dash.length > 0) ctx.setLineDash(dash);

    if (align === 'inside') {
      ctx.save();
      this.buildCanvasPath(ctx);
      ctx.clip();
      ctx.lineWidth = lineWidth * 2;
      this.buildCanvasPath(ctx);
      ctx.stroke();
      ctx.restore();
    } else {
      this.buildCanvasPath(ctx);
      ctx.stroke();
    }
    ctx.restore();
  }

  fillPath(ctx, fillStyle = '#3b82f6') {
    ctx.save();
    ctx.fillStyle = fillStyle;
    this.buildCanvasPath(ctx);
    ctx.fill();
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════
  // SVG Export Engine
  // ══════════════════════════════════════════════════════════════════════

  toSVGPathData(subpaths = null) {
    const paths = subpaths || this.subpaths;
    const parts = [];

    for (const sp of paths) {
      const count = sp.points.length;
      if (count === 0) continue;

      parts.push(`M ${sp.points[0].x.toFixed(2)} ${sp.points[0].y.toFixed(2)}`);

      for (let i = 1; i < count; i++) {
        const prev = sp.points[i - 1];
        const cur = sp.points[i];
        if (prev.cp2 && cur.cp1) {
          parts.push(`C ${prev.cp2.x.toFixed(2)} ${prev.cp2.y.toFixed(2)}, ${cur.cp1.x.toFixed(2)} ${cur.cp1.y.toFixed(2)}, ${cur.x.toFixed(2)} ${cur.y.toFixed(2)}`);
        } else if (prev.cp2) {
          parts.push(`Q ${prev.cp2.x.toFixed(2)} ${prev.cp2.y.toFixed(2)}, ${cur.x.toFixed(2)} ${cur.y.toFixed(2)}`);
        } else if (cur.cp1) {
          parts.push(`Q ${cur.cp1.x.toFixed(2)} ${cur.cp1.y.toFixed(2)}, ${cur.x.toFixed(2)} ${cur.y.toFixed(2)}`);
        } else {
          parts.push(`L ${cur.x.toFixed(2)} ${cur.y.toFixed(2)}`);
        }
      }

      if (sp.closed && count > 1) {
        const last = sp.points[count - 1];
        const first = sp.points[0];
        if (last.cp2 && first.cp1) {
          parts.push(`C ${last.cp2.x.toFixed(2)} ${last.cp2.y.toFixed(2)}, ${first.cp1.x.toFixed(2)} ${first.cp1.y.toFixed(2)}, ${first.x.toFixed(2)} ${first.y.toFixed(2)} Z`);
        } else {
          parts.push('Z');
        }
      }
    }

    return parts.join(' ');
  }

  exportSVG(width = 800, height = 600, options = {}) {
    const d = this.toSVGPathData();
    const fill = options.fill || this.fillColor || '#3b82f6';
    const stroke = options.stroke || this.strokeColor || '#ffffff';
    const strokeWidth = options.strokeWidth !== undefined ? options.strokeWidth : this.strokeWidth;
    const dashArray = (this.lineDash && this.lineDash.length > 0) ? `stroke-dasharray="${this.lineDash.join(' ')}"` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashArray} stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}" />
</svg>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Saved Paths Catalog (Photoshop Paths Panel Parity)
  // ══════════════════════════════════════════════════════════════════════

  saveWorkPath(name = null) {
    if (this.isEmpty()) return null;
    this.pathCounter++;
    const pathName = name || `Path ${this.pathCounter}`;
    const id = `path_${Date.now()}_${this.pathCounter}`;

    const saved = {
      id,
      name: pathName,
      subpaths: this.subpaths.map(sp => sp.clone())
    };

    this.savedPaths.push(saved);
    this.activeSavedPathId = id;
    return saved;
  }

  loadSavedPath(id) {
    const item = this.savedPaths.find(p => p.id === id);
    if (!item) return false;
    this.subpaths = item.subpaths.map(sp => sp.clone());
    this.activeSubpathIndex = this.subpaths.length > 0 ? 0 : -1;
    this.activePointIndex = (this.subpaths.length > 0 && this.subpaths[0].points.length > 0) ? 0 : -1;
    this.activeSavedPathId = id;
    return true;
  }

  duplicateSavedPath(id) {
    const item = this.savedPaths.find(p => p.id === id);
    if (!item) return null;
    this.pathCounter++;
    const dup = {
      id: `path_${Date.now()}_${this.pathCounter}`,
      name: `${item.name} copy`,
      subpaths: item.subpaths.map(sp => sp.clone())
    };
    this.savedPaths.push(dup);
    return dup;
  }

  deleteSavedPath(id) {
    const idx = this.savedPaths.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.savedPaths.splice(idx, 1);
    if (this.activeSavedPathId === id) {
      this.activeSavedPathId = this.savedPaths.length > 0 ? this.savedPaths[this.savedPaths.length - 1].id : null;
    }
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Overlay Rendering
  // ══════════════════════════════════════════════════════════════════════

  renderOverlay(ctx, zoom = 1, panX = 0, panY = 0) {
    if (this.isEmpty() && !this.marqueeBox && this.freeformPoints.length === 0) return;

    ctx.save();

    // 1. Draw smooth path curves
    if (!this.isEmpty()) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      this.buildCanvasPath(ctx);
      ctx.stroke();
    }

    // 2. Draw live freeform stroke while drawing
    if (this.freeformPoints.length > 1) {
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.freeformPoints[0].x, this.freeformPoints[0].y);
      for (let i = 1; i < this.freeformPoints.length; i++) {
        ctx.lineTo(this.freeformPoints[i].x, this.freeformPoints[i].y);
      }
      ctx.stroke();
    }

    // 3. Draw marquee selection box
    if (this.marqueeBox) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const mx = Math.min(this.marqueeBox.x1, this.marqueeBox.x2);
      const my = Math.min(this.marqueeBox.y1, this.marqueeBox.y2);
      const mw = Math.abs(this.marqueeBox.x2 - this.marqueeBox.x1);
      const mh = Math.abs(this.marqueeBox.y2 - this.marqueeBox.y1);
      ctx.strokeRect(mx, my, mw, mh);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.fillRect(mx, my, mw, mh);
      ctx.setLineDash([]);
    }

    // 4. Draw points, direction handles, and tangent lines
    this.subpaths.forEach((sp, sIdx) => {
      sp.points.forEach((pt, pIdx) => {
        const isKeySelected = this.selectedPoints.has(`${sIdx}:${pIdx}`);
        const isActive = (sIdx === this.activeSubpathIndex && pIdx === this.activePointIndex);

        if (isActive || isKeySelected) {
          ctx.strokeStyle = '#00a3cc';
          ctx.lineWidth = 1;

          if (pt.cp1) {
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(pt.cp1.x, pt.cp1.y);
            ctx.stroke();

            ctx.fillStyle = '#00e5ff';
            ctx.beginPath();
            ctx.arc(pt.cp1.x, pt.cp1.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.stroke();
          }

          if (pt.cp2) {
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(pt.cp2.x, pt.cp2.y);
            ctx.stroke();

            ctx.fillStyle = '#00e5ff';
            ctx.beginPath();
            ctx.arc(pt.cp2.x, pt.cp2.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.stroke();
          }
        }

        // Anchor point rendering: square for corner, circle for smooth curvature
        const size = 6;
        const isSelected = isActive || pt.selected || isKeySelected;

        if (pt.type === 'corner') {
          // Sharp corner point (Square)
          ctx.fillStyle = isSelected ? '#00e5ff' : '#ffffff';
          ctx.strokeStyle = isSelected ? '#000000' : '#007799';
          ctx.lineWidth = 1;
          ctx.fillRect(pt.x - size / 2, pt.y - size / 2, size, size);
          ctx.strokeRect(pt.x - size / 2, pt.y - size / 2, size, size);
        } else {
          // Smooth curve point (Circle)
          ctx.fillStyle = isSelected ? '#00e5ff' : '#ffffff';
          ctx.strokeStyle = isSelected ? '#000000' : '#007799';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });
    });

    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════
  // Serialization (toJSON & fromJSON)
  // ══════════════════════════════════════════════════════════════════════

  toJSON() {
    return {
      subpaths: this.subpaths.map(sp => ({
        closed: sp.closed,
        points: sp.points.map(p => ({
          x: p.x,
          y: p.y,
          cp1: p.cp1 ? { ...p.cp1 } : null,
          cp2: p.cp2 ? { ...p.cp2 } : null,
          type: p.type
        }))
      })),
      savedPaths: this.savedPaths.map(p => ({
        id: p.id,
        name: p.name,
        subpaths: p.subpaths.map(sp => ({
          closed: sp.closed,
          points: sp.points.map(pt => ({
            x: pt.x,
            y: pt.y,
            cp1: pt.cp1 ? { ...pt.cp1 } : null,
            cp2: pt.cp2 ? { ...pt.cp2 } : null,
            type: pt.type
          }))
        }))
      })),
      activeSavedPathId: this.activeSavedPathId
    };
  }

  fromJSON(json) {
    if (!json || !json.subpaths) return;
    this.subpaths = json.subpaths.map(spData => {
      const pts = (spData.points || []).map(p => new VectorPoint(p.x, p.y, p.cp1, p.cp2, p.type));
      return new Subpath(pts, !!spData.closed);
    });
    this.activeSubpathIndex = this.subpaths.length > 0 ? 0 : -1;
    this.activePointIndex = this.subpaths.length > 0 && this.subpaths[0].points.length > 0 ? 0 : -1;

    if (json.savedPaths && Array.isArray(json.savedPaths)) {
      this.savedPaths = json.savedPaths.map(p => ({
        id: p.id,
        name: p.name,
        subpaths: (p.subpaths || []).map(spData => {
          const pts = (spData.points || []).map(pt => new VectorPoint(pt.x, pt.y, pt.cp1, pt.cp2, pt.type));
          return new Subpath(pts, !!spData.closed);
        })
      }));
      this.activeSavedPathId = json.activeSavedPathId || null;
    }
  }
}

// CommonJS & Browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VectorPoint, Subpath, PathManager };
}
if (typeof window !== 'undefined') {
  window.VectorPoint = VectorPoint;
  window.Subpath = Subpath;
  window.PathManager = PathManager;
}
