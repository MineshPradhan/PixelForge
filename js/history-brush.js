/**
 * PixelForge Studio Pro - History Brush & Art History Brush Engine
 * Full Photoshop parity for:
 * 1. History Brush Tool (Y): Selectively paints pixels back from a chosen historical snapshot
 * 2. Art History Brush Tool: Paints impressionistic artistic strokes/daubs using historical color data
 * 3. History Snapshot source state tracking & subpixel brush deposition
 */

class HistoryBrushEngine {
    constructor(app = null) {
        this.app = app;
        this.sourceSnapshot = null; // ImageData or Canvas of historical state
        this.sourceName = 'Initial State';
        this.style = 'standard'; // 'standard', 'tight-short', 'tight-medium', 'loose-short', 'loose-medium', 'dab'
        this.area = 50; // stroke scatter/fidelity
        this.tolerance = 0;
    }

    setApp(app) {
        this.app = app;
    }

    /**
     * Set the historical source state for the history brush
     * @param {ImageData|HTMLCanvasElement} source 
     * @param {string} name 
     */
    setSource(source, name = 'Snapshot') {
        if (!source) return;
        this.sourceName = name;
        if (source instanceof ImageData) {
            this.sourceSnapshot = source;
        } else if (typeof document !== 'undefined' && source.getContext) {
            const ctx = source.getContext('2d');
            this.sourceSnapshot = ctx.getImageData(0, 0, source.width, source.height);
        }
    }

    /**
     * Acquire source from app's history manager snapshot
     */
    captureCurrentAsSnapshot(name = 'New Snapshot') {
        if (!this.app || !this.app.mainCanvas) return;
        const ctx = this.app.mainCtx;
        this.sourceSnapshot = ctx.getImageData(0, 0, this.app.width, this.app.height);
        this.sourceName = name;
        return this.sourceSnapshot;
    }

    /**
     * Paint with standard History Brush
     * Replaces target layer pixels at (x, y) with pixels from historical source snapshot
     * 
     * @param {CanvasRenderingContext2D} targetCtx 
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} size - Brush diameter
     * @param {number} hardness - 0.0 (soft) to 1.0 (hard)
     * @param {number} opacity - 0.0 to 1.0
     * @param {number} flow - 0.0 to 1.0
     */
    paintStroke(targetCtx, x, y, size = 30, hardness = 0.8, opacity = 1.0, flow = 1.0) {
        if (!this.sourceSnapshot || !targetCtx) return;

        const w = targetCtx.canvas.width;
        const h = targetCtx.canvas.height;
        const srcW = this.sourceSnapshot.width;
        const srcH = this.sourceSnapshot.height;
        const srcData = this.sourceSnapshot.data;

        const radius = Math.max(1, Math.round(size / 2));
        const minX = Math.max(0, Math.floor(x - radius));
        const maxX = Math.min(w - 1, Math.ceil(x + radius));
        const minY = Math.max(0, Math.floor(y - radius));
        const maxY = Math.min(h - 1, Math.ceil(y + radius));

        const patchW = maxX - minX + 1;
        const patchH = maxY - minY + 1;
        if (patchW <= 0 || patchH <= 0) return;

        const targetImgData = targetCtx.getImageData(minX, minY, patchW, patchH);
        const dst = targetImgData.data;

        const innerRadius = radius * Math.max(0, Math.min(1, hardness));
        const fadeDist = Math.max(0.1, radius - innerRadius);
        const effectiveAlpha = opacity * flow;

        for (let py = minY; py <= maxY; py++) {
            const dy = py - y;
            const dy2 = dy * dy;
            const patchRow = (py - minY) * patchW;

            for (let px = minX; px <= maxX; px++) {
                const dx = px - x;
                const dist = Math.sqrt(dx * dx + dy2);
                if (dist > radius) continue;

                // Radial falloff feathering
                let weight = 1.0;
                if (dist > innerRadius) {
                    weight = 1.0 - (dist - innerRadius) / fadeDist;
                }
                const blendAmount = weight * effectiveAlpha;
                if (blendAmount <= 0) continue;

                const patchIdx = (patchRow + (px - minX)) * 4;

                // Corresponding coordinate in history source
                const srcX = Math.max(0, Math.min(srcW - 1, px));
                const srcY = Math.max(0, Math.min(srcH - 1, py));
                const srcIdx = (srcY * srcW + srcX) * 4;

                // Blend historical pixel into active layer
                dst[patchIdx]     = Math.round(dst[patchIdx]     + (srcData[srcIdx]     - dst[patchIdx])     * blendAmount);
                dst[patchIdx + 1] = Math.round(dst[patchIdx + 1] + (srcData[srcIdx + 1] - dst[patchIdx + 1]) * blendAmount);
                dst[patchIdx + 2] = Math.round(dst[patchIdx + 2] + (srcData[srcIdx + 2] - dst[patchIdx + 2]) * blendAmount);
                dst[patchIdx + 3] = Math.round(dst[patchIdx + 3] + (srcData[srcIdx + 3] - dst[patchIdx + 3]) * blendAmount);
            }
        }

        targetCtx.putImageData(targetImgData, minX, minY);
    }

    /**
     * Paint with Art History Brush
     * Creates impressionist daubs using history colors
     */
    paintArtStroke(targetCtx, x, y, size = 30, style = 'tight-short', opacity = 0.8) {
        if (!this.sourceSnapshot || !targetCtx) return;

        const srcW = this.sourceSnapshot.width;
        const srcH = this.sourceSnapshot.height;
        const srcData = this.sourceSnapshot.data;

        // Sample color from historical source at (x, y)
        const sx = Math.max(0, Math.min(srcW - 1, Math.round(x)));
        const sy = Math.max(0, Math.min(srcH - 1, Math.round(y)));
        const sIdx = (sy * srcW + sx) * 4;

        const r = srcData[sIdx];
        const g = srcData[sIdx + 1];
        const b = srcData[sIdx + 2];
        const a = (srcData[sIdx + 3] / 255.0) * opacity;

        targetCtx.save();
        targetCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        targetCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        targetCtx.lineWidth = Math.max(2, size / 5);

        const angle = Math.random() * Math.PI * 2;
        const length = size * (style.includes('long') ? 1.5 : style.includes('short') ? 0.6 : 1.0);

        targetCtx.translate(x, y);
        targetCtx.rotate(angle);

        if (style === 'dab') {
            targetCtx.beginPath();
            targetCtx.arc(0, 0, size / 2, 0, Math.PI * 2);
            targetCtx.fill();
        } else if (style.includes('curl')) {
            targetCtx.beginPath();
            targetCtx.arc(length / 4, 0, length / 2, 0, Math.PI * 1.5);
            targetCtx.stroke();
        } else {
            // Brush stroke line daub
            targetCtx.beginPath();
            targetCtx.moveTo(-length / 2, 0);
            targetCtx.lineTo(length / 2, 0);
            targetCtx.stroke();
        }

        targetCtx.restore();
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HistoryBrushEngine };
}
if (typeof window !== 'undefined') {
    window.HistoryBrushEngine = HistoryBrushEngine;
}
