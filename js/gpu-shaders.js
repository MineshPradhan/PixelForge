/**
 * PixelForge Studio - GPU Shader Acceleration Engine (Phase 13)
 * High-performance WebGL2/WebGL1 GLSL filter and convolution acceleration
 * with automatic CPU fallback for headless and unsupported environments.
 */

(function (global) {
  'use strict';

  // Base vertex shader for rendering full-screen textured quad
  const VERTEX_SHADER_SRC = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `;

  // Fragment shaders for high-speed image processing
  const FRAGMENT_SHADERS = {
    // Pass-through copy
    passthrough: `
      precision mediump float;
      uniform sampler2D u_image;
      varying vec2 v_texCoord;
      void main() {
        gl_FragColor = texture2D(u_image, v_texCoord);
      }
    `,

    // Separable Gaussian Blur (1D along u_direction)
    gaussianBlur: `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform vec2 u_direction;
      uniform float u_radius;
      varying vec2 v_texCoord;

      void main() {
        vec2 onePixel = u_direction / u_resolution;
        vec4 color = vec4(0.0);
        float totalWeight = 0.0;
        float sigma = max(u_radius * 0.5, 0.5);

        for (int i = -8; i <= 8; i++) {
          float fi = float(i);
          if (abs(fi) <= u_radius) {
            float weight = exp(-(fi * fi) / (2.0 * sigma * sigma));
            vec2 coords = v_texCoord + onePixel * fi;
            color += texture2D(u_image, clamp(coords, 0.0, 1.0)) * weight;
            totalWeight += weight;
          }
        }
        gl_FragColor = color / totalWeight;
      }
    `,

    // Unsharp Mask (Enhance sharp edges)
    unsharpMask: `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform float u_amount;
      uniform float u_radius;
      varying vec2 v_texCoord;

      void main() {
        vec2 onePixel = vec2(1.0) / u_resolution;
        vec4 original = texture2D(u_image, v_texCoord);
        vec4 blurred = vec4(0.0);
        float count = 0.0;

        for (int x = -2; x <= 2; x++) {
          for (int y = -2; y <= 2; y++) {
            blurred += texture2D(u_image, clamp(v_texCoord + vec2(float(x), float(y)) * onePixel * u_radius, 0.0, 1.0));
            count += 1.0;
          }
        }
        blurred /= count;
        vec4 diff = original - blurred;
        vec4 sharpened = original + diff * (u_amount / 100.0);
        gl_FragColor = vec4(clamp(sharpened.rgb, 0.0, 1.0), original.a);
      }
    `,

    // Chromatic Aberration (Radial optical prism split)
    chromaticAberration: `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform float u_offset;
      varying vec2 v_texCoord;

      void main() {
        vec2 dir = v_texCoord - vec2(0.5);
        float dist = length(dir);
        vec2 offset = dir * (u_offset * 0.02) * dist;

        float r = texture2D(u_image, clamp(v_texCoord - offset, 0.0, 1.0)).r;
        float g = texture2D(u_image, v_texCoord).g;
        float b = texture2D(u_image, clamp(v_texCoord + offset, 0.0, 1.0)).b;
        float a = texture2D(u_image, v_texCoord).a;

        gl_FragColor = vec4(r, g, b, a);
      }
    `,

    // High Pass Filter (Extract details with neutral gray 0.5 baseline)
    highPass: `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform float u_radius;
      varying vec2 v_texCoord;

      void main() {
        vec2 onePixel = vec2(1.0) / u_resolution;
        vec4 original = texture2D(u_image, v_texCoord);
        vec4 blurred = vec4(0.0);
        float count = 0.0;

        for (int x = -2; x <= 2; x++) {
          for (int y = -2; y <= 2; y++) {
            blurred += texture2D(u_image, clamp(v_texCoord + vec2(float(x), float(y)) * onePixel * u_radius, 0.0, 1.0));
            count += 1.0;
          }
        }
        blurred /= count;
        vec3 highPass = (original.rgb - blurred.rgb) + vec3(0.5);
        gl_FragColor = vec4(clamp(highPass, 0.0, 1.0), original.a);
      }
    `,

    // Film Grain & Analog Noise
    filmGrain: `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform float u_amount;
      uniform float u_seed;
      varying vec2 v_texCoord;

      float rand(vec2 co) {
        return fract(sin(dot(co.xy + vec2(u_seed), vec2(12.9898, 78.233))) * 43758.5453) * 2.0 - 1.0;
      }

      void main() {
        vec4 base = texture2D(u_image, v_texCoord);
        float noise = rand(v_texCoord * u_resolution) * (u_amount / 255.0);
        gl_FragColor = vec4(clamp(base.rgb + vec3(noise), 0.0, 1.0), base.a);
      }
    `,

    // Color Invert
    invert: `
      precision mediump float;
      uniform sampler2D u_image;
      varying vec2 v_texCoord;
      void main() {
        vec4 c = texture2D(u_image, v_texCoord);
        gl_FragColor = vec4(1.0 - c.rgb, c.a);
      }
    `
  };

  class GPUFilterEngine {
    constructor(canvas = null) {
      this.canvas = canvas;
      this.gl = null;
      this.programs = {};
      this.quadBuffer = null;
      this.isSupported = false;
      this.initGL();
    }

    /**
     * Attempt WebGL2 / WebGL1 context initialization
     */
    initGL() {
      if (typeof document === 'undefined') {
        this.isSupported = false;
        return;
      }

      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1;
        this.canvas.height = 1;
      }

      const options = { preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: true };
      this.gl = this.canvas.getContext('webgl2', options) ||
                this.canvas.getContext('webgl', options) ||
                this.canvas.getContext('experimental-webgl', options);

      if (!this.gl) {
        this.isSupported = false;
        return;
      }

      this.isSupported = true;
      this.setupBuffers();
      this.compileAllPrograms();
    }

    /**
     * Initialize full-screen quad vertices & texcoords
     */
    setupBuffers() {
      const gl = this.gl;
      if (!gl) return;

      const vertices = new Float32Array([
        // x, y,   u, v
        -1, -1,   0, 0,
         1, -1,   1, 0,
        -1,  1,   0, 1,
        -1,  1,   0, 1,
         1, -1,   1, 0,
         1,  1,   1, 1
      ]);

      this.quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }

    /**
     * Compile shader helper
     */
    compileShader(src, type) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('GLSL Compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    /**
     * Create shader program from name and source
     */
    createProgram(name, fsSrc) {
      const gl = this.gl;
      if (!gl) return null;

      const vs = this.compileShader(VERTEX_SHADER_SRC, gl.VERTEX_SHADER);
      const fs = this.compileShader(fsSrc, gl.FRAGMENT_SHADER);
      if (!vs || !fs) return null;

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('GL Program Link error:', gl.getProgramInfoLog(program));
        return null;
      }

      return {
        program,
        attribs: {
          position: gl.getAttribLocation(program, 'a_position'),
          texCoord: gl.getAttribLocation(program, 'a_texCoord')
        },
        uniforms: {
          image: gl.getUniformLocation(program, 'u_image'),
          resolution: gl.getUniformLocation(program, 'u_resolution'),
          direction: gl.getUniformLocation(program, 'u_direction'),
          radius: gl.getUniformLocation(program, 'u_radius'),
          amount: gl.getUniformLocation(program, 'u_amount'),
          offset: gl.getUniformLocation(program, 'u_offset'),
          seed: gl.getUniformLocation(program, 'u_seed')
        }
      };
    }

    compileAllPrograms() {
      for (const [name, src] of Object.entries(FRAGMENT_SHADERS)) {
        this.programs[name] = this.createProgram(name, src);
      }
    }

    /**
     * Upload an ImageData or canvas to a WebGL texture
     */
    createTexture(source) {
      const gl = this.gl;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      if (source instanceof ImageData || (source && source.data && source.width && source.height)) {
        gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, source.width, source.height, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, source.data
        );
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      }

      return texture;
    }

    /**
     * Render a quad using the specified shader program and uniform parameters
     */
    applyShader(programName, imageData, uniforms = {}) {
      if (!this.isSupported || !this.programs[programName]) {
        return this.fallbackCPU(programName, imageData, uniforms);
      }

      const gl = this.gl;
      const p = this.programs[programName];
      const width = imageData.width;
      const height = imageData.height;

      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      gl.useProgram(p.program);

      // Bind vertex buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(p.attribs.position);
      gl.vertexAttribPointer(p.attribs.position, 2, gl.FLOAT, false, 16, 0);

      gl.enableVertexAttribArray(p.attribs.texCoord);
      gl.vertexAttribPointer(p.attribs.texCoord, 2, gl.FLOAT, false, 16, 8);

      // Upload input texture
      const inputTex = this.createTexture(imageData);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTex);
      gl.uniform1i(p.uniforms.image, 0);

      // Set standard uniforms
      if (p.uniforms.resolution) gl.uniform2f(p.uniforms.resolution, width, height);
      if (p.uniforms.direction && uniforms.direction) gl.uniform2f(p.uniforms.direction, uniforms.direction[0], uniforms.direction[1]);
      if (p.uniforms.radius && uniforms.radius !== undefined) gl.uniform1f(p.uniforms.radius, uniforms.radius);
      if (p.uniforms.amount && uniforms.amount !== undefined) gl.uniform1f(p.uniforms.amount, uniforms.amount);
      if (p.uniforms.offset && uniforms.offset !== undefined) gl.uniform1f(p.uniforms.offset, uniforms.offset);
      if (p.uniforms.seed && uniforms.seed !== undefined) gl.uniform1f(p.uniforms.seed, uniforms.seed);

      // Draw full screen quad
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Read back pixels
      const outputBuffer = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, outputBuffer);

      // Note: WebGL reads with inverted Y (bottom-to-top), flip Y on output
      const flipped = new Uint8ClampedArray(width * height * 4);
      const rowSize = width * 4;
      for (let y = 0; y < height; y++) {
        const srcOffset = (height - 1 - y) * rowSize;
        const dstOffset = y * rowSize;
        flipped.set(outputBuffer.subarray(srcOffset, srcOffset + rowSize), dstOffset);
      }

      // Cleanup texture
      gl.deleteTexture(inputTex);

      if (typeof ImageData !== 'undefined') {
        return new ImageData(flipped, width, height);
      }
      return { data: flipped, width, height };
    }

    /**
     * High-speed Separable Gaussian Blur (Two-pass GLSL)
     */
    applyGaussianBlur(imageData, radius = 5) {
      if (!this.isSupported) return this.fallbackCPU('gaussianBlur', imageData, { radius });
      // Pass 1: Horizontal blur
      const pass1 = this.applyShader('gaussianBlur', imageData, { direction: [1.0, 0.0], radius });
      // Pass 2: Vertical blur
      return this.applyShader('gaussianBlur', pass1, { direction: [0.0, 1.0], radius });
    }

    /**
     * Unsharp Masking
     */
    applyUnsharpMask(imageData, amount = 100, radius = 1) {
      return this.applyShader('unsharpMask', imageData, { amount, radius });
    }

    /**
     * Chromatic Aberration
     */
    applyChromaticAberration(imageData, offset = 5) {
      return this.applyShader('chromaticAberration', imageData, { offset });
    }

    /**
     * High Pass
     */
    applyHighPass(imageData, radius = 3) {
      return this.applyShader('highPass', imageData, { radius });
    }

    /**
     * Film Grain
     */
    applyFilmGrain(imageData, amount = 25, seed = Math.random()) {
      return this.applyShader('filmGrain', imageData, { amount, seed });
    }

    /**
     * Color Invert
     */
    applyInvert(imageData) {
      return this.applyShader('invert', imageData);
    }

    /**
     * Pure CPU Fallback implementation when WebGL is absent or failing
     */
    fallbackCPU(filterName, imageData, params = {}) {
      const { width, height, data } = imageData;
      const copy = new Uint8ClampedArray(data);

      if (filterName === 'invert') {
        for (let i = 0; i < copy.length; i += 4) {
          copy[i] = 255 - copy[i];
          copy[i + 1] = 255 - copy[i + 1];
          copy[i + 2] = 255 - copy[i + 2];
        }
      } else if (filterName === 'filmGrain') {
        const amt = params.amount || 25;
        for (let i = 0; i < copy.length; i += 4) {
          const noise = (Math.random() - 0.5) * amt * 2;
          copy[i] = Math.max(0, Math.min(255, copy[i] + noise));
          copy[i + 1] = Math.max(0, Math.min(255, copy[i + 1] + noise));
          copy[i + 2] = Math.max(0, Math.min(255, copy[i + 2] + noise));
        }
      } else if (filterName === 'chromaticAberration') {
        const offset = Math.round(params.offset || 5);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const rX = Math.max(0, Math.min(width - 1, x - offset));
            const bX = Math.max(0, Math.min(width - 1, x + offset));
            copy[idx] = data[(y * width + rX) * 4];
            copy[idx + 2] = data[(y * width + bX) * 4 + 2];
          }
        }
      } else {
        // Simple box blur fallback for blur/highPass/unsharpMask
        const r = Math.max(1, Math.round(params.radius || 2));
        const out = new Uint8ClampedArray(copy);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            for (let ky = -r; ky <= r; ky++) {
              const ny = y + ky;
              if (ny < 0 || ny >= height) continue;
              for (let kx = -r; kx <= r; kx++) {
                const nx = x + kx;
                if (nx < 0 || nx >= width) continue;
                const kidx = (ny * width + nx) * 4;
                rSum += data[kidx];
                gSum += data[kidx + 1];
                bSum += data[kidx + 2];
                count++;
              }
            }
            const outIdx = (y * width + x) * 4;
            const avgR = rSum / count;
            const avgG = gSum / count;
            const avgB = bSum / count;

            if (filterName === 'highPass') {
              out[outIdx] = Math.max(0, Math.min(255, data[outIdx] - avgR + 128));
              out[outIdx + 1] = Math.max(0, Math.min(255, data[outIdx + 1] - avgG + 128));
              out[outIdx + 2] = Math.max(0, Math.min(255, data[outIdx + 2] - avgB + 128));
            } else if (filterName === 'unsharpMask') {
              const amt = (params.amount || 100) / 100;
              out[outIdx] = Math.max(0, Math.min(255, data[outIdx] + (data[outIdx] - avgR) * amt));
              out[outIdx + 1] = Math.max(0, Math.min(255, data[outIdx + 1] + (data[outIdx + 1] - avgG) * amt));
              out[outIdx + 2] = Math.max(0, Math.min(255, data[outIdx + 2] + (data[outIdx + 2] - avgB) * amt));
            } else {
              out[outIdx] = avgR;
              out[outIdx + 1] = avgG;
              out[outIdx + 2] = avgB;
            }
          }
        }
        return (typeof ImageData !== 'undefined') ? new ImageData(out, width, height) : { data: out, width, height };
      }

      return (typeof ImageData !== 'undefined') ? new ImageData(copy, width, height) : { data: copy, width, height };
    }
  }

  // Export globally and for Node.js
  global.GPUFilterEngine = GPUFilterEngine;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GPUFilterEngine };
  }
})(typeof window !== 'undefined' ? window : globalThis);
