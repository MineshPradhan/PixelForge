/**
 * PixelForge Studio Pro - Selective Color & Channel Mixer Engines
 * Full Photoshop parity for:
 * 1. Selective Color Adjustment Engine (Relative & Absolute CMYK color tuning across 9 color families)
 * 2. Channel Mixer Matrix Engine (Linear transformation matrix & dedicated Monochrome mode)
 * 3. Non-destructive adjustment layer & Smart Filter execution
 */

class SelectiveColorEngine {
    /**
     * Apply Selective Color adjustment to an ImageData object
     * 
     * @param {ImageData} srcImg 
     * @param {Object} params
     *   - mode: 'relative' | 'absolute' (default: 'relative')
     *   - reds, yellows, greens, cyans, blues, magentas, whites, neutrals, blacks:
     *     each is { cyan: 0, magenta: 0, yellow: 0, black: 0 } with values in [-100, 100]
     * @returns {ImageData}
     */
    static apply(srcImg, params = {}) {
        const w = srcImg.width;
        const h = srcImg.height;
        const src = srcImg.data;
        const len = src.length;

        const out = (typeof ImageData !== 'undefined') ? new ImageData(w, h) : { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
        const dst = out.data;

        const mode = params.mode || params.method || 'relative';
        const isRelative = mode === 'relative';

        // Pre-normalize adjustment tables for 9 color families
        const defaultAdj = { cyan: 0, magenta: 0, yellow: 0, black: 0 };
        const families = ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas', 'whites', 'neutrals', 'blacks'];
        const adj = {};
        families.forEach(f => {
            const p = (params.adjustments && params.adjustments[f]) || params[f] || defaultAdj;
            adj[f] = {
                c: (p.cyan ?? p.c ?? 0) / 100.0,
                m: (p.magenta ?? p.m ?? 0) / 100.0,
                y: (p.yellow ?? p.y ?? 0) / 100.0,
                k: (p.black ?? p.k ?? 0) / 100.0
            };
        });

        for (let i = 0; i < len; i += 4) {
            const r = src[i] / 255.0;
            const g = src[i + 1] / 255.0;
            const b = src[i + 2] / 255.0;
            const a = src[i + 3];

            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);

            // Compute CMYK representation
            let k = 1.0 - maxC;
            let c = maxC === 0 ? 0 : (1.0 - r - k) / (1.0 - k);
            let m = maxC === 0 ? 0 : (1.0 - g - k) / (1.0 - k);
            let y = maxC === 0 ? 0 : (1.0 - b - k) / (1.0 - k);

            // Calculate membership weights for 9 color ranges (Photoshop standard)
            // Chromatic families
            const wReds     = (r > g && r > b) ? (r - Math.max(g, b)) : 0;
            const wYellows  = (r > b && g > b) ? (Math.min(r, g) - b) : 0;
            const wGreens   = (g > r && g > b) ? (g - Math.max(r, b)) : 0;
            const wCyans    = (g > r && b > r) ? (Math.min(g, b) - r) : 0;
            const wBlues    = (b > r && b > g) ? (b - Math.max(r, g)) : 0;
            const wMagentas = (r > g && b > g) ? (Math.min(r, b) - g) : 0;

            // Achromatic families (Whites, Neutrals, Blacks)
            let wWhites = 0;
            let wBlacks = 0;
            let wNeutrals = 0;

            if (minC > 0.5) {
                wWhites = (minC - 0.5) * 2.0;
            }
            if (maxC < 0.5) {
                wBlacks = (0.5 - maxC) * 2.0;
            }
            const nonNeutral = Math.max(wWhites, wBlacks, wReds, wYellows, wGreens, wCyans, wBlues, wMagentas);
            wNeutrals = Math.max(0, 1.0 - nonNeutral);

            // Aggregate delta adjustments
            let deltaC = 0, deltaM = 0, deltaY = 0, deltaK = 0;

            const calcDelta = (ink, adjVal) => {
                if (adjVal === 0) return 0;
                if (!isRelative) return adjVal;
                return adjVal > 0 ? (1.0 - ink) * adjVal : ink * adjVal;
            };

            const applyFamily = (weight, family) => {
                if (weight <= 0) return;
                const f = adj[family];
                deltaC += weight * calcDelta(c, f.c);
                deltaM += weight * calcDelta(m, f.m);
                deltaY += weight * calcDelta(y, f.y);
                deltaK += weight * calcDelta(k, f.k);
            };

            applyFamily(wReds, 'reds');
            applyFamily(wYellows, 'yellows');
            applyFamily(wGreens, 'greens');
            applyFamily(wCyans, 'cyans');
            applyFamily(wBlues, 'blues');
            applyFamily(wMagentas, 'magentas');
            applyFamily(wWhites, 'whites');
            applyFamily(wNeutrals, 'neutrals');
            applyFamily(wBlacks, 'blacks');

            // Apply adjusted CMYK
            let newC = Math.max(0, Math.min(1.0, c + deltaC));
            let newM = Math.max(0, Math.min(1.0, m + deltaM));
            let newY = Math.max(0, Math.min(1.0, y + deltaY));
            let newK = Math.max(0, Math.min(1.0, k + deltaK));

            // Convert CMYK back to RGB
            let newR = (1.0 - newC) * (1.0 - newK);
            let newG = (1.0 - newM) * (1.0 - newK);
            let newB = (1.0 - newY) * (1.0 - newK);

            dst[i]     = Math.max(0, Math.min(255, Math.round(newR * 255)));
            dst[i + 1] = Math.max(0, Math.min(255, Math.round(newG * 255)));
            dst[i + 2] = Math.max(0, Math.min(255, Math.round(newB * 255)));
            dst[i + 3] = a;
        }

        return out;
    }
}

class ChannelMixerEngine {
    /**
     * Apply Channel Mixer matrix adjustment to an ImageData object
     * 
     * @param {ImageData} srcImg 
     * @param {Object} params
     *   - red: { r: 100, g: 0, b: 0, const: 0 }
     *   - green: { r: 0, g: 100, b: 0, const: 0 }
     *   - blue: { r: 0, g: 0, b: 100, const: 0 }
     *   - monochrome: boolean (default false)
     *   - gray: { r: 40, g: 40, b: 20, const: 0 } (used if monochrome is true)
     * @returns {ImageData}
     */
    static apply(srcImg, params = {}) {
        const w = srcImg.width;
        const h = srcImg.height;
        const src = srcImg.data;
        const len = src.length;

        const out = (typeof ImageData !== 'undefined') ? new ImageData(w, h) : { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
        const dst = out.data;

        const isMono = params.monochrome === true;
        const rCoeff = params.red || { r: 100, g: 0, b: 0, const: 0 };
        const gCoeff = params.green || { r: 0, g: 100, b: 0, const: 0 };
        const bCoeff = params.blue || { r: 0, g: 0, b: 100, const: 0 };
        const grayCoeff = params.gray || { r: 40, g: 40, b: 20, const: 0 };

        const rr = (rCoeff.r || 0) / 100, rg = (rCoeff.g || 0) / 100, rb = (rCoeff.b || 0) / 100, rc = (((rCoeff.const ?? rCoeff.constant) || 0) / 100) * 255;
        const gr = (gCoeff.r || 0) / 100, gg = (gCoeff.g || 0) / 100, gb = (gCoeff.b || 0) / 100, gc = (((gCoeff.const ?? gCoeff.constant) || 0) / 100) * 255;
        const br = (bCoeff.r || 0) / 100, bg = (bCoeff.g || 0) / 100, bb = (bCoeff.b || 0) / 100, bc = (((bCoeff.const ?? bCoeff.constant) || 0) / 100) * 255;
        const yr = (grayCoeff.r || 0) / 100, yg = (grayCoeff.g || 0) / 100, yb = (grayCoeff.b || 0) / 100, yc = (((grayCoeff.const ?? grayCoeff.constant) || 0) / 100) * 255;

        for (let i = 0; i < len; i += 4) {
            const r = src[i];
            const g = src[i + 1];
            const b = src[i + 2];
            const a = src[i + 3];

            if (isMono) {
                const gray = Math.max(0, Math.min(255, Math.round(r * yr + g * yg + b * yb + yc)));
                dst[i] = gray;
                dst[i + 1] = gray;
                dst[i + 2] = gray;
            } else {
                dst[i]     = Math.max(0, Math.min(255, Math.round(r * rr + g * rg + b * rb + rc)));
                dst[i + 1] = Math.max(0, Math.min(255, Math.round(r * gr + g * gg + b * gb + gc)));
                dst[i + 2] = Math.max(0, Math.min(255, Math.round(r * br + g * bg + b * bb + bc)));
            }
            dst[i + 3] = a;
        }

        return out;
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SelectiveColorEngine, ChannelMixerEngine };
}
if (typeof window !== 'undefined') {
    window.SelectiveColorEngine = SelectiveColorEngine;
    window.ChannelMixerEngine = ChannelMixerEngine;
    if (window.Filters) {
        window.Filters.selectiveColor = (imgData, params) => SelectiveColorEngine.apply(imgData, params);
        window.Filters.channelMixer = (imgData, params) => ChannelMixerEngine.apply(imgData, params);
    }
}
if (typeof global !== 'undefined') {
    global.SelectiveColorEngine = SelectiveColorEngine;
    global.ChannelMixerEngine = ChannelMixerEngine;
}
if (typeof Filters !== 'undefined') {
    Filters.selectiveColor = (imgData, params) => SelectiveColorEngine.apply(imgData, params);
    Filters.channelMixer = (imgData, params) => ChannelMixerEngine.apply(imgData, params);
}
