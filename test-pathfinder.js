const assert = require('assert');
const VectorPathfinder = require('./js/pathfinder.js');

console.log('🧪 Starting Vector Boolean Pathfinder Engine Test Suite...');

// ══════════════════════════════════════════════════════════════════════════
// 1. Geometric Primitives & Point-in-Polygon Tests
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing Geometric Primitives ---');

const boxA = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 }
];

const areaA = Math.abs(VectorPathfinder.signedArea(boxA));
assert.strictEqual(areaA, 10000, 'Box 100x100 area should be 10000');

assert.strictEqual(VectorPathfinder.pointInPolygon({ x: 50, y: 50 }, boxA), true, 'Center point should be inside box');
assert.strictEqual(VectorPathfinder.pointInPolygon({ x: 150, y: 50 }, boxA), false, 'Outside point should not be inside box');

// Segment intersection test
const isect = VectorPathfinder.segmentIntersection(
  { x: 0, y: 50 }, { x: 100, y: 50 },
  { x: 50, y: 0 }, { x: 50, y: 100 }
);
assert(isect !== null, 'Perpendicular segments must intersect');
assert.strictEqual(isect.pt.x, 50);
assert.strictEqual(isect.pt.y, 50);

console.log('✅ Geometric primitives passed!');

// ══════════════════════════════════════════════════════════════════════════
// 2. Rect-Rect Boolean Operations (Union, Subtract, Intersect, Exclude)
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing Polygon Boolean Operations ---');

// Box B shifted right by 50px: [50, 0] to [150, 100]
const boxB = [
  { x: 50, y: 0 },
  { x: 150, y: 0 },
  { x: 150, y: 100 },
  { x: 50, y: 100 }
];

// 2.1 UNION
const unionResult = VectorPathfinder.polygonBoolean(boxA, boxB, 'union');
assert(unionResult.length >= 1, 'Union should yield resulting polygon');
const unionArea = Math.abs(VectorPathfinder.signedArea(unionResult[0]));
// Total area = 10000 + 10000 - 5000 (overlap) = 15000
assert.strictEqual(unionArea, 15000, `Union area expected 15000, got ${unionArea}`);
console.log('  ✓ Union operation verified (Area: 15,000 px²)');

// 2.2 SUBTRACT (Difference: boxA minus boxB)
const subResult = VectorPathfinder.polygonBoolean(boxA, boxB, 'subtract');
assert(subResult.length >= 1, 'Subtract should yield remaining polygon');
const subArea = Math.abs(VectorPathfinder.signedArea(subResult[0]));
// Remaining box is 50x100 -> area 5000
assert.strictEqual(subArea, 5000, `Subtract area expected 5000, got ${subArea}`);
console.log('  ✓ Subtract operation verified (Area: 5,000 px²)');

// 2.3 INTERSECT (Overlap between boxA and boxB)
const isectResult = VectorPathfinder.polygonBoolean(boxA, boxB, 'intersect');
assert(isectResult.length >= 1, 'Intersect should yield overlapping polygon');
const isectArea = Math.abs(VectorPathfinder.signedArea(isectResult[0]));
// Overlapping box is 50x100 -> area 5000
assert.strictEqual(isectArea, 5000, `Intersect area expected 5000, got ${isectArea}`);
console.log('  ✓ Intersect operation verified (Area: 5,000 px²)');

// 2.4 DISJOINT & NESTED CASES
const disjointBox = [
  { x: 300, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 100 },
  { x: 300, y: 100 }
];
const disjointUnion = VectorPathfinder.polygonBoolean(boxA, disjointBox, 'union');
assert.strictEqual(disjointUnion.length, 2, 'Disjoint union should return both polygons');

const disjointIntersect = VectorPathfinder.polygonBoolean(boxA, disjointBox, 'intersect');
assert.strictEqual(disjointIntersect.length, 0, 'Disjoint intersect should be empty');

console.log('✅ Polygon Boolean operations (Union, Subtract, Intersect, Disjoint) passed!');

// ══════════════════════════════════════════════════════════════════════════
// 3. Bézier Curve Flattening & Subpath Integration
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing Bézier & Subpath Linearization ---');

const p0 = { x: 0, y: 0 };
const c0 = { x: 25, y: 50 };
const c1 = { x: 75, y: 50 };
const p1 = { x: 100, y: 0 };

const flattened = VectorPathfinder.flattenCubicBezier(p0, c0, c1, p1, 10);
assert.strictEqual(flattened.length, 11, '10 steps should produce 11 points');
assert.strictEqual(flattened[0].x, 0);
assert.strictEqual(flattened[10].x, 100);
// Midpoint t=0.5 should have positive y due to control handles
assert(flattened[5].y > 20, 'Cubic curve midpoint should arc upward');

// Mock Subpath object
const mockSubpathA = {
  closed: true,
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ]
};

const mockSubpathB = {
  closed: true,
  points: [
    { x: 50, y: 0 },
    { x: 150, y: 0 },
    { x: 150, y: 100 },
    { x: 50, y: 100 }
  ]
};

const combinedSubpaths = VectorPathfinder.combineSubpaths(mockSubpathA, mockSubpathB, 'union');
assert(combinedSubpaths.length >= 1, 'combineSubpaths should return subpaths array');
assert(combinedSubpaths[0].points.length >= 4, 'Combined subpath should contain points');

console.log('✅ Bézier flattening and subpath conversion passed!');

// ══════════════════════════════════════════════════════════════════════════
// 4. Shape Layer CSG Combination
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing Shape Layer Combination ---');

const layer1 = {
  type: 'shape-rect',
  x: 10, y: 10, width: 80, height: 80,
  properties: { fill: true, fillColor: '#ff0000', stroke: true, strokeColor: '#000000', strokeWidth: 2 }
};

const layer2 = {
  type: 'shape-rect',
  x: 50, y: 10, width: 80, height: 80,
  properties: { fill: true, fillColor: '#00ff00', stroke: true, strokeColor: '#000000', strokeWidth: 2 }
};

const mergedShape = VectorPathfinder.combineShapeLayers(layer1, layer2, 'union');
assert(mergedShape !== null, 'Shape layer union should create merged shape');
assert.strictEqual(mergedShape.type, 'shape-path');
assert.strictEqual(mergedShape.x, 10);
assert.strictEqual(mergedShape.width, 120); // 10 to 130 = 120 width

console.log('✅ Shape Layer CSG combination passed!');
console.log('🎉 ALL VECTOR PATHFINDER TESTS PASSED (100%)!');
