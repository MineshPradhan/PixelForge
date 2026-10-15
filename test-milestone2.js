// test-milestone2.js - Comprehensive Verification Suite for Milestone 2
// Tests: Vector & Precision Path Engine, Bézier Pen Tool, Anchor Point Editing,
// Parametric Vector Shapes (Rect, Rounded Rect, Ellipse, Polygon, Star, Line),
// Path Operations (Selection, Stroke, Fill), and Serialization.

class MockContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this._stack = [];
    this.ops = [];
  }
  save() {
    this._stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth
    });
  }
  restore() {
    const s = this._stack.pop();
    if (s) {
      this.fillStyle = s.fillStyle;
      this.strokeStyle = s.strokeStyle;
      this.lineWidth = s.lineWidth;
    }
  }
  beginPath() { this.ops.push(['beginPath']); }
  closePath() { this.ops.push(['closePath']); }
  moveTo(x, y) { this.ops.push(['moveTo', x, y]); }
  lineTo(x, y) { this.ops.push(['lineTo', x, y]); }
  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    this.ops.push(['bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y]);
  }
  quadraticCurveTo(cpx, cpy, x, y) {
    this.ops.push(['quadraticCurveTo', cpx, cpy, x, y]);
  }
  stroke() { this.ops.push(['stroke', { strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }]); }
  fill() { this.ops.push(['fill', { fillStyle: this.fillStyle }]); }
  fillRect(x, y, w, h) { this.ops.push(['fillRect', x, y, w, h]); }
  clearRect(x, y, w, h) { this.ops.push(['clearRect', x, y, w, h]); }
  strokeRect(x, y, w, h) { this.ops.push(['strokeRect', x, y, w, h]); }
  setLineDash(dash) {}
  arc(x, y, r, sa, ea) { this.ops.push(['arc', x, y, r, sa, ea]); }
  getImageData(x, y, w, h) {
    const data = new Uint8ClampedArray(w * h * 4);
    // Fill interior with non-zero alpha to simulate rasterized path fill
    for (let i = 0; i < data.length; i += 4) {
      data[i + 3] = 255;
    }
    return { width: w, height: h, data };
  }
  putImageData(imgData, x, y) {}
}

class MockCanvas {
  constructor(w = 100, h = 100) {
    this.width = w;
    this.height = h;
    this._ctx = new MockContext2D(this);
  }
  getContext(type) {
    return this._ctx;
  }
  toDataURL() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
}

global.Utils = {
  createCanvas: (w, h) => new MockCanvas(w, h),
  clamp: (v, min, max) => Math.max(min, Math.min(max, v))
};

const { VectorPoint, Subpath, PathManager } = require('./js/paths.js');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failedTests++;
  }
}

console.log('=== RUNNING MILESTONE 2 VERIFICATION SUITE ===\n');

// ── Test 1: VectorPoint & Subpath Data Structures ──
console.log('[Suite 1: VectorPoint & Subpath]');
const p1 = new VectorPoint(50, 50, { x: 30, y: 50 }, { x: 70, y: 50 }, 'smooth');
assert(p1.x === 50 && p1.y === 50, 'VectorPoint initialized coordinates');
assert(p1.cp1.x === 30 && p1.cp2.x === 70, 'VectorPoint handles assigned');
assert(p1.type === 'smooth', 'VectorPoint type is smooth');

const p1Clone = p1.clone();
assert(p1Clone.x === p1.x && p1Clone.cp1.x === 30, 'VectorPoint cloned correctly');
p1Clone.x = 999;
assert(p1.x === 50, 'VectorPoint clone is deep and decoupled');

const sp = new Subpath();
assert(sp.points.length === 0 && !sp.closed, 'Subpath initialized open and empty');
sp.addPoint(10, 10);
sp.addPoint(100, 10);
sp.close();
assert(sp.points.length === 2 && sp.closed, 'Points added and subpath closed');

// ── Test 2: PathManager Pen Tool Interactions ──
console.log('\n[Suite 2: Pen Tool Interactivity & Hit Testing]');
const pm = new PathManager();
assert(pm.isEmpty(), 'PathManager starts empty');

// Click 1: create first corner point at (100, 100)
const res1 = pm.handlePointerDown(100, 100, false);
assert(res1.action === 'added', 'Pen pointer down adds new point');
assert(pm.subpaths.length === 1, 'Active subpath created');
assert(pm.subpaths[0].points.length === 1, 'First anchor created at (100, 100)');
pm.handlePointerUp();

// Click 2 & drag: create smooth point at (200, 100) and drag handle to (240, 140)
const res2 = pm.handlePointerDown(200, 100, false);
assert(res2.action === 'added', 'Second anchor added');
pm.handlePointerMove(240, 140, false);
const pt2 = pm.getActivePoint();
assert(pt2.type === 'smooth', 'Dragging anchor converts it to smooth point');
assert(pt2.cp2.x === 240 && pt2.cp2.y === 140, 'Outgoing handle follows drag');
assert(pt2.cp1.x === 160 && pt2.cp1.y === 60, 'Incoming handle symmetrically mirrored (200 - 40, 100 - 40)');
pm.handlePointerUp();

// Hit test anchor
const hitAnchor = pm.hitTest(100, 100, 8);
assert(hitAnchor && hitAnchor.type === 'anchor', 'Hit test successfully detected anchor at (100, 100)');

// Hit test handle
const hitHandle = pm.hitTest(240, 140, 8);
assert(hitHandle && hitHandle.type === 'cp2', 'Hit test successfully detected cp2 control handle');

// Close path by clicking first point
const resClose = pm.handlePointerDown(100, 100, false);
assert(resClose.action === 'closed', 'Clicking first point closes the subpath');
assert(pm.subpaths[0].closed === true, 'Subpath state marked closed');
pm.handlePointerUp();

// ── Test 3: Anchor Point Conversion & Segment Splitting ──
console.log('\n[Suite 3: Convert Point (Alt+Click) & De Casteljau Split]');
// Alt+Click smooth point to convert back to corner
const resConvert = pm.handlePointerDown(200, 100, true); // isAlt = true
assert(resConvert.action === 'converted', 'Alt+Click converts point');
assert(resConvert.point.type === 'corner', 'Point converted to corner');
assert(resConvert.point.cp1 === null && resConvert.point.cp2 === null, 'Handles collapsed on corner point');
pm.handlePointerUp();

// Convert back to smooth
pm.handlePointerDown(200, 100, true);
assert(pm.getActivePoint().type === 'smooth', 'Alt+Click converts corner point back to smooth');
pm.handlePointerUp();

// Insert point on segment using de Casteljau split
const initialCount = pm.subpaths[0].points.length;
const newPt = pm.insertPointOnSegment(0, 0, 0.5, 150, 100);
assert(newPt !== null, 'Point successfully inserted on segment');
assert(pm.subpaths[0].points.length === initialCount + 1, 'Subpath point count incremented');

// Delete active point
const delSuccess = pm.deleteActivePoint();
assert(delSuccess === true, 'deleteActivePoint succeeds');
assert(pm.subpaths[0].points.length === initialCount, 'Point count decremented after delete');

// ── Test 4: Parametric Vector Shapes ──
console.log('\n[Suite 4: Parametric Vector Shape Generators]');
// 1. Rectangle
const rectSp = pm.createRectangle(50, 50, 100, 80, 0);
assert(rectSp.points.length === 4 && rectSp.closed, 'Rectangle generated with 4 corners and closed');
assert(rectSp.points[0].x === 50 && rectSp.points[2].x === 150, 'Rectangle bounds verified');

// 2. Rounded Rectangle
const roundSp = pm.createRectangle(50, 50, 100, 80, 10);
assert(roundSp.points.length === 8 && roundSp.closed, 'Rounded Rectangle generated with 8 smooth Bézier points');
assert(roundSp.points.every(p => p.type === 'smooth'), 'All rounded rectangle points are smooth Bézier points');

// 3. Ellipse
const ellSp = pm.createEllipse(150, 150, 60, 40);
assert(ellSp.points.length === 4 && ellSp.closed, 'Ellipse generated with 4 quarter-arc points');
assert(ellSp.points[0].y === 110 && ellSp.points[2].y === 190, 'Ellipse radii verified (150 - 40, 150 + 40)');

// 4. Polygon (Pentagon)
const polySp = pm.createPolygon(100, 100, 50, 5);
assert(polySp.points.length === 5 && polySp.closed, 'Polygon generated with exact 5 vertices');

// 5. Star (5-point star)
const starSp = pm.createStar(100, 100, 50, 25, 5);
assert(starSp.points.length === 10 && starSp.closed, 'Star generated with 10 alternating points');

// 6. Line
const lineSp = pm.createLine(10, 20, 200, 180);
assert(lineSp.points.length === 2 && !lineSp.closed, 'Line generated with 2 endpoints and open');

// ── Test 5: Path Operations (Canvas Build, Selection, Stroke, Fill) ──
console.log('\n[Suite 5: Path Operations & Selection]');
// Recreate rectangle
pm.createRectangle(20, 20, 100, 100, 0);

const testCtx = new MockContext2D();
pm.buildCanvasPath(testCtx);
assert(testCtx.ops.some(op => op[0] === 'beginPath'), 'buildCanvasPath called beginPath');
assert(testCtx.ops.some(op => op[0] === 'moveTo' && op[1] === 20 && op[2] === 20), 'buildCanvasPath moved to origin (20, 20)');
assert(testCtx.ops.some(op => op[0] === 'closePath'), 'buildCanvasPath closed path');

// Make Selection
const sel = pm.makeSelection(300, 300);
assert(sel !== null, 'makeSelection returned a selection object');
assert(sel.type === 'path', 'Selection type is "path"');
assert(sel.x === 20 && sel.y === 20 && sel.w === 101 && sel.h === 101, 'Selection bounding box matches vector path');
assert(sel.mask instanceof Uint8Array && sel.mask.length === 300 * 300, 'Selection binary mask buffer generated');

// Stroke Path
testCtx.ops = [];
pm.strokePath(testCtx, '#ff0000', 4);
const strokeOp = testCtx.ops.find(op => op[0] === 'stroke');
assert(strokeOp && strokeOp[1].strokeStyle === '#ff0000' && strokeOp[1].lineWidth === 4, 'strokePath set style and width');
assert(strokeOp !== undefined, 'strokePath executed canvas stroke()');

// Fill Path
testCtx.ops = [];
pm.fillPath(testCtx, '#00ff00');
const fillOp = testCtx.ops.find(op => op[0] === 'fill');
assert(fillOp && fillOp[1].fillStyle === '#00ff00', 'fillPath set fillStyle');
assert(fillOp !== undefined, 'fillPath executed canvas fill()');

// ── Test 6: Serialization (toJSON & fromJSON) ──
console.log('\n[Suite 6: Serialization toJSON & fromJSON]');
const json = pm.toJSON();
assert(Array.isArray(json.subpaths) && json.subpaths.length === 1, 'toJSON serialized subpaths array');
assert(json.subpaths[0].points.length === 4, 'Serialized 4 points of rectangle');

const pmRestored = new PathManager();
pmRestored.fromJSON(json);
assert(pmRestored.subpaths.length === 1, 'fromJSON restored 1 subpath');
assert(pmRestored.subpaths[0].points.length === 4, 'fromJSON restored 4 points');
assert(pmRestored.subpaths[0].points[0].x === 20, 'fromJSON restored point coordinates exactly');

console.log(`\n========================================`);
console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log(`========================================`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL MILESTONE 2 TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}
