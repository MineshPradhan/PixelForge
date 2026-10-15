/**
 * PixelForge Studio Pro — Radiance HDR (.hdr) Binary Codec
 *
 * Implements 32-bit floating point image exchange for 3D CGI, VFX, and HDR grading:
 * 1. Binary Parser: Decodes Radiance RGBE (#?RADIANCE / 32-bit_rle_rgbe) files into HDRBuffer
 * 2. Binary Encoder: Encodes HDRBuffer (linear float) into standard RLE-compressed .hdr binary files
 * 3. Full interoperability with HDREngine (ACES Filmic tone mapping) and 32-bit canvas workflows
 */

class RadianceHdrCodec {
    /**
     * Decode a binary Radiance .hdr file (ArrayBuffer or Uint8Array) into an HDRBuffer
     * 
     * @param {ArrayBuffer|Uint8Array} buffer 
     * @returns {HDRBuffer}
     */
    static decode(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        let pos = 0;

        // 1. Parse ASCII header lines
        const readLine = () => {
            let line = '';
            while (pos < bytes.length) {
                const c = bytes[pos++];
                if (c === 10) break; // '\n'
                if (c !== 13) line += String.fromCharCode(c); // Ignore '\r'
            }
            return line;
        };

        const firstLine = readLine();
        if (!firstLine.startsWith('#?RADIANCE') && !firstLine.startsWith('#?RGBE')) {
            throw new Error('Invalid Radiance HDR file: missing #?RADIANCE signature.');
        }

        let isFormatValid = false;
        let line = '';
        while (pos < bytes.length) {
            line = readLine();
            if (line === '') break; // Empty line signals end of header attributes
            if (line.startsWith('FORMAT=')) {
                const fmt = line.split('=')[1].trim();
                if (fmt === '32-bit_rle_rgbe' || fmt === '32-bit_rgbe') {
                    isFormatValid = true;
                }
            }
        }

        // 2. Parse Resolution String (e.g., "-Y 512 +X 1024")
        const resLine = readLine();
        const resMatch = resLine.match(/([+-][XY])\s+(\d+)\s+([+-][XY])\s+(\d+)/);
        if (!resMatch) {
            throw new Error('Invalid Radiance HDR resolution line: ' + resLine);
        }

        let width = 0, height = 0;
        if (resMatch[1] === '-Y' && resMatch[3] === '+X') {
            height = parseInt(resMatch[2], 10);
            width = parseInt(resMatch[4], 10);
        } else {
            // Fallback orientation
            height = parseInt(resMatch[2], 10);
            width = parseInt(resMatch[4], 10);
        }

        if (width <= 0 || height <= 0 || width > 16384 || height > 16384) {
            throw new Error(`Invalid HDR dimensions: ${width}x${height}`);
        }

        // 3. Instantiate HDRBuffer (from global or required)
        const HdrClass = (typeof HDRBuffer !== 'undefined') ? HDRBuffer : class {
            constructor(w, h) { this.width = w; this.height = h; this.data = new Float32Array(w * h * 4); }
        };
        const hdr = new HdrClass(width, height);
        const data = hdr.data;

        // 4. Decode scanlines
        const scanline = new Uint8Array(width * 4);

        for (let y = 0; y < height; y++) {
            if (pos >= bytes.length) break;

            // Check for new RLE format signature: [2, 2, (w >> 8), (w & 0xFF)]
            const b0 = bytes[pos];
            const b1 = bytes[pos + 1];
            const b2 = bytes[pos + 2];
            const b3 = bytes[pos + 3];

            if (b0 === 2 && b1 === 2 && ((b2 << 8) | b3) === width) {
                // Adaptive RLE scanline
                pos += 4;
                for (let ch = 0; ch < 4; ch++) {
                    let x = 0;
                    while (x < width && pos < bytes.length) {
                        const count = bytes[pos++];
                        if (count > 128) {
                            // Run of identical values
                            const runLen = count - 128;
                            const val = bytes[pos++];
                            for (let r = 0; r < runLen && x < width; r++) {
                                scanline[ch * width + x++] = val;
                            }
                        } else {
                            // Non-run literal values
                            for (let r = 0; r < count && x < width && pos < bytes.length; r++) {
                                scanline[ch * width + x++] = bytes[pos++];
                            }
                        }
                    }
                }

                // Convert RGBE to float
                const rowStart = y * width * 4;
                for (let x = 0; x < width; x++) {
                    const r = scanline[0 * width + x];
                    const g = scanline[1 * width + x];
                    const b = scanline[2 * width + x];
                    const e = scanline[3 * width + x];

                    const dIdx = rowStart + x * 4;
                    if (e === 0) {
                        data[dIdx] = 0.0;
                        data[dIdx + 1] = 0.0;
                        data[dIdx + 2] = 0.0;
                    } else {
                        const f = Math.pow(2.0, e - 136.0); // 128 + 8 = 136
                        data[dIdx]     = r * f;
                        data[dIdx + 1] = g * f;
                        data[dIdx + 2] = b * f;
                    }
                    data[dIdx + 3] = 1.0; // Alpha
                }
            } else {
                // Legacy uncompressed scanline (4 bytes per pixel directly)
                const rowStart = y * width * 4;
                for (let x = 0; x < width; x++) {
                    const r = bytes[pos++];
                    const g = bytes[pos++];
                    const b = bytes[pos++];
                    const e = bytes[pos++];

                    const dIdx = rowStart + x * 4;
                    if (e === 0) {
                        data[dIdx] = 0.0;
                        data[dIdx + 1] = 0.0;
                        data[dIdx + 2] = 0.0;
                    } else {
                        const f = Math.pow(2.0, e - 136.0);
                        data[dIdx]     = r * f;
                        data[dIdx + 1] = g * f;
                        data[dIdx + 2] = b * f;
                    }
                    data[dIdx + 3] = 1.0;
                }
            }
        }

        return hdr;
    }

    /**
     * Encode an HDRBuffer into a binary Radiance .hdr file (Uint8Array)
     * 
     * @param {HDRBuffer} hdrBuffer 
     * @returns {Uint8Array}
     */
    static encode(hdrBuffer) {
        const w = hdrBuffer.width;
        const h = hdrBuffer.height;
        const src = hdrBuffer.data;

        // 1. Build ASCII Header
        const headerStr = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\nEXPOSURE=1.0\n\n-Y ${h} +X ${w}\n`;
        const headerBytes = new Uint8Array(headerStr.length);
        for (let i = 0; i < headerStr.length; i++) {
            headerBytes[i] = headerStr.charCodeAt(i);
        }

        // 2. Pre-allocate buffer for encoded data (header + max scanline sizes)
        // Max uncompressed size = w * h * 4, plus RLE overhead
        const maxDataSize = headerBytes.length + h * (4 + w * 4 * 2);
        const out = new Uint8Array(maxDataSize);
        out.set(headerBytes, 0);
        let pos = headerBytes.length;

        // Channel buffers for scanline RLE
        const chR = new Uint8Array(w);
        const chG = new Uint8Array(w);
        const chB = new Uint8Array(w);
        const chE = new Uint8Array(w);

        // Helper: convert linear float (r, g, b) to RGBE
        const floatToRgbe = (r, g, b) => {
            const v = Math.max(r, Math.max(g, b));
            if (v < 1e-32) {
                return [0, 0, 0, 0];
            }
            const exp = Math.floor(Math.log2(v)) + 1;
            const mantissa = Math.pow(2.0, -exp) * 256.0;
            return [
                Math.min(255, Math.floor(r * mantissa)),
                Math.min(255, Math.floor(g * mantissa)),
                Math.min(255, Math.floor(b * mantissa)),
                Math.min(255, Math.max(0, exp + 128))
            ];
        };

        // Helper: encode a single channel byte stream with RLE
        const encodeChannelRle = (channel) => {
            let i = 0;
            while (i < w) {
                // Check for run of identical values
                let runLen = 1;
                while (i + runLen < w && channel[i + runLen] === channel[i] && runLen < 127) {
                    runLen++;
                }

                if (runLen >= 3) {
                    // Output RLE run
                    out[pos++] = 128 + runLen;
                    out[pos++] = channel[i];
                    i += runLen;
                } else {
                    // Count non-run literal values
                    let litLen = 1;
                    while (i + litLen < w && litLen < 128) {
                        if (i + litLen + 2 < w && channel[i + litLen] === channel[i + litLen + 1] && channel[i + litLen] === channel[i + litLen + 2]) {
                            break; // Stop literal to begin a run
                        }
                        litLen++;
                    }
                    out[pos++] = litLen;
                    for (let l = 0; l < litLen; l++) {
                        out[pos++] = channel[i + l];
                    }
                    i += litLen;
                }
            }
        };

        for (let y = 0; y < h; y++) {
            const rowStart = y * w * 4;

            // Separate scanline into 4 color channels
            for (let x = 0; x < w; x++) {
                const sIdx = rowStart + x * 4;
                const [r, g, b, e] = floatToRgbe(src[sIdx], src[sIdx + 1], src[sIdx + 2]);
                chR[x] = r;
                chG[x] = g;
                chB[x] = b;
                chE[x] = e;
            }

            // Write scanline header [2, 2, (w >> 8), (w & 0xFF)]
            out[pos++] = 2;
            out[pos++] = 2;
            out[pos++] = (w >> 8) & 0xFF;
            out[pos++] = w & 0xFF;

            // Write 4 RLE channels
            encodeChannelRle(chR);
            encodeChannelRle(chG);
            encodeChannelRle(chB);
            encodeChannelRle(chE);
        }

        return out.subarray(0, pos);
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RadianceHdrCodec };
}
if (typeof window !== 'undefined') {
    window.RadianceHdrCodec = RadianceHdrCodec;
}
if (typeof global !== 'undefined') {
    global.RadianceHdrCodec = RadianceHdrCodec;
}
