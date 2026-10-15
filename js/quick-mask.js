/**
 * PixelForge Studio - Quick Mask Mode Engine
 * Allows editing active selections as a soft rubylith mask using regular brush/drawing tools.
 * Supports toggle with 'Q' shortcut, soft 8-bit edge feathering, and mask inversion.
 */

class QuickMaskEngine {
  constructor(app = null) {
    this.app = app;
    this.active = false;
    this.width = 0;
    this.height = 0;
    this.maskCanvas = null;
    this.maskCtx = null;
    this.rubylithColor = 'rgba(255, 0, 0, 0.5)';
    this.maskColorHex = '#ff0000';
    this.maskOpacity = 0.5;
    this.mode = 'masked'; // 'masked' = color indicates masked areas, 'selected' = color indicates selected areas
  }

  /**
   * Initializes or resizes the mask buffer
   */
  initBuffer(width, height) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    if (typeof document !== 'undefined') {
      if (!this.maskCanvas) {
        this.maskCanvas = document.createElement('canvas');
      }
      this.maskCanvas.width = this.width;
      this.maskCanvas.height = this.height;
      this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });
    } else {
      // Node.js test mock
      this.mockBuffer = new Uint8Array(this.width * this.height);
    }
  }

  /**
   * Enters Quick Mask mode from the current document selection
   */
  enter(currentSelection, docWidth, docHeight) {
    this.initBuffer(docWidth, docHeight);
    this.active = true;

    if (this.maskCtx) {
      this.maskCtx.clearRect(0, 0, this.width, this.height);
      // Fill entire buffer with white (255 = masked in standard rubylith)
      this.maskCtx.fillStyle = '#ffffff';
      this.maskCtx.fillRect(0, 0, this.width, this.height);

      if (currentSelection && currentSelection.active) {
        // Clear out the selected area (0 = unmasked/selected)
        this.maskCtx.globalCompositeOperation = 'destination-out';
        this.drawSelectionShape(this.maskCtx, currentSelection);
        this.maskCtx.globalCompositeOperation = 'source-over';
      }
    } else if (this.mockBuffer) {
      this.mockBuffer.fill(255);
      if (currentSelection && currentSelection.active) {
        this.mockClearSelection(currentSelection);
      }
    }

    return true;
  }

  /**
   * Draws selection geometry onto mask canvas
   */
  drawSelectionShape(ctx, sel) {
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    if (sel.type === 'ellipse') {
      ctx.ellipse(
        sel.x + sel.w / 2, sel.y + sel.h / 2,
        Math.abs(sel.w / 2), Math.abs(sel.h / 2),
        0, 0, Math.PI * 2
      );
      ctx.fill();
    } else if (sel.points && sel.points.length > 2) {
      ctx.moveTo(sel.points[0].x, sel.points[0].y);
      for (let i = 1; i < sel.points.length; i++) {
        ctx.lineTo(sel.points[i].x, sel.points[i].y);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(sel.x, sel.y, sel.w, sel.h);
    }
  }

  mockClearSelection(sel) {
    const minX = Math.max(0, Math.floor(sel.x));
    const minY = Math.max(0, Math.floor(sel.y));
    const maxX = Math.min(this.width, Math.ceil(sel.x + sel.w));
    const maxY = Math.min(this.height, Math.ceil(sel.y + sel.h));

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        this.mockBuffer[y * this.width + x] = 0;
      }
    }
  }

  /**
   * Exits Quick Mask mode and generates an 8-bit selection mask
   */
  exit() {
    if (!this.active) return null;
    this.active = false;

    let maskData = null;
    let minX = this.width, minY = this.height, maxX = 0, maxY = 0;
    let hasSelection = false;

    if (this.maskCtx) {
      const imgData = this.maskCtx.getImageData(0, 0, this.width, this.height);
      const data = imgData.data;
      maskData = new Uint8Array(this.width * this.height);

      for (let i = 0; i < maskData.length; i++) {
        const val = data[i * 4]; // Grayscale value (255 = masked, 0 = selected)
        // Selection strength is inverse of mask (255 - val)
        const selStrength = 255 - val;
        maskData[i] = selStrength;

        if (selStrength > 10) {
          hasSelection = true;
          const x = i % this.width;
          const y = Math.floor(i / this.width);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    } else if (this.mockBuffer) {
      maskData = new Uint8Array(this.width * this.height);
      for (let i = 0; i < maskData.length; i++) {
        const selStrength = 255 - this.mockBuffer[i];
        maskData[i] = selStrength;
        if (selStrength > 10) {
          hasSelection = true;
          const x = i % this.width;
          const y = Math.floor(i / this.width);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasSelection) {
      return { active: false, mask: null };
    }

    return {
      active: true,
      type: 'mask',
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
      mask: maskData,
      width: this.width,
      height: this.height
    };
  }

  /**
   * Paints directly onto the quick mask buffer
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Brush radius
   * @param {number} hardness - Brush hardness [0, 100]
   * @param {number} value - Gray value [0 = reveal/select, 255 = mask]
   * @param {number} opacity - Stroke opacity [0.0, 1.0]
   */
  paint(x, y, radius, hardness = 100, value = 0, opacity = 1.0) {
    if (!this.active) return;

    if (this.maskCtx) {
      const r = Math.max(1, radius);
      const grad = this.maskCtx.createRadialGradient(x, y, r * (hardness / 100), x, y, r);
      const v = Math.min(255, Math.max(0, Math.round(value)));
      const alpha = Math.min(1.0, Math.max(0.0, opacity));

      grad.addColorStop(0, `rgba(${v},${v},${v},${alpha})`);
      grad.addColorStop(1, `rgba(${v},${v},${v},0)`);

      this.maskCtx.save();
      this.maskCtx.fillStyle = grad;
      this.maskCtx.beginPath();
      this.maskCtx.arc(x, y, r, 0, Math.PI * 2);
      this.maskCtx.fill();
      this.maskCtx.restore();
    } else if (this.mockBuffer) {
      const r = Math.max(1, radius);
      const minX = Math.max(0, Math.floor(x - r));
      const maxX = Math.min(this.width, Math.ceil(x + r));
      const minY = Math.max(0, Math.floor(y - r));
      const maxY = Math.min(this.height, Math.ceil(y + r));

      for (let py = minY; py < maxY; py++) {
        for (let px = minX; px < maxX; px++) {
          const d = Math.hypot(px - x, py - y);
          if (d <= r) {
            const idx = py * this.width + px;
            this.mockBuffer[idx] = Math.round(this.mockBuffer[idx] * (1 - opacity) + value * opacity);
          }
        }
      }
    }
  }

  /**
   * Inverts the quick mask buffer
   */
  invert() {
    if (!this.active) return;
    if (this.maskCtx) {
      const imgData = this.maskCtx.getImageData(0, 0, this.width, this.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const inv = 255 - d[i];
        d[i] = inv;
        d[i + 1] = inv;
        d[i + 2] = inv;
      }
      this.maskCtx.putImageData(imgData, 0, 0);
    } else if (this.mockBuffer) {
      for (let i = 0; i < this.mockBuffer.length; i++) {
        this.mockBuffer[i] = 255 - this.mockBuffer[i];
      }
    }
  }

  /**
   * Renders the red rubylith tint onto the overlay canvas
   */
  renderRubylithOverlay(overlayCtx, zoom = 1, panX = 0, panY = 0) {
    if (!this.active || !this.maskCanvas || !overlayCtx) return;

    overlayCtx.save();
    overlayCtx.translate(panX, panY);
    overlayCtx.scale(zoom, zoom);

    // Create rubylith colored canvas overlay
    if (!this.rubylithCanvas) {
      this.rubylithCanvas = document.createElement('canvas');
    }
    if (this.rubylithCanvas.width !== this.width || this.rubylithCanvas.height !== this.height) {
      this.rubylithCanvas.width = this.width;
      this.rubylithCanvas.height = this.height;
    }
    const rCtx = this.rubylithCanvas.getContext('2d');
    rCtx.clearRect(0, 0, this.width, this.height);

    // Draw red color
    rCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    rCtx.fillRect(0, 0, this.width, this.height);

    // Mask with grayscale mask buffer
    rCtx.globalCompositeOperation = 'destination-in';
    rCtx.drawImage(this.maskCanvas, 0, 0);
    rCtx.globalCompositeOperation = 'source-over';

    // Draw rubylith onto overlay canvas
    overlayCtx.drawImage(this.rubylithCanvas, 0, 0);
    overlayCtx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QuickMaskEngine };
}
