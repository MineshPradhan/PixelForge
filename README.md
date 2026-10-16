# PixelForge Studio 🎨

> **A professional, high-performance Photoshop alternative software for Windows.**
> Built with HTML5 Canvas, modern JavaScript (ES6+), and Electron.

---

## 🌟 Advanced Pro Features

### 📐 Free Transform (`Ctrl + T`)
- Interactive bounding box with **8 resize/scaling handles** and a dedicated **rotation pin**.
- Scale, stretch, and rotate any layer with real-time on-canvas visual preview.
- Press **`Enter`** to commit transformations, or **`Escape`** to cancel.

### 🪄 Magic Wand Selection (`W`)
- Contiguous and global color-range auto-selection tool with adjustable **Tolerance** slider.
- Generates high-precision selection boundaries with animated **Marching Ants** visual feedback.
- Allows clearing, inverting, filling, or masking selected color regions with 1 click.

### 📈 Tone Curves & Levels (`Ctrl + M`)
- **Live Luminance & RGB Histogram**: Real-time pixel distribution analysis.
- **Interactive Spline Curve Graph**: Add and drag anchor points to sculpt shadows, midtones, and highlights.
- **Tone Presets**: *Linear (Reset), S-Curve (Punchy Contrast), Brighten, Deep Shadows, Vintage Matte Tone, and Invert Negative*.
- Dedicated **Shadows (Black Level)**, **Highlights (White Level)**, and **Gamma (Midtones)** input sliders.

### 🎭 Non-Destructive Layer Masks
- Click **Add Layer Mask (`⚆`)** in the Layers palette to create a dedicated mask channel.
- Paint in **Black** to hide pixels (alpha mask) or **White** to reveal them without permanently deleting original image data.
- Dual thumbnails in the Layers panel: click layer thumbnail to edit pixels, click mask thumbnail to edit the mask.
- Right-click or menu to **Apply / Remove** mask anytime.

### 🖊️ Stylus & Tablet Pressure Sensitivity
- Supports Wacom, Microsoft Surface Pen, Huion, and XP-Pen drawing tablets via the W3C Pointer Events standard.
- Toggle **`Stylus 🖊`** in the tool options bar to dynamically scale brush thickness and opacity based on physical pen pressure.

### 📏 Interactive Canvas Rulers (`Ctrl + R`)
- Horizontal and vertical pixel rulers with sub-pixel tick markings that dynamically scale and align with document zoom and pan.
- Toggle visibility on/off anytime with `Ctrl + R`.

### 🎛️ Responsive Tool Options Bar & Horizontal Scroll
- Complete access to all tool options, sliders, and controls even on compact or high-DPI displays.
- Smooth horizontal scrolling with mouse wheel (`wheel` delta mapping) or custom scrollbar.

### ↔️ Draggable Side Panel Resizer
- Dedicated click-and-drag splitter handle between the canvas workspace and right docks.
- Real-time responsive panel resizing clamped between 180px and 65% of viewport width.
- Double-click the splitter handle anytime to instantly reset to the default 280px width.
- Remembers and restores your customized dock width automatically across app sessions.

### 🛠️ Photoshop-Inspired Toolbar Customizer & Categorized Tool Drawer
- **Left Dock Drawer Handle**: Sleek interactive splitter handle between the left toolbar and workspace. Clicking it (or the handle knob) opens the comprehensive **Toolbar Customizer & Tool Drawer**.
- **Categorized Component Table**: Every single tool is categorized into 6 core components:
  1. 🎯 *Selection & Navigation* (Move, Marquee Rect/Ellipse, Lasso Freehand/Polygon/Magnetic, Magic Wand, Object Selection, Eyedropper, Hand, Zoom)
  2. ✂️ *Crop & Transformation* (Crop, Content-Aware Move & Extend)
  3. 🩹 *Retouching & Healing* (Spot Healing Brush, Patch Tool, Adjustment Brush, Clone Stamp, History Brush)
  4. 🖌️ *Painting & Erasing* (Paintbrush, Mixer Brush, Pencil, Eraser, Paint Bucket, Gradient)
  5. 💡 *Focus & Tonal Retouch* (Blur, Sharpen, Smudge, Dodge, Burn, Sponge)
  6. ✒️ *Vector, Shapes & Typography* (Bézier Pen, Curvature Pen, Path/Direct Selection, Text, Shape Rect/Rounded/Ellipse/Polygon/Star/Line)
- **Drag-to-Add & Drag-to-Remove**:
  - Drag any tool from the active toolbar table into the **Extra Tools Drawer** to hide/remove it from the left panel.
  - Drag tools back from the Extra Tools Drawer to restore them to the toolbar, or rearrange their ordering within categories.
  - Dedicated **`Remove →`** and **`← Add`** one-click buttons for rapid management.
- **Classic Photoshop Parity**:
  - **Triple-Dot (`...`) Toolbar Button**: Located directly at the bottom of the left toolbar, offering a quick flyout popup of all currently hidden extra tools with instant one-click activation.
  - **`Edit > Toolbar...` Menu Entry**: Familiar standard Photoshop shortcut to open the tool customizer.
  - **Workflow Presets**: 1-click presets for *Photoshop Default (All Tools)*, *Digital Painter*, *Photo Retoucher*, *Design & Vector*, and *Minimalist*.
- **Live Toolbar Sync & Persistence**: Custom layouts sync instantly with the left palette and persist across app reboots via `localStorage`.

### 📜 History Management, Right-Click Deletion & Purge
- **Right-Click Deletion**: Right-click on any history state in the History dock panel to delete that specific step or delete all subsequent states.
- **Clear All History**: Dedicated purge button in the panel header allows flushing the undo/redo stack to free memory while preserving the active canvas state.
- **Safety Confirmation Modals**: Every deletion action triggers a stylized confirmation popup window asking for explicit user confirmation before modifying the history timeline.

### 💾 Native Project File Format (`.pforge`)
- Save your work with all layers, layer masks, names, blend modes, and opacity preserved using **`Ctrl + Shift + S`**.
- Reopen `.pforge` project bundles anytime to resume editing seamlessly.

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

---

## 🎨 Complete Toolset Summary

| Tool | Shortcut | Description |
| :--- | :---: | :--- |
| **Move Tool** | `V` | Translate and reposition active layer content. |
| **Marquee Selection** | `M` | Rectangular & elliptical selection with animated marching ants. |
| **Magic Wand** | `W` | 1-click contiguous color-range auto selection. |
| **Crop Tool** | `C` | Crop document dimensions and trim all layers. |
| **Paintbrush** | `B` | Soft & hard anti-aliased brushes with pressure dynamics. |
| **Pencil** | `P` | 1px pixel-crisp line and pixel art engine. |
| **Eraser** | `E` | Non-destructive or destructive alpha transparency eraser. |
| **Paint Bucket** | `G` | Fast BFS scanline flood fill with tolerance. |
| **Text Tool** | `T` | Stamp styled text with custom font family, size, bold, italic. |
| **Shapes** | `U` | Interactive Rectangles, Ellipses, and Lines. |
| **Eyedropper** | `I` | Sample RGB color from composited canvas. |
| **Hand / Pan** | `H` or `Space` | Drag and pan across large document viewports. |
| **Zoom Tool** | `Z` | Left-click to zoom in, Alt+Click to zoom out. |

---

## ⌨️ Complete Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| **Ctrl + T** | Free Transform (Scale / Rotate active layer) |
| **Ctrl + M** | Tone Curves & Levels Histogram Tool |
| **Ctrl + R** | Show / Hide Canvas Rulers |
| **Ctrl + Shift + S** | Save Project File (`.pforge`) |
| **Ctrl + S** | Export / Save Flattened Image |
| **Ctrl + O** | Open Image File |
| **Ctrl + N** | New Canvas Document Dialog |
| **Ctrl + Z** | Undo History State |
| **Ctrl + Y** (or **Ctrl + Shift + Z**) | Redo History State |
| **Ctrl + A** | Select All |
| **Ctrl + D** | Deselect |
| **Ctrl + J** | Duplicate Active Layer |
| **Ctrl + E** | Merge Active Layer Down |
| **Del / Backspace** | Clear Active Selection or Layer |
| **X** | Swap Foreground & Background Colors |
| **D** | Reset to Default Black & White |
| **[ / ]** | Decrease / Increase Brush Diameter |
| **Ctrl + + / -** | Zoom In / Out |
| **Ctrl + 0** | Fit Document to Screen |
| **Ctrl + 1** | 100% Actual Size View |
| **Enter** | Commit Free Transform |
| **Escape** | Cancel Free Transform |

---

## Running on Windows

### Quick Option 1: 1-Click Launch
Double-click [`run-pixelforge.bat`](file:///C:/Users/Minesh/Downloads/Do_It/PixelForge/run-pixelforge.bat):
- Press `1` for Instant Web Mode (`http://localhost:3000`).
- Press `2` for Native Desktop App (`npm start`).
- Press `3` to Build Standalone Windows `.exe` Installer (`npm run dist`).

### Quick Option 2: Terminal
```powershell
cd C:\Users\Minesh\Downloads\Do_It\PixelForge

# Run Desktop Window
npm start

# Build Standalone Windows .exe Installer
npm run dist
```
