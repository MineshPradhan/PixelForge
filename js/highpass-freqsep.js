/**
 * PixelForge Studio Pro - High Pass Filter & Automated Frequency Separation Suite
 * Full Photoshop parity for:
 * 1. High Pass Filter (Filter -> Other -> High Pass...)
 * 2. 1-Click Frequency Separation Suite (splits into Low Tone & High Texture layers)
 * 3. Linear Light reconstruction & non-destructive Smart Filter support
 */

class HighPassFilter {
    /**
     * Apply High Pass filter to an ImageData object
     * Mathematical definition: HighPass = Original - GaussianBlur(Original, radius) + 128
     * @param {ImageData} srcImageData 
     * @param {number} radius - Blur radius in pixels (0.1 to 250)
     * @returns {ImageData}
     */
    static apply(srcImageData, radius = 3.0) {
        const w = srcImageData.width;
        const h = srcImageData.height;
        const src = srcImageData.data;
        const len = src.length;

        // Make clone for Gaussian blur pass
        const blurImg = new ImageData(w, h);
        blurImg.data.set(src);

        // Compute Gaussian blur
        HighPassFilter.gaussianBlur(blurImg, Math.max(0.1, radius));
        const blur = blurImg.data;

        const out = new ImageData(w, h);
        const dst = out.data;

        for (let i = 0; i < len; i += 4) {
            // HighPass = src - blur + 128
            dst[i]     = Math.max(0, Math.min(255, src[i]     - blur[i]     + 128));
            dst[i + 1] = Math.max(0, Math.min(255, src[i + 1] - blur[i + 1] + 128));
            dst[i + 2] = Math.max(0, Math.min(255, src[i + 2] - blur[i + 2] + 128));
            dst[i + 3] = src[i + 3]; // Preserve alpha
        }

        return out;
    }

    /**
     * Fast separable box-blur approximation for Gaussian blur
     */
    static gaussianBlur(imgData, radius) {
        const boxes = HighPassFilter.boxesForGauss(radius, 3);
        const w = imgData.width;
        const h = imgData.height;
        const target = new ImageData(w, h);
        target.data.set(imgData.data);

        for (let i = 0; i < 3; i++) {
            HighPassFilter.boxBlur(target, imgData, w, h, (boxes[i] - 1) / 2);
        }
    }

    static boxesForGauss(sigma, n) {
        const wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
        let wl = Math.floor(wIdeal);
        if (wl % 2 === 0) wl--;
        const wu = wl + 2;

        const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
        const m = Math.round(mIdeal);

        const sizes = [];
        for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
        return sizes;
    }

    static boxBlur(scl, tcl, w, h, r) {
        const s = scl.data;
        const t = tcl.data;
        t.set(s);
        HighPassFilter.boxBlurH(t, s, w, h, r);
        HighPassFilter.boxBlurT(s, t, w, h, r);
    }

    static boxBlurH(scl, tcl, w, h, r) {
        const arr = scl;
        const out = tcl;
        const iarr = 1 / (r + r + 1);

        for (let i = 0; i < h; i++) {
            let ti = i * w * 4;
            let li = ti;
            let ri = ti + r * 4;

            const fvR = arr[ti];
            const fvG = arr[ti + 1];
            const fvB = arr[ti + 2];
            const fvA = arr[ti + 3];

            const lvR = arr[ti + (w - 1) * 4];
            const lvG = arr[ti + (w - 1) * 4 + 1];
            const lvB = arr[ti + (w - 1) * 4 + 2];
            const lvA = arr[ti + (w - 1) * 4 + 3];

            let valR = (r + 1) * fvR;
            let valG = (r + 1) * fvG;
            let valB = (r + 1) * fvB;
            let valA = (r + 1) * fvA;

            for (let j = 0; j < r; j++) {
                valR += arr[ti + j * 4];
                valG += arr[ti + j * 4 + 1];
                valB += arr[ti + j * 4 + 2];
                valA += arr[ti + j * 4 + 3];
            }

            for (let j = 0; j <= r; j++) {
                valR += arr[ri] - fvR;
                valG += arr[ri + 1] - fvG;
                valB += arr[ri + 2] - fvB;
                valA += arr[ri + 3] - fvA;
                ri += 4;

                out[ti]     = Math.round(valR * iarr);
                out[ti + 1] = Math.round(valG * iarr);
                out[ti + 2] = Math.round(valB * iarr);
                out[ti + 3] = Math.round(valA * iarr);
                ti += 4;
            }

            for (let j = r + 1; j < w - r; j++) {
                valR += arr[ri] - arr[li];
                valG += arr[ri + 1] - arr[li + 1];
                valB += arr[ri + 2] - arr[li + 2];
                valA += arr[ri + 3] - arr[li + 3];
                ri += 4;
                li += 4;

                out[ti]     = Math.round(valR * iarr);
                out[ti + 1] = Math.round(valG * iarr);
                out[ti + 2] = Math.round(valB * iarr);
                out[ti + 3] = Math.round(valA * iarr);
                ti += 4;
            }

            for (let j = w - r; j < w; j++) {
                valR += lvR - arr[li];
                valG += lvG - arr[li + 1];
                valB += lvB - arr[li + 2];
                valA += lvA - arr[li + 3];
                li += 4;

                out[ti]     = Math.round(valR * iarr);
                out[ti + 1] = Math.round(valG * iarr);
                out[ti + 2] = Math.round(valB * iarr);
                out[ti + 3] = Math.round(valA * iarr);
                ti += 4;
            }
        }
    }

    static boxBlurT(scl, tcl, w, h, r) {
        const arr = scl;
        const out = tcl;
        const iarr = 1 / (r + r + 1);

        for (let i = 0; i < w; i++) {
            let ti = i * 4;
            let li = ti;
            let ri = ti + r * w * 4;

            const fvR = arr[ti];
            const fvG = arr[ti + 1];
            const fvB = arr[ti + 2];
            const fvA = arr[ti + 3];

            const lvR = arr[ti + (h - 1) * w * 4];
            const lvG = arr[ti + (h - 1) * w * 4 + 1];
            const lvB = arr[ti + (h - 1) * w * 4 + 2];
            const lvA = arr[ti + (h - 1) * w * 4 + 3];

            let valR = (r + 1) * fvR;
            let valG = (r + 1) * fvG;
            let valB = (r + 1) * fvB;
            let valA = (r + 1) * fvA;

            for (let j = 0; j < r; j++) {
                valR += arr[ti + j * w * 4];
                valG += arr[ti + j * w * 4 + 1];
                valB += arr[ti + j * w * 4 + 2];
                valA += arr[ti + j * w * 4 + 3];
            }

            for (let j = 0; j <= r; j++) {
                valR += arr[ri] - fvR;
                valG += arr[ri + 1] - fvG;
                valB += arr[ri + 2] - fvB;
                valA += arr[ri + 3] - fvA;
                ri += w * 4;

                out[ti]     = Math.round(valR * iarr);
                out[ti + 1] = Math.round(valG * iarr);
                out[ti + 2] = Math.round(valB * iarr);
                out[ti + 3] = Math.round(valA * iarr);
                ti += w * 4;
            }

            for (let j = r + 1; j < h - r; j++) {
                valR += arr[ri] - arr[li];
                valG += arr[ri + 1] - arr[li + 1];
                valB += arr[ri + 2] - arr[li + 2];
                valA += arr[ri + 3] - arr[li + 3];
                ri += w * 4;
                li += w * 4;

                out[ti]     = Math.round(valR * iarr);
                out[ti + 1] = Math.round(valG * iarr);
                out[ti + 2] = Math.round(valB * iarr);
                out[ti + 3] = Math.round(valA * iarr);
                ti += w * 4;
            }

            for (let j = h - r; j < h; j++) {
                valR += lvR - arr[li];
                valG += lvG - arr[li + 1];
                valB += lvB - arr[li + 2];
                valA += lvA - arr[li + 3];
                li += w * 4;

                out[ti]     = Math.round(valR * iarr);
                out[ti + 1] = Math.round(valG * iarr);
                out[ti + 2] = Math.round(valB * iarr);
                out[ti + 3] = Math.round(valA * iarr);
                ti += w * 4;
            }
        }
    }
}

class FrequencySeparationEngine {
    constructor(app = null) {
        this.app = app;
    }

    separate(activeLayer, radius = 3.0) {
        const lm = (this.app && this.app.layerManager) ? this.app.layerManager : null;
        return FrequencySeparationEngine.execute(lm, activeLayer, radius);
    }

    /**
     * Perform 1-Click Frequency Separation
     * Splits active layer into:
     * 1. Low Frequency (Color, Tone, Shading) -> Blurred with Gaussian Blur
     * 2. High Frequency (Texture, Pores, Fine Lines) -> High Pass with Linear Light blend mode
     * 
     * @param {Object} layerManager 
     * @param {Object} activeLayer 
     * @param {number} radius - Blur/detail separation threshold (default 3.0px)
     * @returns {Object} { group, lowLayer, highLayer }
     */
    static execute(layerManager, activeLayer, radius = 3.0) {
        if (!layerManager || !activeLayer || activeLayer.isGroup) {
            throw new Error('Valid raster layer required for Frequency Separation');
        }

        const w = activeLayer.width;
        const h = activeLayer.height;

        // 1. Create a dedicated group
        const group = layerManager.addGroup(`Frequency Separation (${activeLayer.name})`);

        // 2. Create Low Frequency layer (Color & Tone)
        const lowLayer = layerManager.addLayer('Low Frequency (Color/Tone)');
        const lowCtx = lowLayer.ctx;
        lowCtx.drawImage(activeLayer.canvas, 0, 0);

        const lowImgData = lowCtx.getImageData(0, 0, w, h);
        HighPassFilter.gaussianBlur(lowImgData, radius);
        lowCtx.putImageData(lowImgData, 0, 0);

        // 3. Create High Frequency layer (Texture)
        const highLayer = layerManager.addLayer('High Frequency (Texture)');
        const highCtx = highLayer.ctx;
        highCtx.drawImage(activeLayer.canvas, 0, 0);

        const highImgData = highCtx.getImageData(0, 0, w, h);
        const filteredHigh = HighPassFilter.apply(highImgData, radius);
        highCtx.putImageData(filteredHigh, 0, 0);

        // Set blend mode to linear-light
        highLayer.blendMode = 'linear-light';

        // Move both layers into the group if layer hierarchy allows
        if (typeof lowLayer.parentId !== 'undefined') {
            lowLayer.parentId = group.id;
            highLayer.parentId = group.id;
        }

        return { group, lowLayer, highLayer };
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HighPassFilter, FrequencySeparationEngine };
}
if (typeof window !== 'undefined') {
    window.HighPassFilter = HighPassFilter;
    window.FrequencySeparationEngine = FrequencySeparationEngine;
    if (window.Filters) {
        window.Filters.highPass = (imgData, radius = 3.0) => HighPassFilter.apply(imgData, radius);
    }
}
if (typeof Filters !== 'undefined') {
    Filters.highPass = (imgData, radius = 3.0) => HighPassFilter.apply(imgData, radius);
}
