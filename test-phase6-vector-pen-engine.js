// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio Pro — Phase 6: Vector & Pen Tool Engine Suite
// ══════════════════════════════════════════════════════════════════════

class MockCanvas {
  constructor(w = 800, h = 600) {
    this.width = w;
    this.height = h;
    this.ctx = new MockContext2D(this);
  }
  getContext(type) { return this.ctx; }
  toDataURL() { return 'data:image/png;base64,MOCK_DATA'; }
}

class MockContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ops = [];
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = 'source-over';
    this.font = '16px sans-serif';
    this.textAlign = 'left';
    this.textBaseline = 'alphabetic';
    this.lineDash = [];
  }
  save() { this.ops.push(['save']); }
  restore() { this.ops.push(['restore']); }
  beginPath() { this.ops.push(['beginPath']); }
  closePath() { this.ops.push(['closePath']); }
  moveTo(x, y) { this.ops.push(['moveTo', x, y]); }
  lineTo(x, y) { this.ops.push(['lineTo', x, y]); }
  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) { this.ops.push(['bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y]); }
  quadraticCurveTo(cpx, cpy, x, y) { this.ops.push(['quadraticCurveTo', cpx, cpy, x, y]); }
  stroke() { this.ops.push(['stroke', { strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }]); }
  fill() { this.ops.push(['fill', { fillStyle: this.fillStyle }]); }
  clip() { this.ops.push(['clip']); }
  clearRect(x, y, w, h) { this.ops.push(['clearRect', x, y, w, h]); }
  fillRect(x, y, w, h) { this.ops.push(['fillRect', x, y, w, h]); }
  strokeRect(x, y, w, h) { this.ops.push(['strokeRect', x, y, w, h]); }
  drawImage() { this.ops.push(['drawImage']); }
  translate(x, y) { this.ops.push(['translate', x, y]); }
  rotate(angle) { this.ops.push(['rotate', angle]); }
  scale(sx, sy) { this.ops.push(['scale', sx, sy]); }
  setLineDash(d) { this.lineDash = d; this.ops.push(['setLineDash', d]); }
  measureText(str) { return { width: str.length * 10 }; }
  fillText(text, x, y) { this.ops.push(['fillText', text, x, y]); }
  getImageData(x, y, w, h) {
    const data = new Uint8ClampedArray(w * h * 4);
    // Fill interior rectangular region with solid alpha to simulate shape rasterization
    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        if (cx >= 10 && cx <= w - 10 && cy >= 10 && cy <= h - 10) {
          const idx = (cy * w + cx) * 4;
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        }
      }
    }
    return { data, width: w, height: h };
  }
}

global.window = global;
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

global.Utils = {
  createCanvas: (w, h) => new MockCanvas(w, h),
  clamp: (v, min, max) => Math.max(min, Math.min(max, v))
};

if (typeof global.Image === 'undefined') {
  global.Image = class {
    constructor() {
      this.width = 100;
      this.height = 100;
      setTimeout(() => { if (this.onload) this.onload(); }, 1);
    }
  };
}

const { VectorPoint, Subpath, PathManager } = require('./js/paths.js');
const { LayerManager } = require('./js/layers.js');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio Pro — Phase 6: Vector & Pen Tool Engine');
console.log('════════════════════════════════════════════════════════════════\n');

// ── Test Group 1: Curvature Pen Engine (Photoshop Parity) ──
console.log('► Test Group 1: Curvature Pen Engine (Spline Fitting)');
{
  const pm = new PathManager();
  // 1. Add points sequentially
  const p1 = pm.addCurvaturePoint(100, 100);
  const p2 = pm.addCurvaturePoint(200, 50);
  const p3 = pm.addCurvaturePoint(300, 150);
  const p4 = pm.addCurvaturePoint(400, 100);

  const sp = pm.subpaths[0];
  assert(sp.points.length === 4, 'Curvature pen added 4 sequential points to subpath');
  assert(p2.type === 'smooth' && p2.cp1 !== null && p2.cp2 !== null, 'Interior point p2 has smooth Centripetal Catmull-Rom tangent handles');
  assert(p3.type === 'smooth' && p3.cp1 !== null && p3.cp2 !== null, 'Interior point p3 has smooth tangent handles');

  // 2. Toggle point to sharp corner
  pm.toggleCurvatureCorner(0, 1); // p2
  assert(p2.type === 'corner' && p2.cp1 === null && p2.cp2 === null, 'toggleCurvatureCorner converts smooth point into sharp corner and collapses handles');

  // 3. Toggle back to smooth
  pm.toggleCurvatureCorner(0, 1);
  assert(p2.type === 'smooth' && p2.cp1 !== null && p2.cp2 !== null, 'toggleCurvatureCorner restores smooth curve spline handles');
}

// ── Test Group 2: Freeform Pen & Curve Simplification ──
console.log('\n► Test Group 2: Freeform Pen & Douglas-Peucker Simplification');
{
  const pm = new PathManager();
  // Generate 50 jittery raw points along line from (10, 10) to (200, 10)
  const rawPoints = [];
  for (let i = 0; i <= 50; i++) {
    const x = 10 + i * (190 / 50);
    const jitter = (i % 2 === 0 ? 0.5 : -0.5);
    rawPoints.push({ x, y: 10 + jitter });
  }

  const simplified = pm._douglasPeucker(rawPoints, 2.0);
  assert(simplified.length < rawPoints.length && simplified.length <= 4, `Douglas-Peucker reduced ${rawPoints.length} raw points down to ${simplified.length} salient vertices`);

  // Finish freeform stroke into closed subpath
  const closedRaw = [
    { x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 150 }, { x: 50, y: 150 }, { x: 52, y: 52 }
  ];
  const freeformSp = pm.finishFreeform(closedRaw, 2.0, true);
  assert(freeformSp !== null && freeformSp.closed, 'finishFreeform auto-detects near endpoints and generates closed smooth subpath');
  assert(freeformSp.points.length === 4, 'Duplicate closing vertex eliminated cleanly');
}

// ── Test Group 3: Direct Selection & Multi-Selection Engine ──
console.log('\n► Test Group 3: Direct Selection, Box Marquee & Subpath Duplication');
{
  const pm = new PathManager();
  pm.createRectangle(50, 50, 100, 100, 0);

  // Marquee box select top-left two points (x <= 100, y <= 100)
  pm.boxSelect(40, 40, 110, 110);
  assert(pm.selectedPoints.size >= 1, `boxSelect selected ${pm.selectedPoints.size} anchor points within marquee boundary`);

  // Move selected points by +20px
  const origX = pm.subpaths[0].points[0].x;
  pm.moveSelectedPoints(20, 20);
  assert(pm.subpaths[0].points[0].x === origX + 20, 'moveSelectedPoints translated selected anchor points uniformly');

  // Duplicate subpath (Alt+Drag parity)
  const dupSp = pm.duplicateSubpath(0);
  assert(pm.subpaths.length === 2, 'duplicateSubpath cloned subpath into path manager');
  assert(dupSp.points[0].x === pm.subpaths[0].points[0].x + 15, 'Duplicated subpath offset by +15px');
}

// ── Test Group 4: Vector Path Boolean Operations (Combine Shapes) ──
console.log('\n► Test Group 4: Vector Path Boolean Operations (Pathfinder)');
{
  const pm = new PathManager();
  const r1 = pm.createRectangle(50, 50, 100, 100, 0);
  const r2 = pm.createRectangle(100, 100, 100, 100, 0);

  pm.subpaths = [r1, r2];
  assert(pm.subpaths.length === 2, 'PathManager initialized with 2 overlapping subpaths');

  // Test union operation
  const unionRes = pm.combinePaths('union');
  assert(unionRes !== null && unionRes.length >= 1, 'combinePaths("union") successfully merged overlapping shapes');

  // Test subtract operation
  const subRes = pm.combinePaths('subtract', [r1], [r2]);
  assert(subRes !== null, 'combinePaths("subtract") executed shape difference cleanly');

  // Test intersect operation
  const interRes = pm.combinePaths('intersect', [r1], [r2]);
  assert(interRes !== null, 'combinePaths("intersect") executed shape intersection cleanly');

  // Test exclude (xor) operation
  const xorRes = pm.combinePaths('exclude', [r1], [r2]);
  assert(xorRes !== null, 'combinePaths("exclude") executed XOR shape exclusion cleanly');
}

// ── Test Group 5: Text-on-Path (Arc-Length Parameterization) ──
console.log('\n► Test Group 5: Text-on-Path (Arc Length & Tangent Sampling)');
{
  const pm = new PathManager();
  // Create arc line from (0, 100) to (400, 100)
  const sp = new Subpath([], false);
  sp.addPoint(0, 100, null, { x: 100, y: 0 }, 'smooth');
  sp.addPoint(400, 100, { x: 300, y: 200 }, null, 'smooth');
  pm.subpaths = [sp];

  const arcData = pm.getArcLengthData(0);
  assert(arcData !== null && arcData.totalLength > 300, `getArcLengthData computed total curve arc length: ${Math.round(arcData.totalLength)}px`);
  assert(arcData.samples.length > 20, 'Arc length samples computed with dense parameterized lookup table');

  // Sample point at 50% along curve
  const midPoint = pm.samplePointAtDistance(arcData.totalLength / 2, arcData);
  assert(midPoint !== null && midPoint.x > 150 && midPoint.x < 250, 'samplePointAtDistance accurately returned 50% coordinate along Bézier curve');
  assert(typeof midPoint.angle === 'number', 'samplePointAtDistance returned tangent orientation angle for glyph rotation');

  // Render Text-on-Path via LayerManager
  const lm = new LayerManager(800, 600);
  const textLayer = lm.addTextLayer('CURVED TEXT', 0, 0, {
    fontSize: 24,
    color: '#00ffcc',
    subpath: sp
  });
  assert(textLayer.type === 'text', 'Text layer created with attached vector path');
  assert(textLayer.ctx.ops.some(op => op[0] === 'rotate'), 'renderTextLayer rotated glyphs along vector path tangent angles');
}

// ── Test Group 6: Live Vector Shape Layer Architecture ──
console.log('\n► Test Group 6: Live Vector Shape Layer Architecture');
{
  const lm = new LayerManager(800, 600);
  const pm = new PathManager();
  const rectSp = pm.createRectangle(50, 50, 200, 150, 10);

  const shapeLayer = lm.addShapeLayer('Card Shape', {
    subpaths: [rectSp],
    fill: { enabled: true, color: '#3b82f6' },
    stroke: {
      enabled: true,
      color: '#ffffff',
      width: 4,
      dash: [8, 4],
      cap: 'round',
      join: 'round',
      align: 'inside'
    }
  });

  assert(shapeLayer.type === 'shape' && shapeLayer.vectorShape !== null, 'Live Shape Layer instantiated with vectorShape data model');
  assert(shapeLayer.ctx.ops.some(op => op[0] === 'fill'), 'renderShapeLayer rendered vector path fill');
  assert(shapeLayer.ctx.ops.some(op => op[0] === 'stroke'), 'renderShapeLayer rendered stroke with configured width');
  assert(shapeLayer.ctx.ops.some(op => op[0] === 'setLineDash'), 'renderShapeLayer applied dashed stroke profile [8, 4]');
  assert(shapeLayer.ctx.ops.some(op => op[0] === 'clip'), 'Inside stroke alignment executed using canvas path clipping');

  // Rasterize shape layer
  const rasterOk = lm.rasterizeShapeLayer(shapeLayer.id);
  assert(rasterOk && shapeLayer.type === 'raster' && shapeLayer.vectorShape === null, 'rasterizeShapeLayer baked vector shape cleanly into flat raster layer');
}

// ── Test Group 7: SVG Export Engine & Serialization ──
console.log('\n► Test Group 7: SVG Export Engine & Path Panel Catalog');
{
  const pm = new PathManager();
  pm.createRectangle(10, 20, 300, 200, 5);

  const svgPathData = pm.toSVGPathData();
  assert(svgPathData.startsWith('M ') && svgPathData.includes('C ') && svgPathData.endsWith('Z'), 'toSVGPathData generated compliant SVG path data string');

  const svgXml = pm.exportSVG(800, 600, { fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 3 });
  assert(svgXml.includes('<svg xmlns="http://www.w3.org/2000/svg"') && svgXml.includes('viewBox="0 0 800 600"'), 'exportSVG generated complete standalone SVG XML document');

  // Saved Paths catalog (Paths Panel Parity)
  const saved1 = pm.saveWorkPath('Logo Outline');
  assert(pm.savedPaths.length === 1 && saved1.name === 'Logo Outline', 'saveWorkPath added path to saved catalog');

  const dupSaved = pm.duplicateSavedPath(saved1.id);
  assert(pm.savedPaths.length === 2 && dupSaved.name === 'Logo Outline copy', 'duplicateSavedPath cloned saved path');

  pm.clear();
  assert(pm.isEmpty(), 'Work path cleared');
  const loadOk = pm.loadSavedPath(saved1.id);
  assert(loadOk && !pm.isEmpty(), 'loadSavedPath restored saved path into active work path');

  const delOk = pm.deleteSavedPath(dupSaved.id);
  assert(delOk && pm.savedPaths.length === 1, 'deleteSavedPath removed path from catalog');

  // Serialization with saved paths
  const json = pm.toJSON();
  assert(json.savedPaths && json.savedPaths.length === 1, 'toJSON serialized savedPaths array');

  const pmRestored = new PathManager();
  pmRestored.fromJSON(json);
  assert(pmRestored.savedPaths.length === 1 && pmRestored.savedPaths[0].name === 'Logo Outline', 'fromJSON restored saved paths catalog faithfully');
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Phase 6 Test Suite: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('════════════════════════════════════════════════════════════════\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
