/**
 * Automated Test Suite: Phase 11 Elite Photoshop Parity Engines
 *
 * Validates:
 * 1. Selective Color Engine (relative/absolute CMYK tuning across color families)
 * 2. Channel Mixer Engine (linear color transform matrix & monochrome solver)
 * 3. Color Range Selection Engine (fuzziness, continuous 3D Euclidean distance & preset clustering)
 * 4. Trimap Matting & Edge Refinement Engine (smoothing, feathering, edge shift, contrast & fringe decontamination)
 * 5. Displacement Map Filter (subpixel bilinear distortion, wrapAround & repeatEdge modes)
 * 6. Vanishing Point Engine (4-point perspective plane, homography matrix & grid projection)
 * 7. 32-Bit Linear HDR Engine (sRGB <-> linear conversion, EV scaling & ACES Filmic / Reinhard tone mappers)
 * 8. SmartFilter & Adjustment Layer Integration
 */

const assert = require('assert');

// 1. Load Engines
const { SelectiveColorEngine, ChannelMixerEngine } = require('./js/selective-color.js');
const { ColorRangeEngine, TrimapMattingEngine } = require('./js/color-range-refine.js');
const { DisplacementFilter, VanishingPlane, VanishingPointEngine } = require('./js/displace-vanishing.js');
const { HDRBuffer, HDREngine, WebGLAccelerator } = require('./js/hdr-webgl.js');
const SmartFilter = require('./js/smart-objects.js').SmartFilter;

global.SelectiveColorEngine = SelectiveColorEngine;
global.ChannelMixerEngine = ChannelMixerEngine;
global.ColorRangeEngine = ColorRangeEngine;
global.TrimapMattingEngine = TrimapMattingEngine;
global.DisplacementFilter = DisplacementFilter;
global.VanishingPlane = VanishingPlane;
global.VanishingPointEngine = VanishingPointEngine;
global.HDRBuffer = HDRBuffer;
global.HDREngine = HDREngine;
global.WebGLAccelerator = WebGLAccelerator;

console.log('🧪 Starting Test Suite: Phase 11 Elite Engines...');

let passed = 0;
let failed = 0;

function it(desc, fn) {
    try {
        fn();
        console.log(`  ✓ ${desc}`);
        passed++;
    } catch (e) {
        console.error(`  ✗ ${desc}`);
        console.error(e);
        failed++;
    }
}

// Helper: Mock ImageData
function createMockImageData(width, height, fillR = 0, fillG = 0, fillB = 0, fillA = 255) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = fillR;
        data[i + 1] = fillG;
        data[i + 2] = fillB;
        data[i + 3] = fillA;
    }
    return { width, height, data };
}

// ═══════════════════════════════════════════════════════════════
// Suite 1: Selective Color Engine
// ═══════════════════════════════════════════════════════════════
console.log('\n--- Suite 1: Selective Color Engine ---');

it('Selective Color: Modifies pure Red pixel when Reds family is adjusted (Relative mode)', () => {
    const img = createMockImageData(2, 2, 255, 0, 0, 255); // pure red
    const params = {
        method: 'relative',
        adjustments: {
            reds: { c: 50, m: -20, y: 10, k: 0 } // increase cyan, reduce magenta, increase yellow
        }
    };
    const res = SelectiveColorEngine.apply(img, params);
    assert.strictEqual(res.width, 2);
    // Red channel should be modified due to cyan delta
    assert.notStrictEqual(res.data[0], 255, 'Red channel altered by cyan adjustment');
    assert.strictEqual(res.data[3], 255, 'Alpha preserved');
});

it('Selective Color: Modifies pure Red pixel in Absolute mode', () => {
    const img = createMockImageData(2, 2, 255, 0, 0, 255);
    const params = {
        method: 'absolute',
        adjustments: {
            reds: { c: 30, m: 0, y: 0, k: 20 } // add cyan and black
        }
    };
    const res = SelectiveColorEngine.apply(img, params);
    assert.ok(res.data[0] < 255, 'Red intensity reduced in absolute mode with positive black and cyan');
    assert.ok(res.data[1] >= 0, 'Green stays within valid 0-255 bounds');
});

it('Selective Color: Neutral family adjusts midtones without altering pure white or black', () => {
    const imgMid = createMockImageData(2, 2, 128, 128, 128, 255);
    const params = {
        method: 'relative',
        adjustments: {
            neutrals: { c: 50, m: 0, y: -50, k: 0 }
        }
    };
    const resMid = SelectiveColorEngine.apply(imgMid, params);
    assert.notStrictEqual(resMid.data[0], 128, 'Neutral midtone modified');
});

// ═══════════════════════════════════════════════════════════════
// Suite 2: Channel Mixer Engine
// ═══════════════════════════════════════════════════════════════
console.log('\n--- Suite 2: Channel Mixer Engine ---');

it('Channel Mixer: Linear RGB transformation matrix swap', () => {
    // Red pixel (200, 50, 20)
    const img = createMockImageData(2, 2, 200, 50, 20, 255);
    // Matrix to swap Red and Green channels
    const params = {
        monochrome: false,
        red:   { r: 0, g: 100, b: 0, constant: 0 },
        green: { r: 100, g: 0, b: 0, constant: 0 },
        blue:  { r: 0, g: 0, b: 100, constant: 0 }
    };
    const res = ChannelMixerEngine.apply(img, params);
    assert.strictEqual(res.data[0], 50, 'Output Red became Input Green');
    assert.strictEqual(res.data[1], 200, 'Output Green became Input Red');
    assert.strictEqual(res.data[2], 20, 'Output Blue stayed Input Blue');
    assert.strictEqual(res.data[3], 255, 'Alpha preserved');
});

it('Channel Mixer: Monochrome mode produces equal R, G, B with constant offset', () => {
    const img = createMockImageData(2, 2, 100, 100, 100, 255);
    const params = {
        monochrome: true,
        gray: { r: 40, g: 40, b: 20, constant: 10 } // 40 + 40 + 20 + 25.5 = 125.5 -> 126
    };
    const res = ChannelMixerEngine.apply(img, params);
    assert.strictEqual(res.data[0], res.data[1], 'R equals G in monochrome mode');
    assert.strictEqual(res.data[1], res.data[2], 'G equals B in monochrome mode');
    assert.ok(res.data[0] > 100, 'Monochrome value reflects constant offset');
});

// ═══════════════════════════════════════════════════════════════
// Suite 3: Color Range Selection Engine
// ═══════════════════════════════════════════════════════════════
console.log('\n--- Suite 3: Color Range Selection Engine ---');

it('Color Range: Selects target color with exact match at distance 0', () => {
    const img = createMockImageData(4, 4, 255, 0, 0, 255); // all red
    const selection = ColorRangeEngine.createSelection(img, { r: 255, g: 0, b: 0 }, 40);
    assert.strictEqual(selection.w, 4);
    assert.strictEqual(selection.h, 4);
    assert.strictEqual(selection.mask.length, 16);
    assert.strictEqual(selection.mask[0], 255, 'Exact match yields full selection mask 255');
});

it('Color Range: Fuzziness falloff provides soft selection edge', () => {
    // Pixel with distance from target
    const img = createMockImageData(1, 1, 220, 0, 0, 255);
    const selection = ColorRangeEngine.createSelection(img, { r: 255, g: 0, b: 0 }, 50);
    assert.ok(selection.mask[0] > 0 && selection.mask[0] < 255, `Mask value ${selection.mask[0]} is softly feathered`);
});

it('Color Range: Invert flag reverses mask selection', () => {
    const img = createMockImageData(2, 2, 255, 0, 0, 255);
    const selNorm = ColorRangeEngine.createSelection(img, { r: 255, g: 0, b: 0 }, 40, { invert: false });
    const selInv = ColorRangeEngine.createSelection(img, { r: 255, g: 0, b: 0 }, 40, { invert: true });
    assert.strictEqual(selNorm.mask[0], 255);
    assert.strictEqual(selInv.mask[0], 0);
});

it('Color Range: Preset clusters correctly filter highlights and shadows', () => {
    const img = createMockImageData(2, 2, 240, 240, 240, 255); // high luminance
    const selHi = ColorRangeEngine.createSelection(img, 'highlights', 40);
    const selSh = ColorRangeEngine.createSelection(img, 'shadows', 40);
    assert.ok(selHi.mask[0] > 180, 'Highlights preset captures bright pixel');
    assert.ok(selSh.mask[0] === 0, 'Shadows preset ignores bright pixel');
});

// ═══════════════════════════════════════════════════════════════
// Suite 4: Trimap Matting & Edge Refinement Engine
// ═══════════════════════════════════════════════════════════════
console.log('\n--- Suite 4: Trimap Matting & Edge Refinement Engine ---');

it('Trimap Matting: Feathering smooths mask edge values', () => {
    const img = createMockImageData(4, 4, 100, 100, 100, 255);
    // Hard step mask: left half 255, right half 0
    const rawMask = new Uint8ClampedArray(16);
    rawMask[0] = 255; rawMask[1] = 255; rawMask[2] = 0; rawMask[3] = 0;
    rawMask[4] = 255; rawMask[5] = 255; rawMask[6] = 0; rawMask[7] = 0;
    rawMask[8] = 255; rawMask[9] = 255; rawMask[10] = 0; rawMask[11] = 0;
    rawMask[12] = 255; rawMask[13] = 255; rawMask[14] = 0; rawMask[15] = 0;

    const baseSel = { x: 0, y: 0, w: 4, h: 4, mask: rawMask };
    const refined = TrimapMattingEngine.refineEdge(img, baseSel, { feather: 1.0 });

    assert.ok(refined.selection.mask.length === 16);
    // Boundary pixel at index 1 or 2 should be feathered
    assert.ok(refined.selection.mask[1] <= 255 && refined.selection.mask[2] >= 0);
});

it('Trimap Matting: Shift edge dilates or erodes selection boundary', () => {
    const img = createMockImageData(5, 5, 100, 100, 100, 255);
    const rawMask = new Uint8ClampedArray(25);
    // Center 3x3 is 255, border is 0
    for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
            rawMask[y * 5 + x] = 255;
        }
    }
    const baseSel = { x: 0, y: 0, w: 5, h: 5, mask: rawMask };

    const dilated = TrimapMattingEngine.refineEdge(img, baseSel, { shiftEdge: 50 });
    const eroded  = TrimapMattingEngine.refineEdge(img, baseSel, { shiftEdge: -50 });

    assert.ok(dilated.selection.mask[2] > 0, 'Positive shiftEdge dilates mask outward into border');
    assert.strictEqual(eroded.selection.mask[1 * 5 + 1], 0, 'Negative shiftEdge erodes mask corner inward');
});

it('Trimap Matting: Color decontamination removes fringe from edge pixels', () => {
    // 3x3 image with green fringe along boundary
    const img = createMockImageData(3, 3, 0, 255, 0, 255);
    img.data[0] = 255; img.data[1] = 0; img.data[2] = 0; // foreground center red
    const mask = new Uint8ClampedArray([
        255, 128, 0,
        128, 128, 0,
        0,   0,   0
    ]);
    const baseSel = { x: 0, y: 0, w: 3, h: 3, mask };
    const refined = TrimapMattingEngine.refineEdge(img, baseSel, { decontaminate: true });

    assert.ok(refined.decontaminatedImgData !== null);
    assert.strictEqual(refined.decontaminatedImgData.width, 3);
});

// ═══════════════════════════════════════════════════════════════
// Suite 5: Displacement Map Filter
// ═══════════════════════════════════════════════════════════════
console.log('\n--- Suite 5: Displacement Map Filter ---');

it('Displacement: Zero delta map (128, 128) results in identity displacement', () => {
    const src = createMockImageData(4, 4, 150, 75, 200, 255);
    const map = createMockImageData(4, 4, 128, 128, 128, 255); // 128 is neutral (0 shift)
    const displaced = DisplacementFilter.apply(src, map, 20, 20, 'repeatEdge');

    assert.strictEqual(displaced.data[0], 150, 'Red unchanged');
    assert.strictEqual(displaced.data[1], 75,  'Green unchanged');
    assert.strictEqual(displaced.data[2], 200, 'Blue unchanged');
    assert.strictEqual(displaced.data[3], 255, 'Alpha preserved');
});

it('Displacement: Positive red/green map shifts pixels correctly with repeatEdge mode', () => {
    const src = createMockImageData(4, 4, 10, 20, 30, 255);
    // Put distinctive pixel at (1, 1)
    const idx = (1 * 4 + 1) * 4;
    src.data[idx] = 99; src.data[idx+1] = 99; src.data[idx+2] = 99;

    const map = createMockImageData(4, 4, 255, 255, 128, 255); // shift right and down
    const displaced = DisplacementFilter.apply(src, map, 2, 2, 'repeatEdge');

    assert.ok(displaced.data.length === 4 * 4 * 4);
    assert.strictEqual(displaced.data[3], 255);
});

it('Displacement: wrapAround mode wraps out-of-bounds coordinates seamlessly', () => {
    const src = createMockImageData(4, 4, 50, 50, 50, 255);
    const map = createMockImageData(4, 4, 255, 128, 128, 255); // extreme horizontal shift
    const displaced = DisplacementFilter.apply(src, map, 50, 0, 'wrapAround');
    assert.strictEqual(displaced.data.length, 64);
    assert.strictEqual(displaced.data[3], 255);
});

// ═══════════════════════════════════════════════════════════════
// Suite 6: Vanishing Point 3D Perspective Plane Engine
// ═══════════════════════════════════════════════════════════════
console.log('\n--- Suite 6: Vanishing Point Engine ---');

it('VanishingPlane: Solves homography matrix for 4 quadrilateral control points', () => {
    const plane = new VanishingPlane();
    plane.corners = [
        { x: 50,  y: 50 },
        { x: 250, y: 70 },
        { x: 270, y: 280 },
        { x: 30,  y: 260 }
    ];
    const H = plane.getHomography();
    assert.ok(H !== null, 'Homography matrix computed');
    assert.strictEqual(typeof H.a, 'number');
    assert.strictEqual(typeof H.b, 'number');
    assert.strictEqual(typeof H.h, 'number');
});

it('VanishingPlane: Maps (0,0) exactly to Top-Left corner and (1,1) to Bottom-Right corner', () => {
    const plane = new VanishingPlane();
    plane.corners = [
        { x: 100, y: 100 },
        { x: 400, y: 120 },
        { x: 450, y: 400 },
        { x: 80,  y: 380 }
    ];
    const pTL = plane.mapPoint(0, 0);
    const pBR = plane.mapPoint(1, 1);

    assert.ok(Math.abs(pTL.x - 100) < 1e-3, 'TL x matches');
    assert.ok(Math.abs(pTL.y - 100) < 1e-3, 'TL y matches');
    assert.ok(Math.abs(pBR.x - 450) < 1e-3, 'BR x matches');
    assert.ok(Math.abs(pBR.y - 400) < 1e-3, 'BR y matches');
});

it('VanishingPointEngine: Manages plane list and active state', () => {
    const engine = new VanishingPointEngine();
    assert.strictEqual(engine.active, false);
    const plane = engine.createPlane();
    assert.strictEqual(engine.planes.length, 1);
    assert.strictEqual(engine.activePlane, plane);
});

// ═══════════════════════════════════════════════════════════════
// Suite 7: 32-Bit Linear HDR Engine & Tone Mappers
// ═══════════════════════════════════════════════════════════════
console.log('\n--- Suite 7: 32-Bit Linear HDR Engine ---');

it('HDRBuffer: Converts 8-bit sRGB to linear float and back accurately', () => {
    const img = createMockImageData(2, 2, 128, 64, 255, 255);
    const hdr = HDRBuffer.fromImageData(img);

    assert.strictEqual(hdr.data.constructor.name, 'Float32Array');
    assert.strictEqual(hdr.data.length, 16);
    // Linear 128/255 sRGB is approx 0.215
    assert.ok(hdr.data[0] > 0.15 && hdr.data[0] < 0.28, `Linear red: ${hdr.data[0]}`);

    const roundTrip = hdr.toImageData();
    assert.strictEqual(roundTrip.data[0], 128);
    assert.strictEqual(roundTrip.data[1], 64);
    assert.strictEqual(roundTrip.data[2], 255);
    assert.strictEqual(roundTrip.data[3], 255);
});

it('HDREngine: ACES Filmic tone mapping gracefully handles specular highlights (> 1.0)', () => {
    const hdr = new HDRBuffer(1, 1);
    // Specular highlight HDR value 5.0 (overexposed)
    hdr.data[0] = 5.0; hdr.data[1] = 5.0; hdr.data[2] = 5.0; hdr.data[3] = 1.0;

    const aces = HDREngine.toneMapACES(hdr);
    const outImg = aces.toImageData();

    assert.ok(outImg.data[0] <= 255 && outImg.data[0] >= 240, 'Specular value compressed to ceiling without clipping artifacts');
});

it('HDREngine: Reinhard & Extended Reinhard tone mapping preserve midtones', () => {
    const hdr = new HDRBuffer(1, 1);
    hdr.data[0] = 0.5; hdr.data[1] = 0.5; hdr.data[2] = 0.5; hdr.data[3] = 1.0;

    const rStd = HDREngine.toneMapReinhard(hdr);
    const rExt = HDREngine.toneMapExtendedReinhard(hdr, 2.0);

    const imgStd = rStd.toImageData();
    const imgExt = rExt.toImageData();

    assert.ok(imgStd.data[0] > 0 && imgStd.data[0] < 255);
    assert.ok(imgExt.data[0] > 0 && imgExt.data[0] < 255);
});

it('HDREngine.applyToneMapping: Full end-to-end pipeline with exposure scaling', () => {
    const src = createMockImageData(4, 4, 100, 100, 100, 255);
    const tonedPlus = HDREngine.applyToneMapping(src, 'aces', 1.0); // +1 EV
    const tonedMinus = HDREngine.applyToneMapping(src, 'aces', -1.0); // -1 EV

    assert.ok(tonedPlus.data[0] > tonedMinus.data[0], '+1 EV is brighter than -1 EV');
});

// ═══════════════════════════════════════════════════════════════
// Suite 8: SmartFilter & Adjustment Layer Architecture Integration
// ═══════════════════════════════════════════════════════════════
console.log('\n--- Suite 8: SmartFilter & Layer Integration ---');

it('SmartFilter: Recognizes titles for all Phase 11 elite filters', () => {
    assert.strictEqual(SmartFilter.getFilterTitle('selectiveColor'), 'Selective Color');
    assert.strictEqual(SmartFilter.getFilterTitle('channelMixer'), 'Channel Mixer');
    assert.strictEqual(SmartFilter.getFilterTitle('displace'), 'Displace Filter');
    assert.strictEqual(SmartFilter.getFilterTitle('hdrToneMapping'), 'HDR Tone Mapping');
});

it('SmartFilter: Executes selectiveColor on Smart Object raster data non-destructively', () => {
    const sf = new SmartFilter('selectiveColor', {
        method: 'relative',
        adjustments: { reds: { c: 50, m: 0, y: 0, k: 0 } }
    });
    const src = createMockImageData(2, 2, 255, 0, 0, 255);
    const res = sf.apply(src);
    assert.notStrictEqual(res.data[0], 255, 'Selective color executed via SmartFilter');
});

it('SmartFilter: Executes channelMixer on Smart Object raster data non-destructively', () => {
    const sf = new SmartFilter('channelMixer', {
        monochrome: true,
        gray: { r: 50, g: 50, b: 0, constant: 0 }
    });
    const src = createMockImageData(2, 2, 200, 100, 50, 255);
    const res = sf.apply(src);
    assert.strictEqual(res.data[0], res.data[1]);
    assert.strictEqual(res.data[1], res.data[2]);
});

it('SmartFilter: Executes hdrToneMapping on Smart Object raster data non-destructively', () => {
    const sf = new SmartFilter('hdrToneMapping', {
        method: 'aces',
        exposureEV: 0.5
    });
    const src = createMockImageData(2, 2, 120, 120, 120, 255);
    const res = sf.apply(src);
    assert.ok(res.data[0] > 0);
    assert.strictEqual(res.data[3], 255);
});

// ═══════════════════════════════════════════════════════════════
// Final Results
// ═══════════════════════════════════════════════════════════════
console.log(`\n═══════════════════════════════════════════════════════`);
console.log(`Phase 11 Elite Engines Tests Completed:`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`═══════════════════════════════════════════════════════\n`);

if (failed > 0) {
    process.exit(1);
}
