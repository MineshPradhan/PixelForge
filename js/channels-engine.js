/**
 * PixelForge Studio Pro - Channels Palette & Alpha Channel Engine
 * Full Photoshop parity for:
 * 1. RGB, Red, Green, Blue channel isolation and grayscale visualization
 * 2. Custom Alpha channels creation, duplication, and storage
 * 3. Load Channel as Selection (Ctrl+Click on channel thumbnail)
 * 4. Save Selection as Channel
 * 5. Channel Calculations (Image -> Calculations...) with blend math
 */

class ChannelItem {
    constructor(id, name, type = 'alpha', data = null, width = 100, height = 100) {
        this.id = id || 'chan_' + Math.random().toString(36).substr(2, 8);
        this.name = name;
        this.type = type; // 'composite', 'red', 'green', 'blue', 'alpha'
        this.width = width;
        this.height = height;
        this.visible = true;
        // 8-bit grayscale intensity buffer [0 - 255]
        this.data = data || new Uint8ClampedArray(width * height);
    }

    clone() {
        const copyData = new Uint8ClampedArray(this.data);
        return new ChannelItem(null, this.name + ' Copy', this.type, copyData, this.width, this.height);
    }

    /**
     * Invert channel intensities (255 - value)
     */
    invert() {
        for (let i = 0; i < this.data.length; i++) {
            this.data[i] = 255 - this.data[i];
        }
    }

    /**
     * Render 2D thumbnail preview of channel onto a target canvas context
     */
    renderThumbnail(ctx, thumbW = 40, thumbH = 40) {
        if (!ctx) return;
        const tempCanvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
        if (!tempCanvas) return;
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');
        const imgData = tempCtx.createImageData(this.width, this.height);
        const d = imgData.data;

        for (let i = 0; i < this.data.length; i++) {
            const v = this.data[i];
            const idx = i * 4;
            d[idx] = v;
            d[idx + 1] = v;
            d[idx + 2] = v;
            d[idx + 3] = 255;
        }
        tempCtx.putImageData(imgData, 0, 0);

        ctx.clearRect(0, 0, thumbW, thumbH);
        ctx.drawImage(tempCanvas, 0, 0, thumbW, thumbH);
    }
}

class ChannelsEngine {
    constructor(app = null) {
        this.app = app;
        this.activeChannelId = 'rgb'; // 'rgb', 'red', 'green', 'blue', or alpha channel id
        this.alphaChannels = [];
    }

    get channels() {
        return this.getChannelList();
    }

    getChannelList() {
        const w = (this.app && this.app.width) ? this.app.width : 100;
        const h = (this.app && this.app.height) ? this.app.height : 100;
        return [
            new ChannelItem('rgb', 'RGB', 'composite', null, w, h),
            new ChannelItem('red', 'Red', 'red', null, w, h),
            new ChannelItem('green', 'Green', 'green', null, w, h),
            new ChannelItem('blue', 'Blue', 'blue', null, w, h),
            ...this.alphaChannels
        ];
    }

    createAlphaChannel(name = 'Alpha', fill = 0, width = null, height = null) {
        const w = width || ((this.app && this.app.width) ? this.app.width : 100);
        const h = height || ((this.app && this.app.height) ? this.app.height : 100);
        const data = new Uint8ClampedArray(w * h).fill(fill);
        const chan = new ChannelItem(null, name, 'alpha', data, w, h);
        this.alphaChannels.push(chan);
        return chan;
    }

    toggleChannelVisibility(channelId) {
        const chan = this.getChannelById(channelId);
        if (chan) {
            chan.visible = !chan.visible;
            return chan.visible;
        }
        return false;
    }

    setApp(app) {
        this.app = app;
    }

    /**
     * Extract standard RGB, Red, Green, and Blue channels from active layer or composite
     * @param {ImageData} imageData 
     * @returns {Object} { rChan, gChan, bChan }
     */
    static extractRgbChannels(imageData) {
        const w = imageData.width;
        const h = imageData.height;
        const d = imageData.data;
        const len = w * h;

        const rData = new Uint8ClampedArray(len);
        const gData = new Uint8ClampedArray(len);
        const bData = new Uint8ClampedArray(len);

        for (let i = 0; i < len; i++) {
            const idx = i * 4;
            rData[i] = d[idx];
            gData[i] = d[idx + 1];
            bData[i] = d[idx + 2];
        }

        return {
            red: new ChannelItem('red', 'Red', 'red', rData, w, h),
            green: new ChannelItem('green', 'Green', 'green', gData, w, h),
            blue: new ChannelItem('blue', 'Blue', 'blue', bData, w, h)
        };
    }

    /**
     * Create isolated channel view for display
     * @param {ImageData} srcImageData 
     * @param {string} channelMode - 'rgb', 'red', 'green', 'blue', or alpha channel id
     * @returns {ImageData}
     */
    processChannelView(srcImageData, channelMode = 'rgb') {
        if (!channelMode || channelMode === 'rgb') return srcImageData;

        const w = srcImageData.width;
        const h = srcImageData.height;
        const src = srcImageData.data;
        const out = new ImageData(w, h);
        const dst = out.data;
        const len = w * h;

        if (channelMode === 'red') {
            for (let i = 0; i < len; i++) {
                const idx = i * 4;
                const v = src[idx];
                dst[idx] = v; dst[idx + 1] = v; dst[idx + 2] = v; dst[idx + 3] = 255;
            }
        } else if (channelMode === 'green') {
            for (let i = 0; i < len; i++) {
                const idx = i * 4;
                const v = src[idx + 1];
                dst[idx] = v; dst[idx + 1] = v; dst[idx + 2] = v; dst[idx + 3] = 255;
            }
        } else if (channelMode === 'blue') {
            for (let i = 0; i < len; i++) {
                const idx = i * 4;
                const v = src[idx + 2];
                dst[idx] = v; dst[idx + 1] = v; dst[idx + 2] = v; dst[idx + 3] = 255;
            }
        } else {
            // Check alpha channels
            const alphaChan = this.alphaChannels.find(c => c.id === channelMode);
            if (alphaChan) {
                const aData = alphaChan.data;
                for (let i = 0; i < len; i++) {
                    const idx = i * 4;
                    const v = aData[i] || 0;
                    dst[idx] = v; dst[idx + 1] = v; dst[idx + 2] = v; dst[idx + 3] = 255;
                }
            } else {
                return srcImageData;
            }
        }

        return out;
    }

    /**
     * Convert an 8-bit channel to a selection mask
     * @param {ChannelItem|string} channelOrId 
     * @param {ImageData} currentImageData - fallback if standard R/G/B channel
     * @returns {Object} Selection object { x: 0, y: 0, w, h, mask: Uint8Array }
     */
    loadChannelAsSelection(channelOrId, currentImageData = null) {
        let channel = typeof channelOrId === 'string' ? this.getChannelById(channelOrId, currentImageData) : channelOrId;
        if (!channel) return null;

        const w = channel.width;
        const h = channel.height;
        const mask = new Uint8Array(w * h);

        for (let i = 0; i < w * h; i++) {
            mask[i] = channel.data[i];
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

    /**
     * Save current active selection as a new Alpha channel
     * @param {Object} selection - { x, y, w, h, mask }
     * @param {string} name 
     * @returns {ChannelItem}
     */
    saveSelectionAsAlpha(selection, name = null) {
        if (!selection || !selection.mask) return null;
        const docW = (this.app && this.app.width) ? this.app.width : (selection.w || 100);
        const docH = (this.app && this.app.height) ? this.app.height : (selection.h || 100);
        const count = this.alphaChannels.length + 1;
        const chanName = name || `Alpha ${count}`;

        const data = new Uint8ClampedArray(docW * docH);
        const selX = selection.x || 0;
        const selY = selection.y || 0;
        const selW = selection.w || docW;
        const selH = selection.h || docH;

        if (selW === docW && selH === docH && selX === 0 && selY === 0) {
            data.set(selection.mask);
        } else {
            for (let row = 0; row < selH; row++) {
                for (let col = 0; col < selW; col++) {
                    const targetY = selY + row;
                    const targetX = selX + col;
                    if (targetX >= 0 && targetX < docW && targetY >= 0 && targetY < docH) {
                        data[targetY * docW + targetX] = selection.mask[row * selW + col] || 0;
                    }
                }
            }
        }

        const chan = new ChannelItem(null, chanName, 'alpha', data, docW, docH);
        this.alphaChannels.push(chan);
        return chan;
    }

    /**
     * Instance calculation helper
     */
    calculate(chan1, chan2, blendMode = 'multiply', opacity = 1.0) {
        const c1 = typeof chan1 === 'string' ? this.getChannelById(chan1) : chan1;
        const c2 = typeof chan2 === 'string' ? this.getChannelById(chan2) : chan2;
        if (!c1 || !c2) return null;
        const res = ChannelsEngine.calculate(c1, c2, blendMode, opacity);
        this.alphaChannels.push(res);
        return res;
    }

    /**
     * Duplicate an existing channel
     */
    duplicateChannel(channelId, currentImageData = null) {
        const chan = this.getChannelById(channelId, currentImageData);
        if (!chan) return null;
        const dup = chan.clone();
        dup.id = 'chan_' + Math.random().toString(36).substr(2, 8);
        dup.type = 'alpha';
        this.alphaChannels.push(dup);
        return dup;
    }

    /**
     * Delete an alpha channel
     */
    deleteAlphaChannel(channelId) {
        const idx = this.alphaChannels.findIndex(c => c.id === channelId);
        if (idx !== -1) {
            const removed = this.alphaChannels.splice(idx, 1)[0];
            if (this.activeChannelId === channelId) {
                this.activeChannelId = 'rgb';
            }
            return removed;
        }
        return null;
    }

    getChannelById(id, currentImageData = null) {
        if (id === 'red' || id === 'green' || id === 'blue') {
            if (currentImageData) {
                const rgb = ChannelsEngine.extractRgbChannels(currentImageData);
                return rgb[id];
            }
            return null;
        }
        return this.alphaChannels.find(c => c.id === id) || null;
    }

    /**
     * Channel Calculations (Image -> Calculations...)
     * Blends channel 1 and channel 2 using standard blend mathematical formulas
     * @param {ChannelItem} chan1 
     * @param {ChannelItem} chan2 
     * @param {string} blendMode - 'multiply', 'screen', 'overlay', 'add', 'subtract', 'difference'
     * @param {number} opacity - 0.0 to 1.0
     * @returns {ChannelItem} Resulting calculation channel
     */
    static calculate(chan1, chan2, blendMode = 'multiply', opacity = 1.0) {
        const len = chan1.data.length;
        const outData = new Uint8ClampedArray(len);
        const c1 = chan1.data;
        const c2 = chan2.data;

        for (let i = 0; i < len; i++) {
            const a = c1[i];
            const b = c2[i];
            let blended = a;

            switch (blendMode) {
                case 'multiply':
                    blended = (a * b) / 255.0;
                    break;
                case 'screen':
                    blended = 255 - ((255 - a) * (255 - b)) / 255.0;
                    break;
                case 'overlay':
                    blended = a < 128
                        ? (2 * a * b) / 255.0
                        : 255 - (2 * (255 - a) * (255 - b)) / 255.0;
                    break;
                case 'add':
                    blended = Math.min(255, a + b);
                    break;
                case 'subtract':
                    blended = Math.max(0, a - b + 128);
                    break;
                case 'difference':
                    blended = Math.abs(a - b);
                    break;
                default:
                    blended = a;
            }

            outData[i] = Math.round(a + (blended - a) * opacity);
        }

        return new ChannelItem(null, `Calculation (${chan1.name} + ${chan2.name})`, 'alpha', outData, chan1.width, chan1.height);
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChannelItem, ChannelsEngine };
}
if (typeof window !== 'undefined') {
    window.ChannelItem = ChannelItem;
    window.ChannelsEngine = ChannelsEngine;
}
