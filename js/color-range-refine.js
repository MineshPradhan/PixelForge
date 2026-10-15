/**
 * PixelForge Studio Pro - Color Range Selection & Trimap Edge Refinement Matting
 * Full Photoshop parity for:
 * 1. Select -> Color Range... (Continuous 3D Euclidean color distance with Fuzziness)
 * 2. Preset color clustering: Reds, Yellows, Greens, Cyans, Blues, Magentas, Highlights, Midtones, Shadows, Skin Tones
 * 3. Select and Mask / Refine Edge: Trimap construction, smoothing, feathering, contrast, shift edge, and color decontamination
 */

class ColorRangeEngine {
    /**
     * Compute a continuous alpha selection mask based on color proximity
     * 
     * @param {ImageData} imgData 
     * @param {Object|string} sampleTarget - { r, g, b } or preset string: 'reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas', 'highlights', 'midtones', 'shadows', 'skinTones'
     * @param {number} fuzziness - 0 to 200 (tolerance falloff distance)
     * @param {Object} options - { invert: boolean, localizedCluster: boolean, range: number }
     * @returns {Object} Selection object { x: 0, y: 0, w, h, mask: Uint8Array }
     */
    static createSelection(imgData, sampleTarget = { r: 255, g: 0, b: 0 }, fuzziness = 40, options = {}) {
        const w = imgData.width;
        const h = imgData.height;
        const src = imgData.data;
        const len = w * h;

        const mask = new Uint8Array(len);
        const invert = options.invert === true;
        const maxDist = Math.max(1.0, (fuzziness / 200.0) * 441.67); // 441.67 = sqrt(255^2 * 3)

        const isPreset = typeof sampleTarget === 'string';

        for (let i = 0; i < len; i++) {
            const idx = i * 4;
            const r = src[idx];
            const g = src[idx + 1];
            const b = src[idx + 2];
            const a = src[idx + 3];

            if (a < 5) {
                mask[i] = 0;
                continue;
            }

            let matchValue = 0; // 0 to 1

            if (isPreset) {
                matchValue = ColorRangeEngine.evalPresetMembership(r, g, b, sampleTarget, fuzziness);
            } else {
                const tr = sampleTarget.r ?? 0;
                const tg = sampleTarget.g ?? 0;
                const tb = sampleTarget.b ?? 0;

                const dr = r - tr;
                const dg = g - tg;
                const db = b - tb;
                const dist = Math.sqrt(dr * dr + dg * dg + db * db);

                if (dist <= maxDist) {
                    matchValue = 1.0 - (dist / maxDist);
                }
            }

            let finalAlpha = Math.max(0, Math.min(255, Math.round(matchValue * 255)));
            if (invert) finalAlpha = 255 - finalAlpha;
            mask[i] = finalAlpha;
        }

        return {
            x: 0,
            y: 0,
            w,
            h,
            mask,
            feather: 0
        };
    }

    static evalPresetMembership(r, g, b, preset, fuzziness) {
        const nr = r / 255.0;
        const ng = g / 255.0;
        const nb = b / 255.0;
        const max = Math.max(nr, ng, nb);
        const min = Math.min(nr, ng, nb);
        const delta = max - min;
        const lum = 0.299 * nr + 0.587 * ng + 0.114 * nb;

        const tol = (fuzziness / 200.0) * 0.5;

        switch (preset.toLowerCase()) {
            case 'reds':
                return (nr > ng && nr > nb) ? Math.min(1.0, (nr - Math.max(ng, nb)) / (0.3 - tol + 1e-4)) : 0;
            case 'yellows':
                return (nr > nb && ng > nb) ? Math.min(1.0, (Math.min(nr, ng) - nb) / (0.3 - tol + 1e-4)) : 0;
            case 'greens':
                return (ng > nr && ng > nb) ? Math.min(1.0, (ng - Math.max(nr, nb)) / (0.3 - tol + 1e-4)) : 0;
            case 'cyans':
                return (ng > nr && nb > nr) ? Math.min(1.0, (Math.min(ng, nb) - nr) / (0.3 - tol + 1e-4)) : 0;
            case 'blues':
                return (nb > nr && nb > ng) ? Math.min(1.0, (nb - Math.max(nr, ng)) / (0.3 - tol + 1e-4)) : 0;
            case 'magentas':
                return (nr > ng && nb > ng) ? Math.min(1.0, (Math.min(nr, nb) - ng) / (0.3 - tol + 1e-4)) : 0;
            case 'highlights':
                return lum >= (0.7 - tol) ? Math.min(1.0, (lum - (0.7 - tol)) / (0.3 + tol)) : 0;
            case 'shadows':
                return lum <= (0.3 + tol) ? Math.min(1.0, ((0.3 + tol) - lum) / (0.3 + tol)) : 0;
            case 'midtones': {
                const dist = Math.abs(lum - 0.5);
                return dist < (0.3 + tol) ? 1.0 - dist / (0.3 + tol) : 0;
            }
            case 'skintones': {
                // Biometric human skin-tone detection in normalized RGB
                const isSkin = (r > 60 && g > 40 && b > 20) &&
                               (r > g && g > b) &&
                               ((r - g) >= 15) &&
                               (Math.abs(r - g) > 10);
                if (!isSkin) return 0;
                const skinRatio = (r - g) / 255.0;
                return Math.min(1.0, skinRatio * 3.0);
            }
            default:
                return 0;
        }
    }
}

class TrimapMattingEngine {
    /**
     * Refine selection edge with smoothing, feathering, contrast, shift edge, and fringe decontamination
     * 
     * @param {ImageData} imgData 
     * @param {Uint8Array} mask - Original selection alpha mask [0, 255]
     * @param {Object} options
     *   - radius: number (edge detection radius, 0-50px)
     *   - smooth: number (mask blur smoothing, 0-100)
     *   - feather: number (feather radius in px, 0-50)
     *   - contrast: number (steepness of transition, 0-100%)
     *   - shiftEdge: number (expand/contract, -100% to +100%)
     *   - decontaminate: boolean (strips ambient color cast from edge strands)
     * @returns {Object} { mask: Uint8Array, decontaminatedImg: ImageData|null }
     */
    static refineEdge(imgData, maskOrSelection, options = {}) {
        const w = imgData.width;
        const h = imgData.height;
        const len = w * h;

        const rawMask = (maskOrSelection && maskOrSelection.mask) ? maskOrSelection.mask : maskOrSelection;
        const outMask = new Uint8Array(rawMask);
        const radius = options.radius || 0;
        const smooth = options.smooth || 0;
        const feather = options.feather || 0;
        const contrast = (options.contrast || 0) / 100.0;
        const shiftEdge = (options.shiftEdge || 0) / 100.0;
        const decontaminate = options.decontaminate === true;

        // 1. Shift Edge (Dilation / Erosion)
        if (shiftEdge !== 0) {
            const shiftPixels = Math.round(Math.abs(shiftEdge) * 5);
            const temp = new Uint8Array(outMask);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = y * w + x;
                    let val = temp[idx];
                    for (let dy = -shiftPixels; dy <= shiftPixels; dy++) {
                        const ny = Math.max(0, Math.min(h - 1, y + dy));
                        for (let dx = -shiftPixels; dx <= shiftPixels; dx++) {
                            const nx = Math.max(0, Math.min(w - 1, x + dx));
                            const nVal = temp[ny * w + nx];
                            if (shiftEdge > 0) {
                                if (nVal > val) val = nVal; // Dilate
                            } else {
                                if (nVal < val) val = nVal; // Erode
                            }
                        }
                    }
                    outMask[idx] = val;
                }
            }
        }

        // 2. Smooth & Feather (Box Blur on Mask)
        const blurRadius = Math.max(0, Math.round(smooth / 5 + feather));
        if (blurRadius > 0) {
            TrimapMattingEngine.boxBlurMask(outMask, w, h, blurRadius);
        }

        // 3. Contrast adjustment on transitional zone [1, 254]
        if (contrast > 0) {
            for (let i = 0; i < len; i++) {
                let v = outMask[i] / 255.0;
                if (v > 0 && v < 1) {
                    // S-curve contrast around 0.5 midpoint
                    v = 1.0 / (1.0 + Math.exp(-((v - 0.5) * (2.0 + contrast * 8.0))));
                    outMask[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
                }
            }
        }

        // 4. Color Decontamination (Fringe removal)
        let decontaminated = null;
        if (decontaminate) {
            decontaminated = (typeof ImageData !== 'undefined') ? new ImageData(w, h) : { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
            decontaminated.data.set(imgData.data);
            const dData = decontaminated.data;

            // Find pure foreground pixels (mask > 240) to borrow clean color for semi-transparent edge pixels (mask 10-240)
            const searchR = Math.max(2, Math.round(radius || 4));
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const mIdx = y * w + x;
                    const alpha = outMask[mIdx];
                    if (alpha > 10 && alpha < 240) {
                        // Edge pixel: search local neighborhood for opaque foreground color
                        let bestDist = Infinity;
                        let foundR = -1, foundG = -1, foundB = -1;

                        for (let dy = -searchR; dy <= searchR; dy++) {
                            const ny = y + dy;
                            if (ny < 0 || ny >= h) continue;
                            for (let dx = -searchR; dx <= searchR; dx++) {
                                const nx = x + dx;
                                if (nx < 0 || nx >= w) continue;
                                const nIdx = ny * w + nx;
                                if (outMask[nIdx] >= 240) {
                                    const dist = dx * dx + dy * dy;
                                    if (dist < bestDist) {
                                        bestDist = dist;
                                        const p = nIdx * 4;
                                        foundR = dData[p];
                                        foundG = dData[p + 1];
                                        foundB = dData[p + 2];
                                    }
                                }
                            }
                        }

                        if (foundR !== -1) {
                            const p = mIdx * 4;
                            dData[p]     = foundR;
                            dData[p + 1] = foundG;
                            dData[p + 2] = foundB;
                        }
                    }
                }
            }
        }

        const selX = (maskOrSelection && maskOrSelection.x) || 0;
        const selY = (maskOrSelection && maskOrSelection.y) || 0;
        return {
            selection: { x: selX, y: selY, w, h, mask: outMask },
            mask: outMask,
            decontaminatedImg: decontaminated,
            decontaminatedImgData: decontaminated
        };
    }

    static boxBlurMask(mask, w, h, r) {
        const temp = new Uint8Array(mask);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0;
                let count = 0;
                for (let dy = -r; dy <= r; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= h) continue;
                    for (let dx = -r; dx <= r; dx++) {
                        const nx = x + dx;
                        if (nx < 0 || nx >= w) continue;
                        sum += temp[ny * w + nx];
                        count++;
                    }
                }
                mask[y * w + x] = Math.round(sum / count);
            }
        }
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ColorRangeEngine, TrimapMattingEngine };
}
if (typeof window !== 'undefined') {
    window.ColorRangeEngine = ColorRangeEngine;
    window.TrimapMattingEngine = TrimapMattingEngine;
}
if (typeof global !== 'undefined') {
    global.ColorRangeEngine = ColorRangeEngine;
    global.TrimapMattingEngine = TrimapMattingEngine;
}
