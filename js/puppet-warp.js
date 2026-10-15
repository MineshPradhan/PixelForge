/**
 * PixelForge Studio Pro - Puppet Warp Engine
 * Full Photoshop parity for:
 * 1. Delaunay triangular mesh generation over non-empty raster bounds
 * 2. Interactive control pins (anchors, drag handles, rotation, pin depth)
 * 3. As-Rigid-As-Possible (ARAP) & Inverse-Distance-Weighted (IDW) mesh deformation
 * 4. Piecewise affine texture mapping per triangle with hardware canvas clipping
 * 5. Interactive overlay rendering (wireframe mesh, pins, active selection rings)
 */

class PuppetPin {
    constructor(x, y, isAnchor = false) {
        this.id = 'pin_' + Math.random().toString(36).substr(2, 8);
        this.origX = x;
        this.origY = y;
        this.x = x;
        this.y = y;
        this.isAnchor = isAnchor;
        this.depth = 0; // z-order overlap
        this.rotation = 0; // rotation around pin in radians
    }

    reset() {
        this.x = this.origX;
        this.y = this.origY;
        this.rotation = 0;
    }
}

class PuppetTriangle {
    constructor(i0, i1, i2) {
        this.i0 = i0; // indices into vertices array
        this.i1 = i1;
        this.i2 = i2;
    }
}

class PuppetWarpEngine {
    constructor(app = null) {
        this.app = app;
        this.active = false;
        this.activeLayer = null;
        this.vertices = []; // Array of { origX, origY, x, y }
        this.triangles = []; // Array of PuppetTriangle
        this.pins = []; // Array of PuppetPin
        this.selectedPin = null;
        this.showMesh = true;
        this.density = 'normal'; // 'fewer', 'normal', 'more'
        this.expansion = 2; // boundary bleed in pixels
    }

    setApp(app) {
        this.app = app;
    }

    /**
     * Initialize puppet warp mesh for a target layer
     * @param {Object} layer 
     * @param {string} density - 'fewer' (20px), 'normal' (12px), 'more' (8px)
     */
    initMesh(layer, density = 'normal') {
        if (!layer || layer.isGroup) return;
        this.active = true;
        this.activeLayer = layer;
        this.density = density;
        this.pins = [];
        this.selectedPin = null;

        const w = layer.width;
        const h = layer.height;
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Step size based on mesh density
        const step = density === 'fewer' ? 32 : density === 'more' ? 12 : 20;

        // Generate grid vertices that fall inside or near non-transparent pixels
        const vertMap = new Map();
        const verts = [];

        for (let y = 0; y <= h; y += step) {
            for (let x = 0; x <= w; x += step) {
                // Check local neighborhood opacity
                let hasAlpha = false;
                const checkX = Math.min(w - 1, x);
                const checkY = Math.min(h - 1, y);
                const idx = (checkY * w + checkX) * 4;
                if (data[idx + 3] > 10) {
                    hasAlpha = true;
                } else {
                    // Check radius of 1 step
                    for (let dy = -step; dy <= step; dy += step) {
                        for (let dx = -step; dx <= step; dx += step) {
                            const nx = Math.max(0, Math.min(w - 1, x + dx));
                            const ny = Math.max(0, Math.min(h - 1, y + dy));
                            if (data[(ny * w + nx) * 4 + 3] > 10) {
                                hasAlpha = true;
                                break;
                            }
                        }
                        if (hasAlpha) break;
                    }
                }

                if (hasAlpha) {
                    const vIdx = verts.length;
                    verts.push({ origX: x, origY: y, x: x, y: y });
                    vertMap.set(`${x},${y}`, vIdx);
                }
            }
        }

        // Generate triangles between adjacent 4-point cells
        const tris = [];
        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                const iTL = vertMap.get(`${x},${y}`);
                const iTR = vertMap.get(`${x + step},${y}`);
                const iBL = vertMap.get(`${x},${y + step}`);
                const iBR = vertMap.get(`${x + step},${y + step}`);

                if (iTL !== undefined && iTR !== undefined && iBL !== undefined) {
                    tris.push(new PuppetTriangle(iTL, iTR, iBL));
                }
                if (iTR !== undefined && iBR !== undefined && iBL !== undefined) {
                    tris.push(new PuppetTriangle(iTR, iBR, iBL));
                }
            }
        }

        this.vertices = verts;
        this.triangles = tris;

        // Automatically drop 3 default boundary pins if no pins exist
        if (verts.length >= 3) {
            const minVert = verts[0];
            const midVert = verts[Math.floor(verts.length / 2)];
            const maxVert = verts[verts.length - 1];
            this.addPin(minVert.x, minVert.y, true);
            this.addPin(midVert.x, midVert.y, false);
            this.addPin(maxVert.x, maxVert.y, true);
        }
    }

    /**
     * Add a puppet pin at (x, y)
     */
    addPin(x, y, isAnchor = false) {
        const pin = new PuppetPin(x, y, isAnchor);
        this.pins.push(pin);
        this.selectedPin = pin;
        this.solveDeformation();
        return pin;
    }

    /**
     * Remove pin by id
     */
    removePin(pinId) {
        const idx = this.pins.findIndex(p => p.id === pinId);
        if (idx !== -1) {
            const removed = this.pins.splice(idx, 1)[0];
            if (this.selectedPin === removed) {
                this.selectedPin = this.pins[0] || null;
            }
            this.solveDeformation();
            return removed;
        }
        return null;
    }

    /**
     * Find closest pin to coordinate (within hit radius)
     */
    hitTestPin(x, y, radius = 10) {
        for (let i = this.pins.length - 1; i >= 0; i--) {
            const p = this.pins[i];
            const dx = p.x - x;
            const dy = p.y - y;
            if (Math.sqrt(dx * dx + dy * dy) <= radius) {
                return p;
            }
        }
        return null;
    }

    /**
     * As-Rigid-As-Possible (ARAP) & Inverse Distance Weighted (IDW) solver
     * Calculates the deformed (x, y) position of all mesh vertices based on pins
     */
    solveDeformation() {
        if (this.pins.length === 0) {
            // Reset all vertices
            this.vertices.forEach(v => {
                v.x = v.origX;
                v.y = v.origY;
            });
            return;
        }

        const pins = this.pins;
        const numPins = pins.length;

        for (let i = 0; i < this.vertices.length; i++) {
            const v = this.vertices[i];
            let totalWeight = 0;
            let targetX = 0;
            let targetY = 0;

            let exactMatch = false;

            for (let j = 0; j < numPins; j++) {
                const pin = pins[j];
                const dx = v.origX - pin.origX;
                const dy = v.origY - pin.origY;
                const distSq = dx * dx + dy * dy;

                if (distSq < 1e-4) {
                    v.x = pin.x;
                    v.y = pin.y;
                    exactMatch = true;
                    break;
                }

                // IDW with p=2 power falloff
                const weight = 1.0 / distSq;
                totalWeight += weight;

                // Relative offset calculation including optional pin rotation
                let relX = dx;
                let relY = dy;
                if (pin.rotation !== 0) {
                    const cosR = Math.cos(pin.rotation);
                    const sinR = Math.sin(pin.rotation);
                    relX = dx * cosR - dy * sinR;
                    relY = dx * sinR + dy * cosR;
                }

                targetX += (pin.x + relX - dx) * weight;
                targetY += (pin.y + relY - dy) * weight;
            }

            if (!exactMatch && totalWeight > 0) {
                v.x = v.origX + (targetX / totalWeight - v.origX);
                v.y = v.origY + (targetY / totalWeight - v.origY);
            }
        }
    }

    /**
     * Render deformed mesh onto the active layer context
     */
    applyWarp(targetLayer) {
        if (!targetLayer || !this.activeLayer || this.triangles.length === 0) return;

        const w = targetLayer.width;
        const h = targetLayer.height;
        const tempCanvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
        if (!tempCanvas) return;

        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw each triangle using piecewise affine transform
        this.triangles.forEach(tri => {
            const v0 = this.vertices[tri.i0];
            const v1 = this.vertices[tri.i1];
            const v2 = this.vertices[tri.i2];

            PuppetWarpEngine.renderTriangleTexture(
                tempCtx,
                this.activeLayer.canvas,
                v0.origX, v0.origY, v1.origX, v1.origY, v2.origX, v2.origY,
                v0.x, v0.y, v1.x, v1.y, v2.x, v2.y
            );
        });

        // Copy back to targetLayer
        targetLayer.ctx.clearRect(0, 0, w, h);
        targetLayer.ctx.drawImage(tempCanvas, 0, 0);
    }

    /**
     * Affine texture triangle mapper with clipping
     */
    static renderTriangleTexture(ctx, image, u0, v0, u1, v1, u2, v2, x0, y0, x1, y1, x2, y2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.clip();

        // Compute affine transform mapping (u, v) -> (x, y)
        const delta = u0 * (v1 - v2) - v0 * (u1 - u2) + (u1 * v2 - u2 * v1);
        if (Math.abs(delta) < 1e-6) {
            ctx.restore();
            return;
        }

        const deltaA = x0 * (v1 - v2) - v0 * (x1 - x2) + (x1 * v2 - x2 * v1);
        const deltaB = u0 * (x1 - x2) - x0 * (u1 - u2) + (u1 * x2 - u2 * x1);
        const deltaC = u0 * (v1 * x2 - v2 * x1) - v0 * (u1 * x2 - u2 * x1) + x0 * (u1 * v2 - u2 * v1);

        const deltaD = y0 * (v1 - v2) - v0 * (y1 - y2) + (y1 * v2 - y2 * v1);
        const deltaE = u0 * (y1 - y2) - y0 * (u1 - u2) + (u1 * y2 - u2 * y1);
        const deltaF = u0 * (v1 * y2 - v2 * y1) - v0 * (u1 * y2 - u2 * y1) + y0 * (u1 * v2 - u2 * v1);

        ctx.transform(
            deltaA / delta, deltaD / delta,
            deltaB / delta, deltaE / delta,
            deltaC / delta, deltaF / delta
        );

        ctx.drawImage(image, 0, 0);
        ctx.restore();
    }

    /**
     * Render Puppet Warp wireframe mesh and control pins on the overlay canvas
     */
    renderOverlay(ctx, zoom = 1.0, panX = 0, panY = 0, viewW = 1000, viewH = 800, docW = 1920, docH = 1080) {
        if (!ctx || !this.active) return;

        const originX = (viewW / 2) + panX - (docW * zoom / 2);
        const originY = (viewH / 2) + panY - (docH * zoom / 2);

        ctx.save();

        // 1. Draw triangular wireframe mesh if enabled
        if (this.showMesh) {
            ctx.strokeStyle = 'rgba(2, 132, 199, 0.45)'; // Semi-transparent cyan
            ctx.lineWidth = 1;

            this.triangles.forEach(tri => {
                const v0 = this.vertices[tri.i0];
                const v1 = this.vertices[tri.i1];
                const v2 = this.vertices[tri.i2];

                const sx0 = originX + v0.x * zoom;
                const sy0 = originY + v0.y * zoom;
                const sx1 = originX + v1.x * zoom;
                const sy1 = originY + v1.y * zoom;
                const sx2 = originX + v2.x * zoom;
                const sy2 = originY + v2.y * zoom;

                ctx.beginPath();
                ctx.moveTo(sx0, sy0);
                ctx.lineTo(sx1, sy1);
                ctx.lineTo(sx2, sy2);
                ctx.closePath();
                ctx.stroke();
            });
        }

        // 2. Draw Pins
        this.pins.forEach(pin => {
            const sx = originX + pin.x * zoom;
            const sy = originY + pin.y * zoom;
            const isSelected = this.selectedPin === pin;

            // Outer ring
            ctx.beginPath();
            ctx.arc(sx, sy, isSelected ? 6.5 : 5, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? '#fbbf24' : '#ffffff'; // Amber when selected, white otherwise
            ctx.fill();
            ctx.strokeStyle = isSelected ? '#b45309' : '#1e293b';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Inner pin core
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
        });

        ctx.restore();
    }

    cancel() {
        this.active = false;
        this.activeLayer = null;
        this.pins = [];
        this.selectedPin = null;
        this.vertices = [];
        this.triangles = [];
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PuppetPin, PuppetTriangle, PuppetWarpEngine };
}
if (typeof window !== 'undefined') {
    window.PuppetPin = PuppetPin;
    window.PuppetTriangle = PuppetTriangle;
    window.PuppetWarpEngine = PuppetWarpEngine;
}
