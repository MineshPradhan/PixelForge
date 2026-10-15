// test-toolbar-customizer.js
// Verification suite for Toolbar Customizer, Categories, Drag-to-Add/Remove, and Presets Parity

const assert = require('assert');
const { ToolbarCustomizerManager, ALL_TOOLBAR_TOOLS, TOOL_CATEGORIES } = require('./js/toolbar-customizer.js');

console.log('Testing Toolbar Customizer & Tool Drawer Parity Suite...\n');

// Mock localStorage
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Test Group 1: Master Tool Registry & Categories
console.log('► Test Group 1: Master Tool Registry & Categories');
assert(ALL_TOOLBAR_TOOLS.length >= 31, `Expected at least 31 tools, got ${ALL_TOOLBAR_TOOLS.length}`);
assert(TOOL_CATEGORIES.length === 6, `Expected 6 categories, got ${TOOL_CATEGORIES.length}`);

const categoryIds = TOOL_CATEGORIES.map(c => c.id);
ALL_TOOLBAR_TOOLS.forEach(tool => {
  assert(tool.id, 'Tool must have an id');
  assert(tool.name, `Tool ${tool.id} must have a name`);
  assert(tool.shortcut, `Tool ${tool.id} must have a shortcut`);
  assert(tool.iconSvg, `Tool ${tool.id} must have an iconSvg`);
  assert(categoryIds.includes(tool.category), `Tool ${tool.id} category ${tool.category} must be in TOOL_CATEGORIES`);
});
console.log('  ✓ All 31 tools are properly registered with icons, categories, and shortcuts');

// Test Group 2: Initialization & Defaults
console.log('\n► Test Group 2: Initialization & Defaults');
global.localStorage.clear();
const manager = new ToolbarCustomizerManager();
assert.strictEqual(manager.activeTools.length, ALL_TOOLBAR_TOOLS.length, 'Default active tools count must match all tools');
assert.strictEqual(manager.extraTools.length, 0, 'Default extra tools count must be zero');
assert(manager.activeTools.includes('move'), 'Move tool must be active by default');
assert(manager.activeTools.includes('brush'), 'Brush tool must be active by default');
assert(manager.activeTools.includes('pen'), 'Pen tool must be active by default');
console.log('  ✓ Initial state loads full Photoshop default tool set');

// Test Group 3: Move to Extra (Remove from Toolbar) & Move to Active (Add back)
console.log('\n► Test Group 3: Move to Extra & Add back to Active Toolbar');
const initialActiveCount = manager.activeTools.length;
const removed = manager.moveToExtra('spot-healing');
assert(removed, 'moveToExtra should return true on success');
assert(!manager.activeTools.includes('spot-healing'), 'spot-healing should not be in active tools');
assert(manager.extraTools.includes('spot-healing'), 'spot-healing should now be in extra tools');
assert.strictEqual(manager.activeTools.length, initialActiveCount - 1);
assert.strictEqual(manager.extraTools.length, 1);

// Add it back
const added = manager.moveToActive('spot-healing');
assert(added, 'moveToActive should return true on success');
assert(manager.activeTools.includes('spot-healing'), 'spot-healing should be back in active tools');
assert(!manager.extraTools.includes('spot-healing'), 'spot-healing should be removed from extra tools');
assert.strictEqual(manager.activeTools.length, initialActiveCount);
assert.strictEqual(manager.extraTools.length, 0);
console.log('  ✓ Tools can be dynamically removed from toolbar into Extra drawer and brought back');

// Test Group 4: Reordering within Active Toolbar
console.log('\n► Test Group 4: Tool Reordering & Placement');
manager.moveToActive('spot-healing', 'move'); // insert before 'move'
assert.strictEqual(manager.activeTools[0], 'spot-healing', 'spot-healing should now be inserted at the top');

manager.reorderActive('brush', 'move');
const brushIdx = manager.activeTools.indexOf('brush');
const moveIdx = manager.activeTools.indexOf('move');
assert.strictEqual(brushIdx, moveIdx - 1, 'brush should be placed immediately before move');
console.log('  ✓ Active tools can be reordered and placed before specific tools');

// Test Group 5: Workspace Presets
console.log('\n► Test Group 5: Presets & Filtering Parity');
manager.applyPreset('painting');
assert(manager.activeTools.includes('brush'), 'Painting preset must include brush');
assert(manager.activeTools.includes('pencil'), 'Painting preset must include pencil');
assert(manager.activeTools.includes('mixer-brush'), 'Painting preset must include mixer-brush');
assert(!manager.activeTools.includes('pen'), 'Painting preset should not include pen in active bar');
assert(manager.extraTools.includes('pen'), 'Pen should be in extra tools during painting preset');

manager.applyPreset('minimal');
assert.strictEqual(manager.activeTools.length, 9, 'Minimal preset has exactly 9 essential tools');
assert(manager.activeTools.includes('move'));
assert(manager.activeTools.includes('zoom'));

manager.restoreDefaults();
assert.strictEqual(manager.activeTools.length, ALL_TOOLBAR_TOOLS.length, 'Restore defaults restores all tools');
assert.strictEqual(manager.extraTools.length, 0, 'Restore defaults empties extra tools');
console.log('  ✓ Presets (Painting, Minimal, Restore Defaults) configure toolbar accurately');

// Test Group 6: Persistence Round-Trip
console.log('\n► Test Group 6: LocalStorage Persistence');
manager.moveToExtra('crop');
manager.moveToExtra('lasso-magnetic');
const savedRaw = global.localStorage.getItem(manager.storageKey);
assert(savedRaw, 'Storage key must have been updated');
const parsed = JSON.parse(savedRaw);
assert(parsed.extraTools.includes('crop'), 'Saved payload must include crop in extraTools');
assert(parsed.extraTools.includes('lasso-magnetic'), 'Saved payload must include lasso-magnetic in extraTools');

// Create new instance to test loading from storage
const newManager = new ToolbarCustomizerManager();
assert(!newManager.activeTools.includes('crop'), 'New instance should load persisted state with crop removed');
assert(newManager.extraTools.includes('crop'), 'New instance should have crop in extraTools');
assert(newManager.extraTools.includes('lasso-magnetic'), 'New instance should have lasso-magnetic in extraTools');
console.log('  ✓ Custom toolbar configuration persists seamlessly across sessions in localStorage');

// Test Group 7: DOM Synchronization & Fallback
console.log('\n► Test Group 7: DOM Synchronization & Active Tool Fallback');
const fakeButtons = [];
const fakeElements = {};

ALL_TOOLBAR_TOOLS.forEach(t => {
  const btn = {
    dataset: { tool: t.id },
    classList: {
      contains: (c) => c === 'tool-btn',
      toggle: () => {}
    },
    style: { display: 'flex' }
  };
  fakeButtons.push(btn);
  fakeElements[t.id] = btn;
});

const fakeToolbar = {
  querySelectorAll: (selector) => {
    if (selector.includes('.tool-btn')) return fakeButtons;
    if (selector.includes('.toolbar-sep')) return [];
    return [];
  }
};

const fakeDotsBtn = {
  classList: { toggle: () => {} },
  setAttribute: () => {}
};

global.document = {
  getElementById: (id) => {
    if (id === 'toolbar') return fakeToolbar;
    if (id === 'btn-edit-toolbar-dots') return fakeDotsBtn;
    return null;
  }
};

let currentSelectedTool = 'crop';
const mockApp = {
  toolManager: {
    get currentTool() { return currentSelectedTool; },
    setTool: (t) => { currentSelectedTool = t; }
  }
};

newManager.app = mockApp;
newManager.syncToolbarDOM();

assert.strictEqual(fakeElements['crop'].style.display, 'none', 'Removed tool must have display: none');
assert.strictEqual(fakeElements['move'].style.display, 'flex', 'Active tool must have display: flex');
assert.notStrictEqual(currentSelectedTool, 'crop', 'Active tool must fallback if current tool was removed');
assert(newManager.activeTools.includes(currentSelectedTool), 'Fallback tool must be one of the active tools');
console.log('  ✓ DOM toolbar elements are synchronized and active tool cleanly falls back');

// ── Test Group 8: Left Tool Drawer Panel (Toggle & Categories) ──
console.log('\n► Test Group 8: Left Docked Tool Drawer Panel');
const fakeDrawerPanel = {
  classList: {
    _classes: new Set(['hidden']),
    contains: (c) => fakeDrawerPanel.classList._classes.has(c),
    add: (c) => fakeDrawerPanel.classList._classes.add(c),
    remove: (c) => fakeDrawerPanel.classList._classes.delete(c)
  }
};
const fakeKnob = {
  classList: {
    _classes: new Set(),
    add: (c) => fakeKnob.classList._classes.add(c),
    remove: (c) => fakeKnob.classList._classes.delete(c)
  }
};
const fakeHandle = {
  classList: {
    _classes: new Set(),
    add: (c) => fakeHandle.classList._classes.add(c),
    remove: (c) => fakeHandle.classList._classes.delete(c)
  }
};

const origGetElementById = global.document.getElementById;
global.document.getElementById = (id) => {
  if (id === 'left-tool-drawer-panel') return fakeDrawerPanel;
  if (id === 'btn-left-dock-toggle') return fakeKnob;
  if (id === 'left-dock-handle') return fakeHandle;
  return origGetElementById(id);
};

newManager.toggleDrawer();
assert.strictEqual(fakeDrawerPanel.classList.contains('hidden'), false, 'Drawer must not have hidden class when toggled open');
assert.strictEqual(newManager.isDrawerOpen, true, 'isDrawerOpen must be true');

newManager.toggleDrawer();
assert.strictEqual(fakeDrawerPanel.classList.contains('hidden'), true, 'Drawer must have hidden class when toggled closed');
assert.strictEqual(newManager.isDrawerOpen, false, 'isDrawerOpen must be false');
console.log('  ✓ Left tool drawer smoothly toggles open and closed with handle state updates');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  Toolbar Customizer Parity Suite: All 8 Test Groups Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');

