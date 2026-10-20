# PixelForge Studio 🎨

> **A professional, high-performance Photoshop, Affinity, and GIMP alternative for macOS, Windows & Linux.**  
> Built with HTML5 Canvas, modern JavaScript (ES6+), WebGPU/WebGL acceleration, and Electron.

[![Tests](https://img.shields.io/badge/tests-100%25%20passing-brightgreen.svg)](#-test-suites--validation)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-blue.svg)](#-platform-support--launching)
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

| Feature Category | PixelForge Studio | Adobe Photoshop CC | Affinity Photo 2 | Krita 5.x / GIMP |
| :--- | :---: | :---: | :---: | :---: |
| **Photoshop PSD & PSB Roundtrip** | ✅ Full (PSD & PSB up to 300k px) | ✅ Native | ⚠️ PSD only (Partial PSB) | ⚠️ PSD only (Partial) |
| **Adobe Preset Importers (.abr, .ase, .aco)** | ✅ Native Pure-JS Binary Parsers & Exporter | ✅ Native | ⚠️ Partial (.abr only) | ⚠️ Brushes only (GIMP .gbr) |
| **Infinite Seamless Canvas Wrap-Around (`Shift+W`)** | ✅ 9-quadrant toroidal tiling & brush wrap | ⚠️ Pattern Preview only | ❌ Manual offset | ✅ Native (`W` Wrap-Around) |
| **Animation Timeline & Onion Skinning** | ✅ Multi-frame red/green temporal overlays + GIF | ✅ Timeline + Onion Skin | ❌ No animation timeline | ✅ Animation Timeline |
| **3D LUT Tetrahedral Simplex Mode** | ✅ 4-simplex subdivision (Zero Banding) | ✅ 3D LUT Color Lookup | ✅ 3D LUT Adjustment | ⚠️ Basic trilinear only |
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
| **Automated Multi-Platform CI/CD** | ✅ GitHub Actions (.dmg, .zip, .exe, AppImage, deb) | ❌ Proprietary Installer | ❌ Proprietary Installer | ✅ Source / Flatpak |
| **Cross-Platform (macOS, Windows, Linux)** | ✅ macOS DMG/ZIP + Windows .exe + Linux AppImage/deb | ❌ Windows & Mac only | ❌ Windows & Mac only | ✅ Linux, Windows & Mac |
| **Lens Correction Profiles (Lensfun Parity)** | ✅ Calibrated profiles (Distortion, TCA, Vignette) | ✅ Lens Profile Creator | ✅ Lens Correction Engine | ⚠️ Lensfun plugin dependency |
| **Vector Variable-Width Stroke Profiling** | ✅ Dynamic arc-length normal ribbon profiles | ⚠️ Stroke profiles / Width Tool | ✅ Pressure / Width Profiles | ❌ Uniform strokes only |
| **Spot Color Prepress Inks & Plates** | ✅ 8-bit density buffers + Pantone/Metallic/White | ✅ Native Spot Channels | ✅ Spot Inks | ❌ CMYK/RGB only |
| **Multi-Exposure HDR Exposure Fusion** | ✅ Mertens multi-scale Laplacian pyramid fusion | ✅ Merge to HDR Pro | ✅ HDR Merge | ⚠️ CLI enfuse only |
| **3-Way Color Wheels Grading (Lift/Gamma/Gain)** | ✅ Cinema-grade 2D chromaticity vector pucks | ⚠️ Color Balance sliders only | ⚠️ Color balance only | ⚠️ Color balance only |
| **Perspective Warp Studio (Multi-Plane)** | ✅ Two-phase connected quads with shared hinges | ✅ Perspective Warp | ❌ Single plane only | ❌ Perspective tool only |
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

### 🔍 Automatic Lens Profile Calibration Database (Lensfun Parity)
- Zero-dependency built-in camera & lens optical calibration database (`LensProfileDatabase`):
  - Calibrated profiles for Canon RF/EF, Sony FE GM, Nikon NIKKOR Z, Sigma Art, Tamron, and Fisheye/Action systems.
  - Automatically compensates radial polynomial barrel/pincushion distortion ($r_d = r(1 + k_1 r^2 + k_2 r^4)$).
  - Lateral chromatic aberration correction (transverse color fringing cancellation across red/cyan and blue/yellow channels).
  - Optical vignetting illumination restoration ($\cos^4 \theta$ falloff compensation with adjustable midpoint).

### 🖋️ Non-Destructive Vector Variable-Width Stroke Profiler
- Analytical arc-length normalized normal offset ribbon generator (`VectorStrokeProfiler`):
  - Replaces rigid uniform strokes with continuous width modulation functions: `uniform`, `taper_both`, `taper_start`, `taper_end`, `flare_ends`, `bulge_center`, and `calligraphy`.
  - Calculates dynamic tangent normals $\mathbf{n}(t) = (-y'(t), x'(t))$ to project left and right boundary polygon ribbons.
  - Full non-destructive integration with the Pen Tool, Curvature Tool, and Paths panel.

### 🖨️ Prepress Spot Color Channels & Custom Inks Engine
- Professional print production spot ink management (`SpotColorManager`):
  - Dedicated 8-bit density raster buffers ($0-255$, where $255 = 100\%$ ink coverage) independent of composite RGB/CMYK channels.
  - Color preview tint mapping with adjustable ink solidity and opacity (e.g. Pantone 185 C, Reflex Blue C, Metallic Gold 871 C, Silver 877 C, White Ink Underbase, Clear Gloss Varnish).
  - Prepress plate isolation: generates isolated high-contrast film separation negatives/positives for specialty physical printing plates.

### 🔄 Infinite Seamless Canvas Wrap-Around View & Brush Wrap (`Shift+W`)
- Krita / Photoshop pattern painting parity via `WrapAroundEngine`:
  - Infinite 9-quadrant toroidal canvas viewport projection rendering seamless repeating tiles around the active canvas.
  - Seamless edge-wrapping brush engine: dabs crossing canvas edges wrap toroidally $(x \pmod W, y \pmod H)$ to opposite borders and all 4 corners simultaneously.
  - Bidirectional coordinate mapping allows painting or selecting directly across boundary tiles without seam artifacts.

### 🎞️ Animation Timeline Onion Skinning Engine
- Temporal frame animation overlay engine integrated with `TimelineManager`:
  - Non-destructive semi-transparent onion skin overlays showing previous frame(s) tinted red and next frame(s) tinted green directly in the active canvas viewport.
  - Configurable past/future frame spans (1–5 frames) and opacity decay inversely proportional to temporal frame distance.
  - 100% pure vanilla JS NeuQuant 256-color palette quantized animated `.gif` export.

### 💎 3D LUT Tetrahedral Simplex Decomposition Mode (`.cube`)
- Hollywood cinema-grade color lookup grading via 4-simplex subdivision:
  - Decomposes each unit color cube into 6 tetrahedra along the diagonal axis, sampling only 4 lattice vertices instead of 8.
  - Eliminates diagonal chromatic interpolation artifacts, posterization, and shadow banding inherent to conventional trilinear interpolation.
  - Seamlessly applies to both raster layers and non-destructive Color Lookup adjustment layers.

### 🌅 Multi-Exposure HDR Exposure Fusion Engine
- Mertens-Kautz-Van Reeth (2007) exposure blending via `ExposureFusionEngine`:
  - Directly fuses bracketed exposure stacks (-2EV, 0EV, +2EV) without requiring an intermediate 32-bit floating-point radiance map or tone-reproduction curves.
  - Evaluates 3 per-pixel quality metrics: **Contrast** (discrete 3x3 Laplacian filter $|\nabla^2 L|$), **Saturation** (standard deviation across RGB channels), and **Well-Exposedness** (Gaussian curve centered at 0.5 with $\sigma=0.2$).
  - Multi-scale Laplacian & Gaussian pyramid decomposition across configurable octave depths prevents edge halos, seam boundaries, and shadow noise.

### 🎡 3-Way Color Wheels Grading Studio (Lift, Gamma, Gain)
- Cinematic digital color balance workflow via `ColorWheelsEngine`:
  - 3 interactive HTML5 circular color grading vector wheels: **Lift (Shadows)** with $(1 - Y)^2$ falloff, **Gamma (Midtones)** with $4Y(1 - Y)$ parabolic curve, and **Gain (Highlights)** with $Y^2$ growth.
  - Interactive 2D chromaticity pucks drag smoothly across polar color discs to inject hue/saturation offsets into targeted tonal zones.
  - Master luminance offset sliders per wheel, plus global Rec.709 saturation and contrast controls.

### 📐 Perspective Warp Studio (Multi-Plane Planar Mesh)
- Photoshop parity architectural transformation via `PerspectiveWarpEngine`:
  - **Layout Mode**: Define multiple planar quadrilateral grids over distinct 3D surfaces with automatic corner pin snapping along shared hinge edges.
  - **Warp Mode**: Freely reshape perspective camera angles; shared hinge pins propagate co-movement across adjacent quads to maintain coplanar surface continuity.
  - 8-DOF Direct Linear Transformation (DLT) computes individual $3 \times 3$ projective homography matrices $H_k$ with backward subpixel bilinear texture interpolation.

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
| **`Shift + W`** | Toggle Infinite Seamless Wrap-Around Mode (Krita Parity) |
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

PixelForge Studio is 100% cross-platform compatible on **macOS** (Apple Silicon M1/M2/M3/M4 & Intel x86_64), **Windows**, and **Linux** (Ubuntu, Debian, Fedora, Arch, etc.).

### macOS (Apple Silicon & Intel)
```bash
# 1-Click Launch via shell script (supports trackpad pinch-zoom, native menu & Retina)
chmod +x run-pixelforge-mac.sh
./run-pixelforge-mac.sh

# Or launch directly via terminal
npm start

# Build standalone macOS packages (DMG & ZIP)
npm run dist
```

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

PixelForge Studio maintains **100% test coverage** across all modules with automated regression and black-box component discovery suites (51 test suites total, 100% passing):

```bash
npm test
```

### Verified Test Suites:
- `test-macos-compatibility.js`: macOS entitlements, DMG packaging, ⌘/⌥/⇧ symbol rendering, trackpad pinch-zoom, and native application menu bar (**Passed**).
- `test-exposure-wheels-perspective.js`: Mertens multi-exposure HDR fusion, 3-way color grading wheels, and multi-plane perspective warp studio (**Passed**).
- `test-frontiers-wrap-onion-lut.js`: Seamless toroidal wrap-around view/brush, animation onion skinning, and 3D LUT tetrahedral simplex interpolation (**Passed**).
- `test-frontiers-gap-closing.js`: Lens profile database, vector variable-width stroke ribbons, spot color prepress channels (**Passed**).
- `test-blackbox-components-audit.js`: Audits all 180 menu actions, 49 tools, and 64 modals (**0 errors**).
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
