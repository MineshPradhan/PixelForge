/**
 * PixelForge Studio Pro - Displacement Map Filter & Vanishing Point 3D Perspective Plane Engine
 * Full Photoshop parity for:
 * 1. Filter -> Distort -> Displace... (Texture surface wrapping via external/internal displacement map)
 * 2. Filter -> Vanishing Point... (Interactive 4-point 3D perspective plane definition, horizon grid, & perspective stamping)
 */

class DisplacementFilter {
    /**
     * Distort target image using a secondary displacement map
     * 
     * @param {ImageData} targetImg - Image to be distorted
     * @param {ImageData|HTMLCanvasElement} map - Displacement map (Red channel = X shift, Green channel = Y shift)
     * @param {number} scaleX - Horizontal displacement magnitude (-100 to 100)
     * @param {number} scaleY - Vertical displacement magnitude (-100 to 100)
     * @param {string} undefinedMode - 'wrapAround' | 'repeatEdge'
     * @returns {ImageData}
     */
    static apply(targetImg, map, scaleX = 10, scaleY = 10, undefinedMode = 'wrapAround') {
        const w = targetImg.width;
        const h = targetImg.height;
        const src = targetImg.data;

        let mapData = null;
        let mapW = w;
        let mapH = h;

        if (map && map.data) {
            mapData = map.data;
            mapW = map.width;
            mapH = map.height;
        } else if (map && typeof map.getContext === 'function') {
            const mCtx = map.getContext('2d');
            const mImg = mCtx.getImageData(0, 0, map.width, map.height);
            mapData = mImg.data;
            mapW = mImg.width;
            mapH = mImg.height;
        }

        const out = (typeof ImageData !== 'undefined') ? new ImageData(w, h) : { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
        const dst = out.data;

        const isWrap = undefinedMode === 'wrapAround';

        for (let y = 0; y < h; y++) {
            const mapY = Math.min(mapH - 1, Math.floor((y / h) * mapH));
            const targetRow = y * w;

            for (let x = 0; x < w; x++) {
                const mapX = Math.min(mapW - 1, Math.floor((x / w) * mapW));
                const mapIdx = (mapY * mapW + mapX) * 4;

                let shiftX = 0;
                let shiftY = 0;

                if (mapData) {
                    // Red channel = horizontal shift, Green channel = vertical shift (neutral 128)
                    const r = mapData[mapIdx];
                    const g = mapData[mapIdx + 1];
                    shiftX = ((r - 128) / 128.0) * scaleX;
                    shiftY = ((g - 128) / 128.0) * scaleY;
                }

                let srcX = x + shiftX;
                let srcY = y + shiftY;

                // Handle boundary conditions
                if (isWrap) {
                    srcX = ((srcX % w) + w) % w;
                    srcY = ((srcY % h) + h) % h;
                } else {
                    srcX = Math.max(0, Math.min(w - 1, srcX));
                    srcY = Math.max(0, Math.min(h - 1, srcY));
                }

                // Bilinear subpixel interpolation
                const x0 = Math.floor(srcX);
                const x1 = Math.min(w - 1, x0 + 1);
                const y0 = Math.floor(srcY);
                const y1 = Math.min(h - 1, y0 + 1);

                const fx = srcX - x0;
                const fy = srcY - y0;
                const wTL = (1 - fx) * (1 - fy);
                const wTR = fx * (1 - fy);
                const wBL = (1 - fx) * fy;
                const wBR = fx * fy;

                const iTL = (y0 * w + x0) * 4;
                const iTR = (y0 * w + x1) * 4;
                const iBL = (y1 * w + x0) * 4;
                const iBR = (y1 * w + x1) * 4;

                const dstIdx = (targetRow + x) * 4;

                dst[dstIdx]     = Math.round(src[iTL] * wTL + src[iTR] * wTR + src[iBL] * wBL + src[iBR] * wBR);
                dst[dstIdx + 1] = Math.round(src[iTL + 1] * wTL + src[iTR + 1] * wTR + src[iBL + 1] * wBL + src[iBR + 1] * wBR);
                dst[dstIdx + 2] = Math.round(src[iTL + 2] * wTL + src[iTR + 2] * wTR + src[iBL + 2] * wBL + src[iBR + 2] * wBR);
                dst[dstIdx + 3] = Math.round(src[iTL + 3] * wTL + src[iTR + 3] * wTR + src[iBL + 3] * wBL + src[iBR + 3] * wBR);
            }
        }

        return out;
    }
}

class VanishingPlane {
    constructor(id = null) {
        this.id = id || 'plane_' + Math.random().toString(36).substr(2, 8);
        // 4 corner control vertices in 2D space: Top-Left, Top-Right, Bottom-Right, Bottom-Left
        this.corners = [
            { x: 100, y: 100 },
            { x: 300, y: 120 },
            { x: 320, y: 350 },
            { x: 80,  y: 300 }
        ];
        this.gridDivisions = 8;
        this.active = true;
    }

    /**
     * Compute homography matrix mapping unit square [0,1]^2 to 4 plane corners
     */
    getHomography() {
        const [p0, p1, p2, p3] = this.corners;
        // Map from (0,0)->p0, (1,0)->p1, (1,1)->p2, (0,1)->p3
        const dx1 = p1.x - p2.x;
        const dx2 = p3.x - p2.x;
        const sumX = p0.x - p1.x + p2.x - p3.x;

        const dy1 = p1.y - p2.y;
        const dy2 = p3.y - p2.y;
        const sumY = p0.y - p1.y + p2.y - p3.y;

        let g = 0, h = 0;
        const det = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(det) > 1e-6) {
            g = (sumX * dy2 - sumY * dx2) / det;
            h = (dx1 * sumY - dy1 * sumX) / det;
        }

        const a = p1.x - p0.x + g * p1.x;
        const b = p3.x - p0.x + h * p3.x;
        const c = p0.x;

        const d = p1.y - p0.y + g * p1.y;
        const e = p3.y - p0.y + h * p3.y;
        const f = p0.y;

        return { a, b, c, d, e, f, g, h, i: 1.0 };
    }

    /**
     * Map a normalized plane coordinate (u, v) in [0, 1] to canvas (x, y)
     */
    mapPoint(u, v) {
        const H = this.getHomography();
        const denom = H.g * u + H.h * v + H.i;
        const x = (H.a * u + H.b * v + H.c) / denom;
        const y = (H.d * u + H.e * v + H.f) / denom;
        return { x, y };
    }
}

class VanishingPointEngine {
    constructor(app = null) {
        this.app = app;
        this.planes = [];
        this.activePlane = null;
        this.active = false;
        this.selectedCornerIdx = -1;
    }

    setApp(app) {
        this.app = app;
    }

    createPlane(corners = null) {
        const plane = new VanishingPlane();
        if (corners && corners.length === 4) {
            plane.corners = corners.map(c => ({ x: c.x, y: c.y }));
        }
        this.planes.push(plane);
        this.activePlane = plane;
        return plane;
    }

    /**
     * Render perspective grid overlay
     */
    renderOverlay(ctx, zoom = 1.0, panX = 0, panY = 0, viewW = 1000, viewH = 800, docW = 1920, docH = 1080) {
        if (!ctx || !this.active || !this.activePlane) return;

        const originX = (viewW / 2) + panX - (docW * zoom / 2);
        const originY = (viewH / 2) + panY - (docH * zoom / 2);

        ctx.save();
        const plane = this.activePlane;
        const divs = plane.gridDivisions || 8;

        // 1. Draw 3D Perspective Grid
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)'; // Electric cyan
        ctx.lineWidth = 1;

        // U grid lines
        for (let u = 0; u <= divs; u++) {
            const frac = u / divs;
            const pStart = plane.mapPoint(frac, 0);
            const pEnd   = plane.mapPoint(frac, 1);

            ctx.beginPath();
            ctx.moveTo(originX + pStart.x * zoom, originY + pStart.y * zoom);
            ctx.lineTo(originX + pEnd.x * zoom, originY + pEnd.y * zoom);
            ctx.stroke();
        }

        // V grid lines
        for (let v = 0; v <= divs; v++) {
            const frac = v / divs;
            const pStart = plane.mapPoint(0, frac);
            const pEnd   = plane.mapPoint(1, frac);

            ctx.beginPath();
            ctx.moveTo(originX + pStart.x * zoom, originY + pStart.y * zoom);
            ctx.lineTo(originX + pEnd.x * zoom, originY + pEnd.y * zoom);
            ctx.stroke();
        }

        // 2. Draw 4 Corner Handles
        plane.corners.forEach((pt, idx) => {
            const sx = originX + pt.x * zoom;
            const sy = originY + pt.y * zoom;

            ctx.beginPath();
            ctx.arc(sx, sy, idx === this.selectedCornerIdx ? 7 : 5, 0, Math.PI * 2);
            ctx.fillStyle = idx === this.selectedCornerIdx ? '#fbbf24' : '#38bdf8';
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        ctx.restore();
    }

    /**
     * Warp texture onto vanishing plane
     */
    warpTextureToPlane(sourceCanvas, targetCtx, plane = null) {
        const p = plane || this.activePlane;
        if (!p || !sourceCanvas || !targetCtx) return;

        const srcW = sourceCanvas.width;
        const srcH = sourceCanvas.height;

        // Render as two triangles (TL-TR-BL and TR-BR-BL)
        const [p0, p1, p2, p3] = p.corners;
        const sCtx = sourceCanvas.getContext('2d');
        const srcImg = sCtx.getImageData(0, 0, srcW, srcH);

        const tempCanvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
        if (!tempCanvas) return;
        tempCanvas.width = targetCtx.canvas.width;
        tempCanvas.height = targetCtx.canvas.height;
        const tCtx = tempCanvas.getContext('2d');

        // Render 2 triangle affine patches
        if (typeof PuppetWarpEngine !== 'undefined') {
            PuppetWarpEngine.renderTriangleTexture(
                tCtx, sourceCanvas,
                0, 0, srcW, 0, 0, srcH,
                p0.x, p0.y, p1.x, p1.y, p3.x, p3.y
            );
            PuppetWarpEngine.renderTriangleTexture(
                tCtx, sourceCanvas,
                srcW, 0, srcW, srcH, 0, srcH,
                p1.x, p1.y, p2.x, p2.y, p3.x, p3.y
            );
        }

        targetCtx.drawImage(tempCanvas, 0, 0);
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DisplacementFilter, VanishingPlane, VanishingPointEngine };
}
if (typeof window !== 'undefined') {
    window.DisplacementFilter = DisplacementFilter;
    window.VanishingPlane = VanishingPlane;
    window.VanishingPointEngine = VanishingPointEngine;
    if (window.Filters) {
        window.Filters.displace = (imgData, map, sx, sy, mode) => DisplacementFilter.apply(imgData, map, sx, sy, mode);
    }
}
if (typeof global !== 'undefined') {
    global.DisplacementFilter = DisplacementFilter;
    global.VanishingPlane = VanishingPlane;
    global.VanishingPointEngine = VanishingPointEngine;
}
if (typeof Filters !== 'undefined') {
    Filters.displace = (imgData, map, sx, sy, mode) => DisplacementFilter.apply(imgData, map, sx, sy, mode);
}
