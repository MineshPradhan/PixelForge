const assert = require('assert');
const { LensProfileDatabase } = require('./js/lens-profile-db.js');
const { VectorStrokeProfiler } = require('./js/vector-stroke-profiler.js');
const { SpotColorChannel, SpotColorManager } = require('./js/spot-color-channels.js');

console.log('🧪 Starting Frontiers Gap-Closing Test Suite...');

// ══════════════════════════════════════════════════════════════════
// 1. Lens Profile Database & EXIF Matching Tests
// ══════════════════════════════════════════════════════════════════
console.log('--- Testing Lens Profile Database ---');

const canonMatch = LensProfileDatabase.findProfile('Canon', 'Canon EF 24-70mm f/2.8L II USM');
assert(canonMatch !== null, 'Should match Canon 24-70mm lens profile');
assert.strictEqual(canonMatch.distortion, -24);
assert.strictEqual(canonMatch.redCyanDefringe, 8);

const sonyMatch = LensProfileDatabase.findProfile('Sony', 'Sony FE 16-35mm f/2.8 GM');
assert(sonyMatch !== null, 'Should match Sony 16-35mm GM lens profile');
assert.strictEqual(sonyMatch.distortion, -35);
assert.strictEqual(sonyMatch.vignetteAmount, 40);

const profileList = LensProfileDatabase.getProfileList();
assert(profileList.length >= 10, 'Should have at least 10 built-in lens profiles');
console.log(`  ✓ Successfully indexed ${profileList.length} camera & lens calibration profiles`);
console.log('✅ Lens Profile Database tests passed!');

// ══════════════════════════════════════════════════════════════════
// 2. Vector Variable-Width Stroke Profiler Tests
// ══════════════════════════════════════════════════════════════════
console.log('--- Testing Vector Variable-Width Stroke Profiler ---');

const linePoints = [
  { x: 0, y: 50 },
  { x: 50, y: 50 },
  { x: 100, y: 50 }
];

// Test Taper Both Ends profile
const taperRibbon = VectorStrokeProfiler.generateVariableStrokePolygon(linePoints, 20, 'taper_both', false);
assert(taperRibbon.length >= 6, 'Variable ribbon outline should form a closed polygon');

// In taper_both, ends (t=0, t=1) have narrow width, center (t=0.5) has max width
// Left ribbon: y = 50 + halfW; Right ribbon: y = 50 - halfW
const centerPointLeft = taperRibbon[1];
assert.strictEqual(centerPointLeft.x, 50);
assert(Math.abs(centerPointLeft.y - 60) <= 0.5, 'Center left point should expand to full half-width (+10)');

// Test Calligraphy profile
const calligRibbon = VectorStrokeProfiler.generateVariableStrokePolygon(linePoints, 20, 'calligraphy', false);
assert(calligRibbon.length >= 6, 'Calligraphy ribbon should generate polygon');

console.log('✅ Vector Variable-Width Stroke Profiler tests passed!');

// ══════════════════════════════════════════════════════════════════
// 3. Spot Color Prepress Channels Tests
// ══════════════════════════════════════════════════════════════════
console.log('--- Testing Spot Color Channels & Prepress Inks ---');

const spotMgr = new SpotColorManager({ width: 200, height: 200 });
const spotChan = spotMgr.createSpotChannel('PANTONE 185 C', '#e11d48', 0.9);

assert.strictEqual(spotChan.name, 'PANTONE 185 C');
assert.strictEqual(spotChan.tintColorHex, '#e11d48');
assert.strictEqual(spotChan.opacity, 0.9);
assert.strictEqual(spotChan.data.length, 200 * 200);

// Test fill density
spotChan.fill(128); // 50% tint
assert.strictEqual(spotChan.data[0], 128);
assert.strictEqual(spotChan.data[39999], 128);

// Test clone
const clonedChan = spotChan.clone();
assert.strictEqual(clonedChan.name, 'PANTONE 185 C Copy');
assert.strictEqual(clonedChan.data[0], 128);

console.log('✅ Spot Color Channels & Prepress Inks tests passed!');
console.log('🎉 ALL FRONTIER GAP-CLOSING TESTS PASSED (100%)!');
