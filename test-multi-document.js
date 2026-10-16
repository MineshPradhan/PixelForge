const assert = require('assert');
const { DocumentSession, MultiDocumentManager } = require('./js/multi-document.js');

console.log('🧪 Starting Multi-Document Tabbed Interface Test Suite...');

// Mock App environment
function createMockApp() {
  return {
    width: 1200,
    height: 800,
    zoom: 1.0,
    panX: 0,
    panY: 0,
    history: [{ state: 'Initial' }],
    historyIndex: 0,
    guides: { horizontal: [100], vertical: [200] },
    layerManager: {
      layers: [
        { id: 'layer_1', name: 'Layer 1', visible: true, opacity: 1 }
      ],
      activeLayerIndex: 0,
      renderLayersList: () => {}
    },
    mainCanvas: { width: 1200, height: 800 },
    bgGridCanvas: { width: 1200, height: 800 },
    overlayCanvas: { width: 1200, height: 800 },
    renderComposite: () => {},
    updateZoomDisplay: () => {},
    updateHistoryPanel: () => {}
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 1. Session Instantiation & Initial Capture
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing DocumentSession & Capture ---');

const mockApp = createMockApp();
const docMgr = new MultiDocumentManager(mockApp);
docMgr.init();

assert.strictEqual(docMgr.documents.size, 1, 'Should initialize with 1 captured document');
const initialDoc = docMgr.getActiveDocument();
assert(initialDoc !== null, 'Initial active document must exist');
assert.strictEqual(initialDoc.title, 'Untitled-1');
assert.strictEqual(initialDoc.width, 1200);
assert.strictEqual(initialDoc.height, 800);
assert.strictEqual(initialDoc.layers.length, 1);

console.log('✅ Initial document capture passed!');

// ══════════════════════════════════════════════════════════════════════════
// 2. Creating New Documents & Switching
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing Create & Switch Documents ---');

// Create second document: 1920x1080 "Project_Banner"
const doc2 = docMgr.createNewDocument(1920, 1080, 'Project_Banner');
assert.strictEqual(docMgr.documents.size, 2, 'Should now have 2 documents open');
assert.strictEqual(docMgr.activeDocId, doc2.id, 'New document should become active');
assert.strictEqual(mockApp.width, 1920, 'App width should sync to new document');
assert.strictEqual(mockApp.height, 1080, 'App height should sync to new document');

// Create third document: 800x600 "Icon_512"
const doc3 = docMgr.createNewDocument(800, 600, 'Icon_512');
assert.strictEqual(docMgr.documents.size, 3, 'Should now have 3 documents open');
assert.strictEqual(docMgr.activeDocId, doc3.id);
assert.strictEqual(mockApp.width, 800);

// Switch back to Doc 1 (1200x800)
const switched = docMgr.switchDocument(initialDoc.id);
assert.strictEqual(switched, true);
assert.strictEqual(docMgr.activeDocId, initialDoc.id);
assert.strictEqual(mockApp.width, 1200);
assert.strictEqual(mockApp.height, 800);

console.log('✅ Document creation and O(1) switching passed!');

// ══════════════════════════════════════════════════════════════════════════
// 3. Cross-Document Layer Cloning (Duplicate Layer to Target Document)
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing Cross-Document Layer Cloning ---');

const sourceLayer = {
  id: 'logo_layer',
  name: 'Brand Logo',
  visible: true,
  opacity: 0.9,
  blendMode: 'multiply',
  x: 50,
  y: 50,
  width: 200,
  height: 200
};

// Duplicate sourceLayer from active document into doc2 ("Project_Banner")
const clonedLayer = docMgr.duplicateLayerTo(sourceLayer, doc2.id);
assert(clonedLayer !== null, 'Cloned layer must be created');
assert.strictEqual(clonedLayer.name, 'Brand Logo copy');
assert.strictEqual(clonedLayer.opacity, 0.9);
assert.strictEqual(clonedLayer.blendMode, 'multiply');
assert.strictEqual(doc2.layers.length, 2, 'doc2 should now have 2 layers');
assert.strictEqual(doc2.isDirty, true, 'doc2 should be marked dirty');

console.log('✅ Cross-document layer cloning passed!');

// ══════════════════════════════════════════════════════════════════════════
// 4. Dirty State Tracking
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing Dirty Tracking ---');

assert.strictEqual(initialDoc.isDirty, false);
docMgr.markDirty(true);
assert.strictEqual(initialDoc.isDirty, true, 'Active doc should be marked dirty');
docMgr.markDirty(false);
assert.strictEqual(initialDoc.isDirty, false, 'Active doc dirty flag can be cleared');

console.log('✅ Dirty state tracking passed!');

// ══════════════════════════════════════════════════════════════════════════
// 5. Closing Documents & Auto-Switching
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing Closing Documents ---');

// Currently on initialDoc (Doc 1). Close it.
docMgr.closeDocument(initialDoc.id);
assert.strictEqual(docMgr.documents.size, 2, 'Should have 2 documents left');
// Active should automatically switch to one of the remaining documents
assert(docMgr.activeDocId !== null);
assert(docMgr.activeDocId === doc2.id || docMgr.activeDocId === doc3.id);

// Close remaining documents
docMgr.closeDocument(doc2.id);
assert.strictEqual(docMgr.documents.size, 1);

docMgr.closeDocument(doc3.id);
// When last document is closed, a fresh document is automatically created
assert.strictEqual(docMgr.documents.size, 1, 'Closing last document should spawn fresh canvas');
assert(docMgr.getActiveDocument() !== null);

console.log('✅ Closing documents & fallback behavior passed!');
console.log('🎉 ALL MULTI-DOCUMENT TABBED INTERFACE TESTS PASSED (100%)!');
