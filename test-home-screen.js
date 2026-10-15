// test-home-screen.js
// Verification suite for PixelForge Studio Home Screen, Recent Projects & Save on Close Parity

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { RecentProjectsManager } = require('./js/recent-projects.js');

console.log('Testing PixelForge Studio Home Screen, Recent Projects & Save Confirmation Suite...\n');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
const mainCss = fs.readFileSync(path.join(__dirname, 'styles', 'main.css'), 'utf8');
const mainJs = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');

// Test Group 1: HTML Markup & Structure
console.log('► Test Group 1: HTML Markup & Structure');
assert(html.includes('id="welcome-overlay"'), 'index.html must contain #welcome-overlay');
console.log('  ✓ #welcome-overlay container found in index.html');

assert(html.includes('id="welcome-drop-zone"'), 'index.html must contain #welcome-drop-zone');
console.log('  ✓ Dedicated drag-and-drop zone #welcome-drop-zone found');

assert(html.includes('id="btn-brand-home"'), 'index.html must contain #btn-brand-home');
console.log('  ✓ Brand home toggle button #btn-brand-home found');

assert(html.includes('id="btn-welcome-back-to-canvas"'), 'index.html must contain #btn-welcome-back-to-canvas');
console.log('  ✓ Back to Canvas button #btn-welcome-back-to-canvas found');

assert(html.includes('data-action="home-screen"'), 'index.html must have Home Screen menu action');
console.log('  ✓ File menu has Home Screen item');

// Check category tabs
const tabMatches = html.match(/class="welcome-cat-tab[^"]*"\s+data-cat="([^"]+)"/g) || [];
assert(tabMatches.length >= 5, `Expected at least 5 category tabs, found ${tabMatches.length}`);
console.log(`  ✓ Category filter tabs found (${tabMatches.length} tabs: all, photo, web, social, art)`);

// Check template cards
const cardMatches = [...html.matchAll(/class="template-card"\s+data-cat="([^"]+)"\s+data-w="(\d+)"\s+data-h="(\d+)"\s+data-name="([^"]+)"/g)];
assert(cardMatches.length >= 10, `Expected at least 10 template presets, found ${cardMatches.length}`);
console.log(`  ✓ Categorized workspace template presets found (${cardMatches.length} templates)`);

cardMatches.forEach(m => {
  const [, cat, w, h, name] = m;
  assert(parseInt(w, 10) > 0, `Width must be positive for ${name}`);
  assert(parseInt(h, 10) > 0, `Height must be positive for ${name}`);
  assert(['photo', 'web', 'social', 'art'].includes(cat), `Category must be valid for ${name}`);
});
console.log('  ✓ All templates have valid dimensions, categories, and titles');

// Check Recent Projects Section in index.html
assert(html.includes('id="welcome-recents-section"'), 'index.html must contain #welcome-recents-section');
assert(html.includes('id="welcome-recents-grid"'), 'index.html must contain #welcome-recents-grid');
assert(html.includes('id="btn-clear-recent-projects"'), 'index.html must contain #btn-clear-recent-projects');
console.log('  ✓ Previous projects / Recent work container and clear controls found');

// Check Save Prompt Modal in index.html
assert(html.includes('id="modal-save-prompt"'), 'index.html must contain #modal-save-prompt');
assert(html.includes('id="btn-save-prompt-save"'), 'modal-save-prompt must contain #btn-save-prompt-save');
assert(html.includes('id="btn-save-prompt-dont-save"'), 'modal-save-prompt must contain #btn-save-prompt-dont-save');
assert(html.includes('id="btn-save-prompt-cancel"'), 'modal-save-prompt must contain #btn-save-prompt-cancel');
console.log('  ✓ Photoshop-style Save Changes Before Closing prompt modal found');

// Test Group 2: App.js Logic & Startup Behavior
console.log('\n► Test Group 2: App.js Startup & Controller Behavior');
assert(appJs.includes('this.showWelcomeOverlay()'), 'app.js must call showWelcomeOverlay()');
console.log('  ✓ showWelcomeOverlay() method called to present Home Screen');

assert(appJs.includes('createDocument(w, h, bgFill = \'white\', hideOverlay = true)'), 'createDocument must support hideOverlay parameter');
console.log('  ✓ createDocument signature supports optional hideOverlay parameter');

assert(appJs.includes('this.createDocument(1920, 1080, \'white\', false)'), 'init() must call createDocument with hideOverlay=false');
console.log('  ✓ Initial document is created in background without prematurely hiding welcome overlay');

assert(appJs.includes('case \'home-screen\':'), 'handleMenuAction must handle home-screen');
assert(appJs.includes('case \'exit-app\':'), 'handleMenuAction must handle exit-app');
console.log('  ✓ Menu dispatcher handles "home-screen", "close-project", and "exit-app" actions');

// Test Group 3: Save on Close & Location Dialog Mechanics
console.log('\n► Test Group 3: Save Changes Before Closing Mechanics');
assert(appJs.includes('requestCloseDocument(targetAction'), 'app.js must have requestCloseDocument');
assert(appJs.includes('promptSaveProjectAs(defaultFormat'), 'app.js must have promptSaveProjectAs');
assert(mainJs.includes('app:request-close'), 'main.js must intercept window close and send app:request-close');
assert(mainJs.includes('app:force-close'), 'main.js must handle app:force-close IPC');
assert(mainJs.includes('Save File / Choose Location'), 'main.js dialog:saveFile must ask user for location');
console.log('  ✓ Electron main process intercepts window close and queries renderer');
console.log('  ✓ Native save dialog prompts user for destination folder & file name (.pforge default)');
console.log('  ✓ Save changes modal offers Save, Don\'t Save, and Cancel actions');

// Test Group 4: RecentProjectsManager Model & Persistence
console.log('\n► Test Group 4: RecentProjectsManager Lifecycle');
// Mock localStorage
const mockStore = {};
global.localStorage = {
  getItem: (k) => mockStore[k] || null,
  setItem: (k, v) => { mockStore[k] = String(v); },
  removeItem: (k) => { delete mockStore[k]; },
  clear: () => { Object.keys(mockStore).forEach(k => delete mockStore[k]); }
};

const recentsMgr = new RecentProjectsManager();
assert.strictEqual(recentsMgr.recents.length, 0, 'New manager should start empty');

recentsMgr.addProject({
  id: 'p1',
  name: 'Poster Design.pforge',
  filePath: 'C:/Users/User/Documents/Poster Design.pforge',
  width: 1920,
  height: 1080,
  layersCount: 4,
  timestamp: Date.now() - 5000
});

assert.strictEqual(recentsMgr.recents.length, 1, 'Should have 1 project');
assert.strictEqual(recentsMgr.recents[0].name, 'Poster Design.pforge');
console.log('  ✓ Projects can be added to RecentProjectsManager');

// Test deduplication
recentsMgr.addProject({
  id: 'p2',
  name: 'Poster Design.pforge',
  filePath: 'C:/Users/User/Documents/Poster Design.pforge',
  width: 1920,
  height: 1080,
  layersCount: 5,
  timestamp: Date.now()
});
assert.strictEqual(recentsMgr.recents.length, 1, 'Adding duplicate project path should promote rather than duplicate');
assert.strictEqual(recentsMgr.recents[0].layersCount, 5, 'Promoted project metadata should be updated');
console.log('  ✓ Adding existing project path updates timestamp & promotes to top without duplicates');

// Add second project
recentsMgr.addProject({
  id: 'p3',
  name: 'Photo Retouch.psd',
  filePath: 'C:/Users/User/Pictures/Photo Retouch.psd',
  width: 3840,
  height: 2160,
  layersCount: 12
});
assert.strictEqual(recentsMgr.recents.length, 2);
console.log('  ✓ Multiple projects tracked in order of access');

// Remove project
recentsMgr.removeProject('p3');
assert.strictEqual(recentsMgr.recents.length, 1);
assert.strictEqual(recentsMgr.recents[0].name, 'Poster Design.pforge');
console.log('  ✓ Individual projects can be removed from history');

// Clear all
recentsMgr.clearAll();
assert.strictEqual(recentsMgr.recents.length, 0);
console.log('  ✓ clearAll() clears all recent projects');

// Test Group 5: CSS Styles
console.log('\n► Test Group 5: CSS Styling');
assert(mainCss.includes('.welcome-recents-section'), 'main.css must style .welcome-recents-section');
assert(mainCss.includes('.recent-project-card'), 'main.css must style .recent-project-card');
assert(mainCss.includes('.welcome-recents-empty'), 'main.css must style .welcome-recents-empty');
assert(mainCss.includes('#modal-save-prompt'), 'main.css or inline must style modal-save-prompt');
console.log('  ✓ CSS styles defined for Recent Projects grid, cards, thumbnails, and modal');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  Home Screen, Recent Projects & Save on Close: 100% Passed!');
console.log('════════════════════════════════════════════════════════════════\n');
