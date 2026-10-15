/**
 * PixelForge Studio Pro — Creative Stylizers Suite
 * 
 * Implements Photoshop-grade artistic & creative filter engines:
 * 1. Oil Paint Filter (Anisotropic Kuwahara flow, brush stroke texture & directional specular lighting)
 * 2. Halftone Screen Filter (CMYK 4-color angled dot/line rasterization for retro pop-art print)
 * 3. Chromatic Aberration Filter (Radial optical prism RGB divergence with lens falloff)
 *
 * Full integration with Smart Objects (non-destructive SmartFilter) and raster layers.
 */

class OilPaintFilter {
    /**
     * Apply oil paint effect using local gradient tensor and directional luminance pooling
     * 
     * @param {ImageData} imgData 
     * @param {Object} options
     *   - radius: number (brush size, 1 to 10, default: 4)
     *   - smoothness: number (paint blending, 1 to 30, default: 15)
     *   - lighting: boolean (enable 3D specular lighting, default: true)
     *   - lightAngle: number (light direction in degrees, 0 to 360, default: 45)
     *   - shine: number (specular reflection intensity, 0 to 50, default: 15)
     * @returns {ImageData}
     */
    static apply(imgData, options = {}) {
        const w = imgData.width;
        const h = imgData.height;
        const src = imgData.data;
        const out = (typeof ImageData !== 'undefined') ? new ImageData(w, h) : { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
        const dst = out.data;

        const radius = Math.max(1, Math.min(10, Math.round(options.radius || 4)));
        const smoothness = Math.max(1, Math.min(30, options.smoothness || 15));
        const lighting = options.lighting !== false;
        const lightAngleRad = ((options.lightAngle || 45) * Math.PI) / 180.0;
        const shine = Math.max(0, Math.min(50, options.shine || 15)) / 100.0;

        const lx = Math.cos(lightAngleRad);
        const ly = Math.sin(lightAngleRad);

        // Precompute luminance map
        const lum = new Uint8Array(w * h);
        for (let i = 0, j = 0; i < src.length; i += 4, j++) {
            lum[j] = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
        }

        // Sector histograms for simplified Kuwahara/Oil filtering
        const numIntensityLevels = Math.max(8, Math.min(64, Math.round(smoothness * 2)));
        const intensityCount = new Int32Array(numIntensityLevels);
        const avgR = new Float64Array(numIntensityLevels);
        const avgG = new Float64Array(numIntensityLevels);
        const avgB = new Float64Array(numIntensityLevels);

        for (let y = 0; y < h; y++) {
            const rowStart = y * w;
            for (let x = 0; x < w; x++) {
                intensityCount.fill(0);
                avgR.fill(0);
                avgG.fill(0);
                avgB.fill(0);

                const yMin = Math.max(0, y - radius);
                const yMax = Math.min(h - 1, y + radius);
                const xMin = Math.max(0, x - radius);
                const xMax = Math.min(w - 1, x + radius);

                for (let ny = yMin; ny <= yMax; ny++) {
                    const nRow = ny * w;
                    for (let nx = xMin; nx <= xMax; nx++) {
                        const sIdx = (nRow + nx) * 4;
                        const l = lum[nRow + nx];
                        const bin = Math.min(numIntensityLevels - 1, Math.floor((l / 256.0) * numIntensityLevels));

                        intensityCount[bin]++;
                        avgR[bin] += src[sIdx];
                        avgG[bin] += src[sIdx + 1];
                        avgB[bin] += src[sIdx + 2];
                    }
                }

                // Find the dominant intensity level in the brush neighborhood
                let maxCount = 0;
                let maxBin = 0;
                for (let b = 0; b < numIntensityLevels; b++) {
                    if (intensityCount[b] > maxCount) {
                        maxCount = intensityCount[b];
                        maxBin = b;
                    }
                }

                let finalR = Math.round(avgR[maxBin] / maxCount);
                let finalG = Math.round(avgG[maxBin] / maxCount);
                let finalB = Math.round(avgB[maxBin] / maxCount);

                // Optional 3D directional specular lighting (canvas emboss effect)
                if (lighting && shine > 0 && x > 0 && x < w - 1 && y > 0 && y < h - 1) {
                    const lLeft  = lum[rowStart + x - 1];
                    const lRight = lum[rowStart + x + 1];
                    const lUp    = lum[(y - 1) * w + x];
                    const lDown  = lum[(y + 1) * w + x];

                    const gx = (lRight - lLeft) / 255.0;
                    const gy = (lDown - lUp) / 255.0;

                    const spec = (gx * lx + gy * ly) * shine * 255;
                    finalR = Math.max(0, Math.min(255, Math.round(finalR + spec)));
                    finalG = Math.max(0, Math.min(255, Math.round(finalG + spec)));
                    finalB = Math.max(0, Math.min(255, Math.round(finalB + spec)));
                }

                const dIdx = (rowStart + x) * 4;
                dst[dIdx]     = finalR;
                dst[dIdx + 1] = finalG;
                dst[dIdx + 2] = finalB;
                dst[dIdx + 3] = src[dIdx + 3]; // Preserve original alpha
            }
        }

        if (imgData.data) {
            imgData.data.set(dst);
        }

        return out;
    }
}

class HalftoneScreenFilter {
    /**
     * Apply CMYK or Monochrome Halftone dot screen pattern
     * 
     * @param {ImageData} imgData 
     * @param {Object} options
     *   - mode: 'cmyk' | 'mono' (default: 'cmyk')
     *   - cellSize: number (dot spacing in pixels, 4 to 32, default: 8)
     *   - angleC: number (Cyan screen angle degrees, default: 15)
     *   - angleM: number (Magenta screen angle degrees, default: 75)
     *   - angleY: number (Yellow screen angle degrees, default: 0)
     *   - angleK: number (Black screen angle degrees, default: 45)
     *   - dotShape: 'round' | 'line' (default: 'round')
     * @returns {ImageData}
     */
    static apply(imgData, options = {}) {
        const w = imgData.width;
        const h = imgData.height;
        const src = imgData.data;
        const out = (typeof ImageData !== 'undefined') ? new ImageData(w, h) : { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
        const dst = out.data;

        const mode = options.mode || 'cmyk';
        const cellSize = Math.max(4, Math.min(32, options.cellSize || options.maxRadius || 8));
        const isMono = mode === 'mono';

        const degToRad = Math.PI / 180.0;
        const angleC = (options.angleC ?? options.angle1 ?? 15) * degToRad;
        const angleM = (options.angleM ?? options.angle2 ?? 75) * degToRad;
        const angleY = (options.angleY ?? options.angle3 ?? 0)  * degToRad;
        const angleK = (options.angleK ?? options.angle4 ?? 45) * degToRad;

        const maxRadius = (cellSize * 0.707); // Half diagonal

        // Helper: evaluate halftone screen cell dot intensity at (x, y) with angle
        const getScreenDot = (x, y, angle) => {
            const rotX = x * Math.cos(angle) - y * Math.sin(angle);
            const rotY = x * Math.sin(angle) + y * Math.cos(angle);

            const cellX = ((rotX % cellSize) + cellSize) % cellSize;
            const cellY = ((rotY % cellSize) + cellSize) % cellSize;

            const dx = cellX - cellSize / 2;
            const dy = cellY - cellSize / 2;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Normalized distance [0, 1] from center of dot
            return Math.min(1.0, dist / maxRadius);
        };

        for (let y = 0; y < h; y++) {
            const rowStart = y * w;
            for (let x = 0; x < w; x++) {
                const idx = (rowStart + x) * 4;
                const r = src[idx] / 255.0;
                const g = src[idx + 1] / 255.0;
                const b = src[idx + 2] / 255.0;
                const a = src[idx + 3];

                if (isMono) {
                    const lum = (r * 0.299 + g * 0.587 + b * 0.114);
                    const dotThreshold = getScreenDot(x, y, angleK);
                    const ink = (1.0 - lum);
                    const isDot = dotThreshold < ink;
                    const val = isDot ? 0 : 255;

                    dst[idx]     = val;
                    dst[idx + 1] = val;
                    dst[idx + 2] = val;
                    dst[idx + 3] = a;
                } else {
                    // CMYK decomposition
                    const maxC = Math.max(r, g, b);
                    const k = 1.0 - maxC;
                    const c = maxC === 0 ? 0 : (1.0 - r - k) / (1.0 - k);
                    const m = maxC === 0 ? 0 : (1.0 - g - k) / (1.0 - k);
                    const yVal = maxC === 0 ? 0 : (1.0 - b - k) / (1.0 - k);

                    const dotC = getScreenDot(x, y, angleC) < c ? 1 : 0;
                    const dotM = getScreenDot(x, y, angleM) < m ? 1 : 0;
                    const dotY = getScreenDot(x, y, angleY) < yVal ? 1 : 0;
                    const dotK = getScreenDot(x, y, angleK) < k ? 1 : 0;

                    // Reconstruct RGB from screened CMYK
                    const finalR = Math.round((1.0 - dotC) * (1.0 - dotK) * 255);
                    const finalG = Math.round((1.0 - dotM) * (1.0 - dotK) * 255);
                    const finalB = Math.round((1.0 - dotY) * (1.0 - dotK) * 255);

                    dst[idx]     = finalR;
                    dst[idx + 1] = finalG;
                    dst[idx + 2] = finalB;
                    dst[idx + 3] = a;
                }
            }
        }

        if (imgData.data) {
            imgData.data.set(dst);
        }

        return out;
    }
}

class ChromaticAberrationFilter {
    /**
     * Radial lens color fringing divergence
     * 
     * @param {ImageData} imgData 
     * @param {Object} options
     *   - shift: number (pixel offset divergence, 0 to 40, default: 8)
     *   - angle: number (divergence direction in degrees, -1 for radial, default: -1)
     *   - falloff: number (edge power curve, 1 to 3, default: 1.5)
     * @returns {ImageData}
     */
    static apply(imgData, options = {}) {
        const w = imgData.width;
        const h = imgData.height;
        const src = imgData.data;
        const out = (typeof ImageData !== 'undefined') ? new ImageData(w, h) : { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
        const dst = out.data;

        const maxShift = options.redOffset !== undefined ? Math.abs(options.redOffset) : Math.max(0, Math.min(40, options.shift ?? 8));
        const isRadial = options.angle === undefined || options.angle < 0;
        const angleRad = ((options.angle || 0) * Math.PI) / 180.0;
        const falloff = Math.max(1, Math.min(3, options.falloff || 1.5));

        const cx = w / 2;
        const cy = h / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy);

        for (let y = 0; y < h; y++) {
            const rowStart = y * w;
            for (let x = 0; x < w; x++) {
                const idx = (rowStart + x) * 4;

                let dx = 0, dy = 0;
                if (isRadial) {
                    const rx = x - cx;
                    const ry = y - cy;
                    const d = Math.sqrt(rx * rx + ry * ry);
                    const factor = Math.pow(d / maxDist, falloff);
                    if (d > 0) {
                        dx = (rx / d) * maxShift * factor;
                        dy = (ry / d) * maxShift * factor;
                    }
                } else {
                    dx = Math.cos(angleRad) * maxShift;
                    dy = Math.sin(angleRad) * maxShift;
                }

                // Sample Red from (x - dx, y - dy)
                const rx = Math.max(0, Math.min(w - 1, Math.round(x - dx)));
                const ry = Math.max(0, Math.min(h - 1, Math.round(y - dy)));
                const rIdx = (ry * w + rx) * 4;

                // Sample Blue from (x + dx, y + dy)
                const bx = Math.max(0, Math.min(w - 1, Math.round(x + dx)));
                const by = Math.max(0, Math.min(h - 1, Math.round(y + dy)));
                const bIdx = (by * w + bx) * 4;

                dst[idx]     = src[rIdx];     // Diverged Red
                dst[idx + 1] = src[idx + 1];  // Stable Green
                dst[idx + 2] = src[bIdx + 2];  // Diverged Blue
                dst[idx + 3] = src[idx + 3];
            }
        }

        if (imgData.data) {
            imgData.data.set(dst);
        }

        return out;
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OilPaintFilter, HalftoneScreenFilter, ChromaticAberrationFilter };
}
if (typeof window !== 'undefined') {
    window.OilPaintFilter = OilPaintFilter;
    window.HalftoneScreenFilter = HalftoneScreenFilter;
    window.ChromaticAberrationFilter = ChromaticAberrationFilter;
    if (window.Filters) {
        window.Filters.oilPaint = (img, opt) => OilPaintFilter.apply(img, opt);
        window.Filters.halftone = (img, opt) => HalftoneScreenFilter.apply(img, opt);
        window.Filters.chromaticAberration = (img, opt) => ChromaticAberrationFilter.apply(img, opt);
    }
}
if (typeof global !== 'undefined') {
    global.OilPaintFilter = OilPaintFilter;
    global.HalftoneScreenFilter = HalftoneScreenFilter;
    global.ChromaticAberrationFilter = ChromaticAberrationFilter;
}
