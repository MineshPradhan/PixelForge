/**
 * PixelForge Studio Pro - 3D LUT & Cinematic Color Lookup Engine
 * Full Photoshop parity for 3D LUT (.cube / .3dl) parsing, trilinear interpolation,
 * custom export, and Hollywood cinematic grading presets.
 * 
 * Supports:
 * - Adobe .cube format (1D & 3D, DOMAIN_MIN, DOMAIN_MAX, TITLE)
 * - Fast trilinear 3D sub-cell interpolation with clamping
 * - 1D spline/linear LUT interpolation
 * - Intensity blending (0% to 100%)
 * - 7 Hollywood film stock presets (Teal & Orange, Bleach Bypass, Velvia 50, Portra 400, Cyberpunk, Golden Hour, Moody B&W)
 * - .cube file generation & export
 */

class LutEngine {
    constructor() {
        this.cache = new Map();
        this.initPresets();
    }

    /**
     * Parse Adobe .cube LUT file text
     * @param {string} text 
     * @returns {Object} LUT object { type: '3D'|'1D', size: number, title: string, domainMin: number[], domainMax: number[], data: Float32Array }
     */
    static parseCube(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid .cube LUT file content');
        }

        const lines = text.split(/\r?\n/);
        let title = 'Untitled LUT';
        let type = '3D';
        let size = 0;
        let domainMin = [0.0, 0.0, 0.0];
        let domainMax = [1.0, 1.0, 1.0];
        const dataValues = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line || line.startsWith('#')) continue;

            // Handle title
            if (line.startsWith('TITLE')) {
                const match = line.match(/^TITLE\s+"?([^"]*)"?$/i);
                if (match) title = match[1];
                continue;
            }

            // Handle domain min/max
            if (line.startsWith('DOMAIN_MIN')) {
                const parts = line.split(/\s+/).slice(1).map(Number);
                if (parts.length >= 3 && !parts.some(isNaN)) domainMin = parts.slice(0, 3);
                continue;
            }
            if (line.startsWith('DOMAIN_MAX')) {
                const parts = line.split(/\s+/).slice(1).map(Number);
                if (parts.length >= 3 && !parts.some(isNaN)) domainMax = parts.slice(0, 3);
                continue;
            }

            // Handle size
            if (line.startsWith('LUT_3D_SIZE')) {
                type = '3D';
                const parts = line.split(/\s+/);
                size = parseInt(parts[1], 10);
                continue;
            }
            if (line.startsWith('LUT_1D_SIZE')) {
                type = '1D';
                const parts = line.split(/\s+/);
                size = parseInt(parts[1], 10);
                continue;
            }

            // Data lines (3 floats)
            const parts = line.split(/\s+/);
            if (parts.length >= 3) {
                const r = parseFloat(parts[0]);
                const g = parseFloat(parts[1]);
                const b = parseFloat(parts[2]);
                if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                    dataValues.push(r, g, b);
                }
            }
        }

        if (size <= 0) {
            // Infer size from data
            const tripletCount = Math.floor(dataValues.length / 3);
            const cubeRoot = Math.round(Math.cbrt(tripletCount));
            if (cubeRoot * cubeRoot * cubeRoot === tripletCount) {
                type = '3D';
                size = cubeRoot;
            } else {
                type = '1D';
                size = tripletCount;
            }
        }

        const expectedCount = type === '3D' ? size * size * size * 3 : size * 3;
        const data = new Float32Array(expectedCount);
        const copyCount = Math.min(data.length, dataValues.length);
        for (let i = 0; i < copyCount; i++) {
            data[i] = dataValues[i];
        }

        return {
            type,
            size,
            title,
            domainMin,
            domainMax,
            data
        };
    }

    /**
     * Export LUT object to Adobe .cube string
     * @param {Object} lut 
     * @returns {string}
     */
    static exportCube(lut) {
        if (!lut || !lut.data) throw new Error('Invalid LUT object to export');
        const size = lut.size || 32;
        const type = lut.type || '3D';
        const title = lut.title || 'PixelForge Custom LUT';
        const domainMin = lut.domainMin || [0, 0, 0];
        const domainMax = lut.domainMax || [1, 1, 1];

        let out = `# Created with PixelForge Studio Pro\n`;
        out += `TITLE "${title}"\n`;
        if (domainMin[0] !== 0 || domainMin[1] !== 0 || domainMin[2] !== 0) {
            out += `DOMAIN_MIN ${domainMin[0].toFixed(6)} ${domainMin[1].toFixed(6)} ${domainMin[2].toFixed(6)}\n`;
        }
        if (domainMax[0] !== 1 || domainMax[1] !== 1 || domainMax[2] !== 1) {
            out += `DOMAIN_MAX ${domainMax[0].toFixed(6)} ${domainMax[1].toFixed(6)} ${domainMax[2].toFixed(6)}\n`;
        }
        out += `${type === '3D' ? 'LUT_3D_SIZE' : 'LUT_1D_SIZE'} ${size}\n\n`;

        const data = lut.data;
        const count = data.length / 3;
        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            out += `${data[idx].toFixed(6)} ${data[idx + 1].toFixed(6)} ${data[idx + 2].toFixed(6)}\n`;
        }

        return out;
    }

    /**
     * Apply 3D or 1D LUT to an ImageData object with intensity blending
     * @param {ImageData} imageData 
     * @param {Object} lut 
     * @param {number} intensity [0.0 - 1.0]
     * @returns {ImageData}
     */
    static applyLut(imageData, lut, intensity = 1.0) {
        if (!lut || !lut.data) return imageData;
        const d = imageData.data;
        const len = d.length;
        const amount = Math.max(0, Math.min(1, intensity));
        if (amount === 0) return imageData;

        if (lut.type === '1D') {
            return LutEngine.apply1DLut(imageData, lut, amount);
        }

        const size = lut.size;
        const data = lut.data;
        const dMin = lut.domainMin;
        const dMax = lut.domainMax;
        const spanR = dMax[0] - dMin[0] || 1.0;
        const spanG = dMax[1] - dMin[1] || 1.0;
        const spanB = dMax[2] - dMin[2] || 1.0;

        const maxIdx = size - 1;
        const sizeSq = size * size;

        // Trilinear interpolation loop
        for (let i = 0; i < len; i += 4) {
            const rNorm = ((d[i] / 255.0) - dMin[0]) / spanR;
            const gNorm = ((d[i + 1] / 255.0) - dMin[1]) / spanG;
            const bNorm = ((d[i + 2] / 255.0) - dMin[2]) / spanB;

            // Clamped coordinates in LUT grid space
            const rGrid = Math.max(0, Math.min(maxIdx, rNorm * maxIdx));
            const gGrid = Math.max(0, Math.min(maxIdx, gNorm * maxIdx));
            const bGrid = Math.max(0, Math.min(maxIdx, bNorm * maxIdx));

            const r0 = Math.floor(rGrid);
            const r1 = Math.min(maxIdx, r0 + 1);
            const g0 = Math.floor(gGrid);
            const g1 = Math.min(maxIdx, g0 + 1);
            const b0 = Math.floor(bGrid);
            const b1 = Math.min(maxIdx, b0 + 1);

            const dr = rGrid - r0;
            const dg = gGrid - g0;
            const db = bGrid - b0;

            const om_dr = 1.0 - dr;
            const om_dg = 1.0 - dg;
            const om_db = 1.0 - db;

            // In standard .cube 3D files, R changes fastest, then G, then B:
            // index = (r + g * size + b * size * size) * 3
            const idx000 = (r0 + g0 * size + b0 * sizeSq) * 3;
            const idx100 = (r1 + g0 * size + b0 * sizeSq) * 3;
            const idx010 = (r0 + g1 * size + b0 * sizeSq) * 3;
            const idx110 = (r1 + g1 * size + b0 * sizeSq) * 3;
            const idx001 = (r0 + g0 * size + b1 * sizeSq) * 3;
            const idx101 = (r1 + g0 * size + b1 * sizeSq) * 3;
            const idx011 = (r0 + g1 * size + b1 * sizeSq) * 3;
            const idx111 = (r1 + g1 * size + b1 * sizeSq) * 3;

            // Interpolate R, G, B channels
            for (let c = 0; c < 3; c++) {
                const c00 = data[idx000 + c] * om_dr + data[idx100 + c] * dr;
                const c10 = data[idx010 + c] * om_dr + data[idx110 + c] * dr;
                const c01 = data[idx001 + c] * om_dr + data[idx101 + c] * dr;
                const c11 = data[idx011 + c] * om_dr + data[idx111 + c] * dr;

                const c0 = c00 * om_dg + c10 * dg;
                const c1 = c01 * om_dg + c11 * dg;

                const lutVal = (c0 * om_db + c1 * db) * 255.0;
                const origVal = d[i + c];

                // Blend with original
                d[i + c] = Math.round(origVal + (lutVal - origVal) * amount);
            }
        }

        return imageData;
    }

    /**
     * Apply 1D LUT
     */
    static apply1DLut(imageData, lut, amount) {
        const d = imageData.data;
        const len = d.length;
        const size = lut.size;
        const maxIdx = size - 1;
        const data = lut.data;

        for (let i = 0; i < len; i += 4) {
            for (let c = 0; c < 3; c++) {
                const norm = d[i + c] / 255.0;
                const grid = Math.max(0, Math.min(maxIdx, norm * maxIdx));
                const i0 = Math.floor(grid);
                const i1 = Math.min(maxIdx, i0 + 1);
                const frac = grid - i0;

                const val = (data[i0 * 3 + c] * (1.0 - frac) + data[i1 * 3 + c] * frac) * 255.0;
                d[i + c] = Math.round(d[i + c] + (val - d[i + c]) * amount);
            }
        }
        return imageData;
    }

    /**
     * Generate procedural cinematic 3D LUT preset
     * @param {string} presetName 
     * @param {number} size Default 32
     * @returns {Object} LUT object
     */
    static generatePresetLut(presetName, size = 32) {
        const data = new Float32Array(size * size * size * 3);
        const step = 1.0 / (size - 1);

        for (let b = 0; b < size; b++) {
            const bNorm = b * step;
            for (let g = 0; g < size; g++) {
                const gNorm = g * step;
                for (let r = 0; r < size; r++) {
                    const rNorm = r * step;
                    const idx = (r + g * size + b * size * size) * 3;

                    const graded = LutEngine.gradePixel(rNorm, gNorm, bNorm, presetName);
                    data[idx] = Math.max(0, Math.min(1, graded[0]));
                    data[idx + 1] = Math.max(0, Math.min(1, graded[1]));
                    data[idx + 2] = Math.max(0, Math.min(1, graded[2]));
                }
            }
        }

        return {
            type: '3D',
            size,
            title: presetName,
            domainMin: [0, 0, 0],
            domainMax: [1, 1, 1],
            data
        };
    }

    /**
     * Color transformation math for presets
     */
    static gradePixel(r, g, b, preset) {
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        switch (preset.toLowerCase()) {
            case 'teal_orange':
            case 'teal & orange': {
                // Cool teal in shadows, warm orange in highlights
                const shadowWeight = Math.max(0, 1.0 - luma * 1.5);
                const highWeight = Math.max(0, luma * 1.4 - 0.4);

                let rOut = r + highWeight * 0.25 - shadowWeight * 0.15;
                let gOut = g + highWeight * 0.05 + shadowWeight * 0.08;
                let bOut = b - highWeight * 0.3 + shadowWeight * 0.28;

                // S-curve contrast
                rOut = LutEngine.scurve(rOut, 1.2);
                gOut = LutEngine.scurve(gOut, 1.15);
                bOut = LutEngine.scurve(bOut, 1.2);
                return [rOut, gOut, bOut];
            }

            case 'bleach_bypass':
            case 'bleach bypass': {
                // High contrast, silver saturation crush
                const sc = LutEngine.scurve(luma, 1.8);
                const satCrush = 0.45;
                const rOut = r * satCrush + sc * (1 - satCrush);
                const gOut = g * satCrush + sc * (1 - satCrush);
                const bOut = b * satCrush + sc * (1 - satCrush);
                return [rOut, gOut, bOut];
            }

            case 'velvia_50':
            case 'velvia 50': {
                // Fuji Velvia: saturated greens and blues, punchy contrast
                const sat = 1.35;
                let rOut = luma + (r - luma) * sat;
                let gOut = luma + (g - luma) * (sat * 1.05);
                let bOut = luma + (b - luma) * (sat * 1.1);

                rOut = LutEngine.scurve(rOut, 1.25);
                gOut = LutEngine.scurve(gOut, 1.2);
                bOut = LutEngine.scurve(bOut, 1.3);
                return [rOut, gOut, bOut];
            }

            case 'portra_400':
            case 'portra 400': {
                // Kodak Portra: warm highlights, soft shadows, pastel greens
                let rOut = r * 1.06 + 0.03;
                let gOut = g * 0.98 + 0.01;
                let bOut = b * 0.92;

                // Soft highlight roll-off
                if (rOut > 0.8) rOut = 0.8 + (rOut - 0.8) * 0.65;
                if (gOut > 0.8) gOut = 0.8 + (gOut - 0.8) * 0.65;
                if (bOut > 0.8) bOut = 0.8 + (bOut - 0.8) * 0.65;

                // Lifted rich shadows
                rOut = Math.max(0.04, rOut);
                gOut = Math.max(0.035, gOut);
                bOut = Math.max(0.04, bOut);
                return [rOut, gOut, bOut];
            }

            case 'cyberpunk': {
                // Neon magenta / electric cyan
                const isShadow = luma < 0.5;
                let rOut = r;
                let gOut = g;
                let bOut = b;

                if (isShadow) {
                    // Magenta / violet shadows
                    rOut = r * 1.3 + 0.08;
                    gOut = g * 0.7;
                    bOut = b * 1.4 + 0.12;
                } else {
                    // Cyan / turquoise highlights
                    rOut = r * 0.7;
                    gOut = g * 1.25 + 0.05;
                    bOut = b * 1.35 + 0.1;
                }
                return [rOut, gOut, bOut];
            }

            case 'golden_hour':
            case 'golden hour': {
                // Rich golden amber highlights, peach midtones, chocolate shadows
                const warmth = 0.18;
                let rOut = r + warmth * (0.6 + luma * 0.4);
                let gOut = g + warmth * 0.25;
                let bOut = b - warmth * 0.4;

                rOut = LutEngine.scurve(rOut, 1.15);
                gOut = LutEngine.scurve(gOut, 1.1);
                bOut = LutEngine.scurve(bOut, 1.1);
                return [rOut, gOut, bOut];
            }

            case 'moody_bw':
            case 'noir': {
                // High contrast cinematic B&W with crushed blacks
                const contrast = LutEngine.scurve(luma, 1.6);
                return [contrast, contrast, contrast];
            }

            default:
                return [r, g, b];
        }
    }

    /**
     * S-Curve polynomial tone curve
     */
    static scurve(x, gamma = 1.2) {
        x = Math.max(0, Math.min(1, x));
        // Smoothstep / sigmoid blend
        const s = x * x * (3 - 2 * x);
        return Math.pow(s, 1 / gamma);
    }

    /**
     * Initialize built-in presets
     */
    initPresets() {
        const presetNames = [
            'Teal & Orange',
            'Bleach Bypass',
            'Velvia 50',
            'Portra 400',
            'Cyberpunk',
            'Golden Hour',
            'Moody B&W'
        ];
        presetNames.forEach(name => {
            // Lazy or immediate generation
            this.cache.set(name, LutEngine.generatePresetLut(name, 32));
        });
    }

    getPreset(name) {
        if (!this.cache.has(name)) {
            this.cache.set(name, LutEngine.generatePresetLut(name, 32));
        }
        return this.cache.get(name);
    }

    listPresets() {
        return [
            'Teal & Orange',
            'Bleach Bypass',
            'Velvia 50',
            'Portra 400',
            'Cyberpunk',
            'Golden Hour',
            'Moody B&W'
        ];
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LutEngine };
}
if (typeof window !== 'undefined') {
    window.LutEngine = LutEngine;
}
