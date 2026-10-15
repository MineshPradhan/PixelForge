const assert = require('assert');
const HistoryManager = require('./js/history.js');

const hm = new HistoryManager(30);
const mockLayers = [{ id: 'l1', name: 'Layer 1', type: 'raster', visible: true, opacity: 100, blendMode: 'source-over' }];

// 1. Push 5 states
hm.push('Initial Canvas', mockLayers, 'l1');
hm.push('Brush Stroke 1', mockLayers, 'l1');
hm.push('Brush Stroke 2', mockLayers, 'l1');
hm.push('Brush Stroke 3', mockLayers, 'l1');
hm.push('Brush Stroke 4', mockLayers, 'l1');

assert.strictEqual(hm.steps.length, 5);
assert.strictEqual(hm.currentIndex, 4);

// 2. Delete middle state (index 2: "Brush Stroke 2")
const res = hm.deleteStep(2);
assert.strictEqual(res.removed.name, 'Brush Stroke 2');
assert.strictEqual(hm.steps.length, 4);
assert.strictEqual(hm.currentIndex, 3);

// 3. Delete currently active state (index 3: "Brush Stroke 4")
const resActive = hm.deleteStep(3);
assert.strictEqual(resActive.removed.name, 'Brush Stroke 4');
assert.strictEqual(hm.steps.length, 3);
assert.strictEqual(hm.currentIndex, 2);
assert.strictEqual(resActive.stateToRestore.name, 'Brush Stroke 3');

// 4. Delete subsequent states after index 0
const resSub = hm.deleteSubsequentSteps(0);
assert.strictEqual(hm.steps.length, 1);
assert.strictEqual(hm.currentIndex, 0);

// 5. Clear all with baseline
const baseline = hm.createSnapshot('Clean Base', mockLayers, 'l1');
hm.clearAll(baseline);
assert.strictEqual(hm.steps.length, 1);
assert.strictEqual(hm.steps[0].name, 'Clean Base');
assert.strictEqual(hm.currentIndex, 0);

console.log('✓ All HistoryManager deletion and clear unit tests passed successfully!');
