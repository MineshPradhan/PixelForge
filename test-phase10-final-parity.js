/**
 * PixelForge Studio Pro - Phase 10 Final Photoshop Parity Test Suite
 * Tests the 5 final Photoshop frontiers:
 * 1. High Pass Filter & 1-Click Frequency Separation Suite
 * 2. Channels Palette Engine
 * 3. History Brush & Art History Brush Tool
 * 4. Puppet Warp Engine
 * 5. Frame Animation Timeline & Pure JS Animated GIF Encoder
 */

const assert = require('assert');

// Polyfill minimal ImageData and Canvas for Node.js test environment
class MockImageData {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
    }
}
global.ImageData = MockImageData;

class MockCanvasContext {
    constructor(width, height) {
        this.canvas = { width, height };
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
    }
    getImageData(x, y, w, h) {
        const out = new MockImageData(w, h);
        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                const srcIdx = ((y + row) * this.width + (x + col)) * 4;
                const dstIdx = (row * w + col) * 4;
                for (let c = 0; c < 4; c++) {
                    out.data[dstIdx + c] = this.data[srcIdx + c] || 0;
                }
            }
        }
        return out;
    }
    putImageData(imgData, x, y) {
        const w = imgData.width;
        const h = imgData.height;
        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                const dstIdx = ((y + row) * this.width + (x + col)) * 4;
                const srcIdx = (row * w + col) * 4;
                for (let c = 0; c < 4; c++) {
                    this.data[dstIdx + c] = imgData.data[srcIdx + c];
                }
            }
        }
    }
    drawImage() {}
    save() {}
    restore() {}
    beginPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    arc() {}
    fill() {}
    stroke() {}
    clip() {}
    translate() {}
    rotate() {}
    transform() {}
    clearRect(x, y, w, h) {
        this.data.fill(0);
    }
}

class MockCanvas {
    constructor(width = 100, height = 100) {
        this.width = width;
        this.height = height;
        this.ctx = new MockCanvasContext(width, height);
    }
    getContext(type) {
        return this.ctx;
    }
}

global.document = {
    createElement(tag) {
        if (tag === 'canvas') return new MockCanvas(100, 100);
        return {};
    }
};

// Require Phase 10 engine modules
const { HighPassFilter, FrequencySeparationEngine } = require('./js/highpass-freqsep.js');
const { ChannelItem, ChannelsEngine } = require('./js/channels-engine.js');
const { HistoryBrushEngine } = require('./js/history-brush.js');
const { PuppetPin, PuppetTriangle, PuppetWarpEngine } = require('./js/puppet-warp.js');
const { TimelineFrame, TimelineManager, GifEncoder } = require('./js/timeline-gif.js');
const { SmartFilter } = require('./js/smart-objects.js');

console.log('Testing Phase 10: Final Photoshop Parity Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        console.error(err.stack);
    }
}

// ═════════════════════════════════════════════════════════════════════
// 1. High Pass Filter & 1-Click Frequency Separation Suite
// ═════════════════════════════════════════════════════════════════════
console.log('[1/5] High Pass Filter & Frequency Separation Suite:');

runTest('HighPassFilter: Output neutralizes flat areas to 128 neutral gray and isolates high-frequency edges', () => {
    const w = 20, h = 20;
    const img = new MockImageData(w, h);
    // Draw flat 200 gray area with a high-contrast black line in the middle
    for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = 200;
        img.data[i + 1] = 200;
        img.data[i + 2] = 200;
        img.data[i + 3] = 255;
    }
    // High contrast line at x = 10
    for (let y = 0; y < h; y++) {
        const idx = (y * w + 10) * 4;
        img.data[idx] = 10;
        img.data[idx + 1] = 10;
        img.data[idx + 2] = 10;
    }

    const filtered = HighPassFilter.apply(img, 2.0);
    assert.strictEqual(filtered.width, w);
    assert.strictEqual(filtered.height, h);

    // Far from edge (e.g. x = 2), flat areas become ~128 neutral gray
    const flatIdx = (5 * w + 2) * 4;
    assert(Math.abs(filtered.data[flatIdx] - 128) <= 4, `Flat area should be ~128, got ${filtered.data[flatIdx]}`);

    // At edge (x = 10), difference is significant
    const edgeIdx = (5 * w + 10) * 4;
    assert(Math.abs(filtered.data[edgeIdx] - 128) > 20, `Edge pixel should deviate from 128, got ${filtered.data[edgeIdx]}`);
    assert.strictEqual(filtered.data[edgeIdx + 3], 255, 'Alpha channel must be preserved');
});

runTest('FrequencySeparationEngine: 1-click splits layer into Low Tone & High Texture with linear-light blend', () => {
    const mockApp = {
        width: 40,
        height: 40,
        layerManager: {
            layers: [],
            addGroup(name) {
                const group = { id: 'grp_1', name, isGroup: true, children: [] };
                this.layers.push(group);
                return group;
            },
            addLayer(name) {
                const canvas = new MockCanvas(40, 40);
                const layer = { id: 'layer_' + Math.random(), name, canvas, ctx: canvas.ctx, blendMode: 'normal' };
                this.layers.push(layer);
                return layer;
            }
        }
    };

    const engine = new FrequencySeparationEngine(mockApp);
    const sourceCanvas = new MockCanvas(40, 40);
    // Fill source canvas with test gradient
    for (let i = 0; i < sourceCanvas.ctx.data.length; i += 4) {
        sourceCanvas.ctx.data[i] = 180;
        sourceCanvas.ctx.data[i + 1] = 140;
        sourceCanvas.ctx.data[i + 2] = 100;
        sourceCanvas.ctx.data[i + 3] = 255;
    }

    const activeLayer = { name: 'Portrait', canvas: sourceCanvas, ctx: sourceCanvas.ctx };
    const result = engine.separate(activeLayer, 3.0);

    assert(result.group, 'Must create a dedicated group');
    assert(result.lowLayer, 'Must create Low Frequency tone layer');
    assert(result.highLayer, 'Must create High Frequency texture layer');
    assert.strictEqual(result.highLayer.blendMode, 'linear-light', 'High texture layer must use linear-light blend mode');
});

runTest('SmartFilter: Integrates highPass non-destructively in smart object filter stack', () => {
    const sf = new SmartFilter('highPass', { radius: 3.5 });
    assert.strictEqual(sf.type, 'highPass');
    assert.strictEqual(sf.name, 'High Pass Filter');
    assert.strictEqual(SmartFilter.getFilterTitle('highPass'), 'High Pass Filter');

    const img = new MockImageData(10, 10);
    img.data.fill(128);
    const res = sf.apply(img);
    assert.strictEqual(res.width, 10);
});

// ═════════════════════════════════════════════════════════════════════
// 2. Channels Palette Engine
// ═════════════════════════════════════════════════════════════════════
console.log('\n[2/5] Channels Palette & Calculations Engine:');

runTest('ChannelsEngine: Isolates R, G, B component channels and manages Alpha channels', () => {
    const mockApp = {
        width: 10,
        height: 10,
        layerManager: {
            layers: []
        }
    };
    const engine = new ChannelsEngine(mockApp);
    const list = engine.getChannelList();
    assert.strictEqual(list.length, 4, 'Initial channels should be RGB, Red, Green, Blue');

    // Create custom Alpha channel
    const alphaCh = engine.createAlphaChannel('Shadow Mask', 0);
    assert.strictEqual(alphaCh.name, 'Shadow Mask');
    assert.strictEqual(engine.channels.length, 5);

    // Duplicate channel
    const dup = engine.duplicateChannel(alphaCh.id);
    assert(dup.name.includes('Copy'));
    assert.strictEqual(engine.channels.length, 6);

    // Delete alpha channel
    const deleted = engine.deleteAlphaChannel(dup.id);
    assert(deleted, 'Must return removed channel');
    assert.strictEqual(engine.channels.length, 5);
});

runTest('ChannelsEngine: Converts selection to Alpha channel and Alpha channel to selection mask', () => {
    const mockApp = {
        width: 10,
        height: 10
    };
    const engine = new ChannelsEngine(mockApp);
    const selection = {
        x: 2, y: 2, w: 4, h: 4,
        mask: new Uint8ClampedArray(4 * 4).fill(255)
    };

    const alphaCh = engine.saveSelectionAsAlpha(selection, 'Eye Selection');
    assert(alphaCh, 'Must create alpha channel from selection');

    // Load back channel as selection
    const loadedSel = engine.loadChannelAsSelection(alphaCh.id);
    assert.strictEqual(loadedSel.x, 0);
    assert.strictEqual(loadedSel.y, 0);
    assert.strictEqual(loadedSel.w, 10);
    assert.strictEqual(loadedSel.h, 10);
    assert.strictEqual(loadedSel.mask.length, 100);
});

runTest('ChannelsEngine: Channel Calculations computes blend modes between arbitrary channels', () => {
    const engine = new ChannelsEngine({ width: 5, height: 5 });
    const chA = engine.createAlphaChannel('A', 200);
    const chB = engine.createAlphaChannel('B', 100);

    const calcCh = engine.calculate(chA.id, chB.id, 'multiply', 1.0);
    assert(calcCh, 'Must create resulting calculation channel');
    // 200 * 100 / 255 = ~78
    assert(Math.abs(calcCh.data[0] - 78) <= 2, `Multiply calculation should be ~78, got ${calcCh.data[0]}`);
});

// ═════════════════════════════════════════════════════════════════════
// 3. History Brush & Art History Brush Engine
// ═════════════════════════════════════════════════════════════════════
console.log('\n[3/5] History Brush & Art History Brush Suite:');

runTest('HistoryBrushEngine: Paints historical snapshot pixels back with radial feathering', () => {
    const engine = new HistoryBrushEngine();
    const snapshot = new MockImageData(20, 20);
    // Source snapshot has green pixels (0, 255, 0)
    for (let i = 0; i < snapshot.data.length; i += 4) {
        snapshot.data[i] = 0;
        snapshot.data[i + 1] = 255;
        snapshot.data[i + 2] = 0;
        snapshot.data[i + 3] = 255;
    }
    engine.setSource(snapshot, 'Initial Green State');

    // Target layer currently has black pixels (0, 0, 0)
    const targetCanvas = new MockCanvas(20, 20);
    targetCanvas.ctx.data.fill(0);

    // Paint historical green stroke in the center (10, 10)
    engine.paintStroke(targetCanvas.ctx, 10, 10, 8, 1.0, 1.0, 1.0);

    const centerIdx = (10 * 20 + 10) * 4;
    assert.strictEqual(targetCanvas.ctx.data[centerIdx + 1], 255, 'Center pixel should be restored to 255 green');

    // Outer corner (0, 0) remains untouched black
    const cornerIdx = 0;
    assert.strictEqual(targetCanvas.ctx.data[cornerIdx + 1], 0, 'Untouched pixel must remain 0');
});

runTest('HistoryBrushEngine: Art History Brush creates stylized impressionist daubs', () => {
    const engine = new HistoryBrushEngine();
    const snapshot = new MockImageData(20, 20);
    snapshot.data.fill(200);
    engine.setSource(snapshot);

    const targetCanvas = new MockCanvas(20, 20);
    // Should execute without error for various artistic stroke styles
    ['standard', 'dab', 'tight-short', 'tight-curl'].forEach(style => {
        engine.paintArtStroke(targetCanvas.ctx, 10, 10, 10, style, 0.8);
    });
});

// ═════════════════════════════════════════════════════════════════════
// 4. Puppet Warp Engine
// ═════════════════════════════════════════════════════════════════════
console.log('\n[4/5] Puppet Warp Engine & Piecewise Affine Mapping:');

runTest('PuppetWarpEngine: Generates Delaunay triangular mesh over raster bounds', () => {
    const engine = new PuppetWarpEngine();
    const layerCanvas = new MockCanvas(50, 50);
    // Fill non-transparent circular disc in layer
    for (let y = 10; y <= 40; y++) {
        for (let x = 10; x <= 40; x++) {
            const idx = (y * 50 + x) * 4;
            layerCanvas.ctx.data[idx + 3] = 255; // Opaque
        }
    }

    const layer = { width: 50, height: 50, canvas: layerCanvas, ctx: layerCanvas.ctx };
    engine.initMesh(layer, 'normal');

    assert(engine.vertices.length > 0, 'Must generate mesh vertices');
    assert(engine.triangles.length > 0, 'Must generate mesh triangles');
    assert(engine.pins.length >= 3, 'Must place default anchor pins');
});

runTest('PuppetWarpEngine: ARAP deformation solver updates mesh vertices smoothly based on pins', () => {
    const engine = new PuppetWarpEngine();
    engine.vertices = [
        { origX: 0, origY: 0, x: 0, y: 0 },
        { origX: 20, origY: 0, x: 20, y: 0 },
        { origX: 10, origY: 20, x: 10, y: 20 }
    ];
    engine.triangles = [new PuppetTriangle(0, 1, 2)];

    const pin1 = engine.addPin(0, 0, true);
    const pin2 = engine.addPin(20, 0, false);

    // Displace pin2 by +10 in Y
    pin2.y = 10;
    engine.solveDeformation();

    // Vertex 0 at anchor should stay at (0, 0)
    assert(Math.abs(engine.vertices[0].x - 0) < 1e-3);
    assert(Math.abs(engine.vertices[0].y - 0) < 1e-3);

    // Vertex 1 at pin2 should be deformed to Y=10
    assert(Math.abs(engine.vertices[1].x - 20) < 1e-3);
    assert(Math.abs(engine.vertices[1].y - 10) < 1e-3);

    // Middle vertex 2 should receive smooth weighted deformation
    assert(engine.vertices[2].y > 0, 'Vertex 2 Y should shift downward towards pin2');
});

runTest('PuppetWarpEngine: Piecewise affine texture mapping executes hardware triangle transform', () => {
    const ctx = new MockCanvasContext(50, 50);
    const img = new MockCanvas(50, 50);

    // Render triangle mapping
    PuppetWarpEngine.renderTriangleTexture(
        ctx, img,
        0, 0, 20, 0, 10, 20,
        0, 0, 25, 5, 12, 22
    );
});

// ═════════════════════════════════════════════════════════════════════
// 5. Timeline & Pure JS Animated GIF Encoder
// ═════════════════════════════════════════════════════════════════════
console.log('\n[5/5] Timeline & Animated GIF89a Suite:');

runTest('TimelineManager: Manages frames, delays, looping, and active selection', () => {
    const mockApp = {
        mainCanvas: new MockCanvas(20, 20),
        mainCtx: new MockCanvasContext(20, 20),
        layerManager: { layers: [] },
        renderComposite() {}
    };

    const tm = new TimelineManager(mockApp);
    assert.strictEqual(tm.frames.length, 0);

    const f1 = tm.createFrame(0.1);
    const f2 = tm.createFrame(0.2);
    assert.strictEqual(tm.frames.length, 2);
    assert.strictEqual(tm.activeFrameIndex, 1);

    tm.duplicateFrame(0);
    assert.strictEqual(tm.frames.length, 3);

    tm.deleteFrame(1);
    assert.strictEqual(tm.frames.length, 2);

    tm.loop = '3times';
    assert.strictEqual(tm.loop, '3times');
});

runTest('GifEncoder: Encodes multi-frame GIF89a binary with Netscape 2.0 looping and LZW compression', () => {
    const encoder = new GifEncoder(16, 16);
    encoder.start();
    encoder.setRepeat(0); // Loop forever

    const frame1 = new Uint8ClampedArray(16 * 16 * 4);
    frame1.fill(255); // White frame
    const frame2 = new Uint8ClampedArray(16 * 16 * 4);
    // Red frame
    for (let i = 0; i < frame2.length; i += 4) {
        frame2[i] = 255;
        frame2[i + 3] = 255;
    }

    encoder.setDelay(100); // 100ms
    encoder.addFrame(frame1);
    encoder.setDelay(200); // 200ms
    encoder.addFrame(frame2);

    encoder.finish();
    const bytes = encoder.getUint8Array();

    assert(bytes.length > 50, 'GIF binary must contain data');

    // Verify GIF89a magic header
    const header = String.fromCharCode(...bytes.slice(0, 6));
    assert.strictEqual(header, 'GIF89a', `Header must be GIF89a, got ${header}`);

    // Verify dimensions in Logical Screen Descriptor (16x16)
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    assert.strictEqual(width, 16);
    assert.strictEqual(height, 16);

    // Verify GIF terminator byte (0x3B)
    assert.strictEqual(bytes[bytes.length - 1], 0x3B, 'GIF stream must end with 0x3B terminator');
});

// ═════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════
console.log(`\nPhase 10 Final Parity Results: ${passedTests} / ${totalTests} tests passed (${Math.round(passedTests / totalTests * 100)}%).`);
if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 10 FINAL PHOTOSHOP PARITY TESTS PASSED 100%!');
    process.exit(0);
} else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
}
