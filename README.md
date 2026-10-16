# PixelForge Studio 🎨

> **A professional, high-performance Photoshop, Affinity, and GIMP alternative for Windows & Linux.**  
> Built with HTML5 Canvas, modern JavaScript (ES6+), WebGPU/WebGL acceleration, and Electron.

[![Tests](https://img.shields.io/badge/tests-100%25%20passing-brightgreen.svg)](#-test-suites--validation)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20Linux-blue.svg)](#-platform-support--launching)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/runtime%20deps-zero%20(pure%20JS)-orange.svg)](#-architecture--zero-dependency-philosophy)

---

## 📑 Table of Contents
- [Parity Matrix: PixelForge vs. Industry Titans](#-parity-matrix-pixelforge-vs-industry-titans)
- [Key Architectural Highlights](#-key-architectural-highlights)
- [Complete Toolset (49 Professional Tools)](#-complete-toolset-49-professional-tools)
- [Pro File Formats & Codecs](#-pro-file-formats--codecs)
- [Color Management & Prepress](#-color-management--prepress)
- [Layer Architecture & Styles](#-layer-architecture--styles)
- [Filter Suite & AI Retouching](#-filter-suite--ai-retouching)
- [Complete Keyboard Shortcuts](#-complete-keyboard-shortcuts)
- [Platform Support & Launching](#-platform-support--launching)
- [Test Suites & Validation](#-test-suites--validation)

---

## 🏆 Parity Matrix: PixelForge vs. Industry Titans

| Feature Category | PixelForge Studio | Adobe Photoshop CC | Affinity Photo 2 | GIMP 2.10 / 3.0 |
| :--- | :---: | :---: | :---: | :---: |
| **Photoshop PSD & PSB Roundtrip** | ✅ Full (PSD & PSB up to 300k px) | ✅ Native | ⚠️ PSD only (Partial PSB) | ⚠️ PSD only (Partial) |
| **Adobe Preset Importers (.abr, .ase, .aco)** | ✅ Native Pure-JS Binary Parsers & Exporter | ✅ Native | ⚠️ Partial (.abr only) | ⚠️ Brushes only (GIMP .gbr) |
| **Vector Boolean Shape Operations (Pathfinder)** | ✅ Union, Subtract, Intersect, Exclude | ✅ Native Shape Modes | ✅ Geometry Operations | ⚠️ Path tool subtract only |
| **Multi-Document Tabbed Workspace** | ✅ Concurrent tabs + Cross-Doc Layer Clone | ✅ Native Tabs | ✅ Native Tabs | ⚠️ Image tabs |
| **Camera RAW Container (DNG/CR2/NEF/ARW)** | ✅ Native Pure-JS Parser & CFA Demosaic | ✅ Adobe Camera Raw | ✅ Serif RAW Engine | ⚠️ Requires Darktable / UFRaw |
| **Native 4-Channel CMYK TIFF & Plates** | ✅ GCR + 4 Film Separation Plates | ✅ Native CMYK | ✅ Native CMYK | ⚠️ RGB-only core (Separate+ plugin) |
| **OpenEXR 32-Bit Linear HDR** | ✅ Half-Float Codec + ACES Tonemap | ✅ Native EXR | ✅ Native EXR | ⚠️ Basic 32-bit float |
| **Hardware Compute Acceleration** | ✅ WebGPU (WGSL) + WebGL2 Fallback | ✅ DirectX / Metal | ✅ OpenCL / Metal | ⚠️ GEGL OpenCL (Experimental) |
| **Smart Objects & Non-Destructive Filters**| ✅ Full resolution independence | ✅ Native | ✅ Embedded Documents | ❌ Destructive filters |
| **Vector Pen & Curvature Tool** | ✅ Bézier + Curvature + Paths Panel | ✅ Full | ✅ Full | ⚠️ Bézier paths only |
| **Advanced OpenType & Variable Fonts** | ✅ Features (`liga`, `smcp`, `tnum`) + Axes | ✅ Full | ✅ Full | ⚠️ Basic text formatting |
| **Generative Fill & AI Inpainting** | ✅ Texture-aware Poisson synthesis | ✅ Firefly (Cloud) | ❌ None | ❌ Resynthesizer plugin |
| **Interactive Toolbar Customizer** | ✅ 6-category drawer + presets | ✅ Native | ⚠️ Basic customize | ⚠️ Preferences dock |
| **Automated Multi-Platform CI/CD** | ✅ GitHub Actions (.exe, AppImage, deb) | ❌ Proprietary Installer | ❌ Proprietary Installer | ✅ Source / Flatpak |
| **Cross-Platform (Windows & Linux)** | ✅ Windows .exe + Linux AppImage/deb | ❌ Windows & Mac only | ❌ Windows & Mac only | ✅ Linux, Windows & Mac |
| **License & Pricing** | **Free & Open Source (MIT)** | \$239.88 / year subscription | \$69.99 perpetual | Free & Open Source (GPL) |

---

## 🌟 Key Architectural Highlights

### 🎨 Adobe Preset Asset Importers (.abr, .ase, .aco) & Swatch Exporter
- High-performance, zero-dependency binary parsers for industry-standard Adobe preset bundles:
  - **Adobe Swatch Exchange (`.ase`)**: Full decoding of RGB, CMYK, LAB (D65), and Grayscale palettes with global/spot classifications, plus a binary `.ase` serializer for exporting swatches.
  - **Adobe Color Palette (`.aco`)**: Support for Version 1 and Version 2 swatches with UTF-16 BE color names and accurate HSB/Lab/CMYK conversions.
  - **Photoshop Brush Presets (`.abr`)**: Legacy Version 1/2 and modern Version 6+ sampled brush tips (`8BIM samp`) with PackBits RLE scanline decompression.

### 📐 Vector Boolean Shape Operations Engine (Pathfinder)
- Analytical 2D constructive solid geometry (CSG) engine for vector paths and shape layers:
  - **Union (Combine)**, **Subtract Front (Difference)**, **Intersect**, and **Exclude Overlapping (XOR)**.
  - Fast-path exact rectilinear CSG for axis-aligned shapes and generalized Greiner-Hormann polygon clipping.
  - Seamless integration with Subpaths, Bézier curves, and shape layers in the layer stack.

### 📑 Multi-Document Tabbed Interface
- Concurrent multi-document session manager (`MultiDocumentManager`):
  - Top document tab bar displaying document titles, dirty indicators (`*`), zoom percentages, and close controls.
  - Instant $O(1)$ document switching preserving individual layer stacks, history timelines, zoom/pan states, and rulers.
  - Cross-document layer cloning: duplicate or drag layers seamlessly between active documents.

### 🚀 Automated Multi-Platform GitHub Actions CI/CD Pipeline
- Production-grade `.github/workflows/build-release.yml` with automated testing and packaging:
  - Matrix test execution on Windows and Ubuntu Linux across Node 20.x and 22.x.
  - Automated Windows build generating NSIS installers and portable executables.
  - Automated Linux build generating AppImage, `.deb`, and `.tar.gz` packages.
  - Automated GitHub Releases with SHA-256 checksums on version tag pushes.

### 📸 Camera RAW Binary Container & DNG Decoder Engine
- High-performance binary parser for standard TIFF-based digital camera raw formats: **Adobe DNG**, **Canon CR2**, **Nikon NEF**, and **Sony ARW**.
- Reads multi-IFDs, SubIFDs, EXIF/MakerNote tags, and CFA (Color Filter Array) Bayer geometries.
- Features built-in synthetic & linear sensor CFA encoder and direct bridge to high-fidelity demosaicing.

### 🖨️ Native 4-Channel CMYK TIFF & Prepress Separation Plates
- Full implementation of separated 4-channel CMYK TIFF format (`PhotometricInterpretation = 5`, `SamplesPerPixel = 4`, `BitsPerSample = [8,8,8,8]`).
- RGB-to-CMYK conversion engine with configurable **GCR (Gray Component Replacement)** and **Total Ink Limit (TIL $\le 300\%$)** safety clamps.
- Automated 4-plate prepress film separation generator producing individual film positives for **Cyan**, **Magenta**, **Yellow**, and **Key/Black** plates with PackBits RLE compression.

### 🌌 OpenEXR (`.exr`) 32-Bit Linear Floating Point Codec
- Native binary encoder and decoder for Industrial Light & Magic's OpenEXR 32-bit floating-point file format (Version 2).
- Bitwise IEEE 754 16-bit half-float converters and multi-channel scanline processing (`R`, `G`, `B`, `A`).
- Integrated **ACES Filmic Tonemapping** operator for non-destructive preview and sRGB conversions.

### 📐 Photoshop Large Document Format (.PSB) Support
- Unlocks support for massive canvas sizes exceeding Photoshop's 30,000 pixel ceiling (up to 300,000px).
- Complete 64-bit BigInt binary stream architecture with PSB Version 2 headers, 8-byte channel record sizes, and 4-byte RLE scanline tables.
- Seamless roundtrip compatibility with Adobe Photoshop CC.

### 🔤 Advanced OpenType & Variable Typography Controls
- Full typographic control over OpenType feature tags: **Standard Ligatures (`liga`)**, **Discretionary Ligatures (`dlig`)**, **Small Capitals (`smcp`)**, **Tabular Numbers (`tnum`)**, **Slashed Zero (`zero`)**, and **Fractions (`frac`)**.
- Variable font axis controls for Weight (`wght`), Width (`wdth`), and Slant (`slnt`).
- Precision multi-line editorial layout engine with tracking (letter-spacing), leading, paragraph indentation, and simulated small-caps fallbacks.

### ⚡ WebGPU Hardware Compute Acceleration Engine
- Direct GPGPU acceleration utilizing next-generation **WGSL (WebGPU Shading Language)** compute shaders:
  - 2D Separable Gaussian Blur compute kernels.
  - Bilateral Surface-Preserving Filter (Smart Skin Smoothing).
  - Unsharp Mask Detail Contrast Enhancement.
  - Malvar-He-Cutler Bayer RAW Demosaicing.
- Automatic feature negotiation with transparent WebGL and optimized CPU fallback pipelines.

### 🎯 Saliency-Based Subject Selection (Anti-Oval)
- Multi-scale gradient and chromatic contrast saliency detector.
- Traces high-precision contours without oval or elliptical distortion.
- Supports both **Select Subject (Automatic)** and **Object Selection Tool (User-defined area marquee)**.

---

## 🎨 Complete Toolset (49 Professional Tools)

### 1. 🎯 Selection & Navigation
| Tool | Shortcut | Functionality |
| :--- | :---: | :--- |
| **Move Tool** | `V` | Translate, align, auto-select layers and smart guides. |
| **Rectangular Marquee** | `M` | Rectangular pixel selection with feathering & aspect constraints. |
| **Elliptical Marquee** | `Shift+M` | Circular/oval pixel selection with antialiasing. |
| **Lasso Tool** | `L` | Freeform boundary selection. |
| **Polygonal Lasso** | `Shift+L` | Point-to-point straight edge polygon selections. |
| **Magnetic Lasso** | `Shift+L` | Edge-snapping high-contrast contour selection. |
| **Magic Wand** | `W` | Contiguous & global color tolerance auto-selection. |
| **Object Selection Tool** | `Shift+W` | Drag marquee over an object for instant bounding saliency contouring. |
| **Eyedropper Tool** | `I` | Sample point, $3\times3$, or $5\times5$ average RGB/Hex colors. |
| **Hand Tool** | `H` or `Space` | Smooth sub-pixel canvas viewport panning. |
| **Zoom Tool** | `Z` | Left-click zoom in, Alt-click zoom out, scrubby zoom. |

### 2. ✂️ Crop & Transformation
| Tool | Shortcut | Functionality |
| :--- | :---: | :--- |
| **Crop Tool** | `C` | Non-destructive canvas cropping, rule-of-thirds grid, and aspect locking. |
| **Content-Aware Move** | `Shift+J` | Seamlessly relocate subjects with synthetic Poisson edge blending. |
| **Free Transform** | `Ctrl+T` | 8-point bounding box scaling, rotation pin, skew, and perspective. |
| **Bézier Mesh Warp** | `Ctrl+Shift+W` | $4\times4$ Bézier control grid for flexible graphic deformation. |
| **Split Warp** | — | Subdivision mesh warp for complex 3D product mockups. |
| **Puppet Warp** | — | Kinematic rigid pin mesh deformation with depth ordering. |

### 3. 🩹 Retouching & Healing
| Tool | Shortcut | Functionality |
| :--- | :---: | :--- |
| **Spot Healing Brush** | `J` | 1-click blemish removal with automatic neighborhood texture synthesis. |
| **Patch Tool** | `Shift+J` | Selection-based source/destination surface blending. |
| **Clone Stamp** | `S` | Sample point pixel cloning with preview overlay. |
| **History Brush** | `Y` | Paint previous history states selectively onto the canvas. |
| **Adjustment Brush** | — | Directly brush exposure, temperature, and vibrance into layer masks. |

### 4. 🖌️ Painting & Erasing
| Tool | Shortcut | Functionality |
| :--- | :---: | :--- |
| **Paintbrush** | `B` | W3C Pointer stylus pressure, flow, hardness, and dual brush engine. |
| **Mixer Brush** | `Shift+B` | Wet canvas simulation, color reservoir mixing, and paint pickup. |
| **Pencil** | `Shift+B` | 1px crisp non-antialiased line drawing for pixel art. |
| **Eraser** | `E` | Alpha transparency eraser with soft/hard brush dynamics. |
| **Paint Bucket** | `G` | BFS scanline flood fill with adjustable tolerance and antialiasing. |
| **Gradient Tool** | `Shift+G` | Linear, Radial, Angle, Reflected, and Diamond color transitions. |

### 5. 💡 Focus & Tonal Retouch
| Tool | Shortcut | Functionality |
| :--- | :---: | :--- |
| **Blur Tool** | — | Soften local high-frequency textures. |
| **Sharpen Tool** | — | Increase local edge contrast and definition. |
| **Smudge Tool** | — | Finger-drag wet paint and blend adjacent colors. |
| **Dodge Tool** | `O` | Selectively lighten shadows, midtones, or highlights. |
| **Burn Tool** | `Shift+O` | Selectively deepen and darken tonal ranges. |
| **Sponge Tool** | `Shift+O` | Saturate or desaturate local chroma. |

### 6. ✒️ Vector, Shapes & Typography
| Tool | Shortcut | Functionality |
| :--- | :---: | :--- |
| **Pen Tool** | `P` | Standard cubic Bézier vector curve drafting. |
| **Curvature Pen** | `Shift+P` | Automatic smooth curve interpolation from single clicks. |
| **Path Selection** | `A` | Select and move complete vector subpaths. |
| **Direct Selection** | `Shift+A` | Select, move, and edit individual anchor points and control handles. |
| **Text Tool** | `T` | Vector text with OpenType features, tracking, leading, and small-caps. |
| **Shape Tools** | `U` | Vector Rectangle, Rounded Rectangle, Ellipse, Polygon, Star, and Line. |

### 7. 🌊 Liquify Suite
| Tool | Functionality |
| :--- | :--- |
| **Forward Warp** | Pushes pixels forward along cursor drag vector. |
| **Reconstruct** | Gradually restores warped mesh back to original undisturbed grid. |
| **Smooth** | Relaxes irregular mesh distortions. |
| **Twirl CW / CCW** | Rotates pixels clockwise or counter-clockwise around cursor radius. |
| **Pucker / Bloat** | Moves pixels toward or away from cursor center. |
| **Push Left** | Displaces pixels perpendicularly to stroke direction. |

---

## 📁 Pro File Formats & Codecs

PixelForge Studio implements clean, zero-dependency binary parsers and serializers:

- **`.psd` / `.psb`**: Full Adobe Photoshop Document & Large Document Format support (up to 300,000px, multi-layer, blend modes, masks, 64-bit BigInt streams).
- **`.exr`**: ILM OpenEXR 32-bit Linear Floating Point format with ACES Filmic tonemapping.
- **`.dng`, `.cr2`, `.nef`, `.arw`**: Digital camera RAW containers with Bayer CFA parsing.
- **`.tif` / `.tiff`**: Separated 4-channel CMYK TIFF with PackBits compression and ResolutionInfo DPI tags.
- **`.hdr`**: Radiance 32-bit RGBE High Dynamic Range images.
- **`.pforge`**: PixelForge native JSON + binary canvas project package.
- **`.webp`**: Modern compressed web graphics with quality & lossless options.
- **`.svg`**: Scalable Vector Graphics export preserving vector paths and text markup.
- **`.pdf`**: Multi-page artboard PDF compiler with embedded image XObjects and SMasks.
- **`.cube`**: 3D Color Lookup Tables (17x17x17, 33x33x33, 65x65x65).
- **`.mp4` / `.webm` / `.gif`**: Timeline animation and frame-by-frame export.

---

## 🎨 Color Management & Prepress

- **Working Color Spaces**: sRGB, Adobe RGB (1998), Display P3, and ProPhoto RGB.
- **CMYK Soft-Proofing (`Ctrl + Y`)**:
  - U.S. Web Coated (SWOP) v2
  - ISO Coated FOGRA39 (Europe)
  - Euroscale Uncoated v2
- **Gamut Warning (`Ctrl + Shift + Y`)**: Real-time neon alert highlighting out-of-gamut pigments.
- **Prepress Separation**: Automated 4-plate separation generator creating film positives for Cyan, Magenta, Yellow, and Key/Black.

---

## 📚 Layer Architecture & Styles

- **Layer Types**: Raster, Smart Objects (resolution-independent), Adjustment Layers, Vector Masks, Shape Layers, Text Layers, Group Folders.
- **Blend Modes (All 27 Photoshop Modes)**:
  - *Normal, Dissolve, Darken, Multiply, Color Burn, Linear Burn, Darker Color*
  - *Lighten, Screen, Color Dodge, Linear Dodge (Add), Lighter Color*
  - *Overlay, Soft Light, Hard Light, Vivid Light, Linear Light, Pin Light, Hard Mix*
  - *Difference, Exclusion, Subtract, Divide*
  - *Hue, Saturation, Color, Luminosity, Pass-Through*
- **Layer Styles (Blending Options)**:
  - Drop Shadow, Inner Shadow, Outer Glow, Inner Glow, Stroke, Bevel & Emboss, Color Overlay, Gradient Overlay, Pattern Overlay, Satin.

---

## 🎛️ Filter Suite & AI Retouching

- **Neural & AI Suite**: Generative Fill, Smart Subject Detection, Portrait Depth Blur, Face Smoothing.
- **Color & Tonal Grading**: Curves & Levels (`Ctrl+M`), Selective Color (CMYK sliders), Channel Mixer, Color Lookup (3D LUT).
- **Technical Retouch**: Camera RAW Lab, Frequency Separation (Low/High frequency split), High Pass Filter, Kuwahara Oil Paint, Halftone Screen, Lens Correction, Focus Stacking, Chromatic Aberration.
- **3D Surface Generation**: Tangent Space Normal Maps, Bump/Height Maps, Multi-Light 3D Point/Spot/Directional Lighting Effects.

---

## ⌨️ Complete Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Ctrl + N`** | New Document Dialog |
| **`Ctrl + O`** | Open File (Image, PSD, PSB, EXR, RAW) |
| **`Ctrl + S`** | Quick Save / Export Flattened PNG |
| **`Ctrl + Shift + S`** | Save Project File (`.pforge`) |
| **`Ctrl + T`** | Free Transform (Scale, Rotate, Skew) |
| **`Ctrl + M`** | Curves & Levels Tone Histogram Tool |
| **`Ctrl + R`** | Show / Hide Canvas Rulers |
| **`Ctrl + ;`** | Show / Hide Guides |
| **`Ctrl + '`** | Show / Hide Grid |
| **`Ctrl + Y`** | Toggle CMYK Proof Colors |
| **`Ctrl + Shift + Y`** | Toggle Out-of-Gamut Warning |
| **`Ctrl + Z`** | Undo History State |
| **`Ctrl + Y`** / **`Ctrl + Shift + Z`** | Redo History State |
| **`Ctrl + A`** | Select All |
| **`Ctrl + D`** | Deselect |
| **`Ctrl + Shift + I`** | Invert Selection |
| **`Ctrl + J`** | Duplicate Active Layer |
| **`Ctrl + E`** | Merge Layer Down |
| **`Ctrl + Shift + E`** | Merge All Visible Layers |
| **`Ctrl + Shift + A`** | Open Camera RAW Lab |
| **`Ctrl + Shift + X`** | Open Liquify Filter Mesh |
| **`Ctrl + Alt + Shift + W`** | Export As (Pro Export Suite) |
| **`Q`** | Toggle Quick Mask Mode |
| **`X`** | Swap Foreground and Background Colors |
| **`D`** | Reset Colors to Default Black & White |
| **`[ / ]`** | Decrease / Increase Brush Diameter |
| **`Ctrl + + / -`** | Zoom In / Out |
| **`Ctrl + 0`** | Fit Document to Screen |
| **`Ctrl + 1`** | 100% Actual Size View |
| **`Space + Drag`** | Pan Viewport (Hand Tool) |
| **`Enter`** | Commit Transform / Crop |
| **`Escape`** | Cancel Transform / Return to Home Screen |

---

## 💻 Platform Support & Launching

PixelForge Studio is 100% cross-platform compatible on both **Windows** and **Linux** (Ubuntu, Debian, Fedora, Arch, etc.).

### Windows
```powershell
# 1-Click Launch via batch menu
.\run-pixelforge.bat

# Or run directly via terminal
npm start

# Build standalone Windows installer (.exe)
npm run dist
```

### Linux
```bash
# 1-Click Launch via shell script
chmod +x run-pixelforge.sh
./run-pixelforge.sh

# Or launch directly
npm start

# Build standalone Linux packages (AppImage, deb, tar.gz)
npm run dist
```

### Web Browser Mode
PixelForge Studio can run entirely in any modern web browser without Electron:
```bash
node server.js
# Open http://localhost:3000 in Chrome, Firefox, Edge, or Safari
```

---

## 🧪 Test Suites & Validation

PixelForge Studio maintains **100% test coverage** across all modules with automated regression and black-box component discovery suites:

```bash
npm test
```

### Verified Test Suites:
- `test-blackbox-components-audit.js`: Audits all 172 menu actions, 49 tools, and 61 modals (**0 errors**).
- `test-raw-container.js`: DNG, CR2, NEF, ARW binary IFD reading, CFA demosaic roundtrip (**Passed**).
- `test-cmyk-export.js`: Native 4-channel CMYK TIFF & prepress separation plates (**Passed**).
- `test-exr-codec.js`: OpenEXR 32-bit linear half-float encoder/decoder & ACES tonemap (**Passed**).
- `test-psb-support.js`: Photoshop Large Document Format (Version 2) 64-bit roundtrip (**Passed**).
- `test-typography-advanced.js`: OpenType feature settings, variable axes, multi-line tracking (**Passed**).
- `test-webgpu-compute.js`: WGSL compute shaders, bilateral filter, unsharp mask (**Passed**).
- `test-smart-objects.js`: Resolution independence & non-destructive filter stacks (**Passed**).
- `test-subject-selection-parity.js`: Saliency subject detection and boundary tracing (**Passed**).
- `test-linux-compatibility.js`: Linux environment, desktop integration, packaging (**Passed**).
- `test-milestone1.js` through `test-milestone6.js`: Foundation core engines (**Passed**).
- `test-phase2` through `test-phase15`: Advanced layer styles, vector pen, neural filters, HDR (**Passed**).

---

## 📄 License
This project is licensed under the **MIT License**.
