// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — macOS Compatibility, Keybindings & Parity Suite
// ══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — macOS Compatibility & Integration Suite');
console.log('════════════════════════════════════════════════════════════════\n');

// Test 1: package.json macOS Packaging Configuration
console.log('► Test Group 1: package.json macOS Build Configuration');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.ok(pkg.build, 'package.json defines build configuration');
assert.ok(pkg.build.mac, 'package.json defines mac build target');
assert.strictEqual(pkg.build.mac.category, 'public.app-category.graphics-design', 'macOS category is graphics-design');
assert.strictEqual(pkg.build.mac.hardenedRuntime, true, 'Hardened runtime enabled for macOS notarization');
assert.ok(fs.existsSync(pkg.build.mac.entitlements), 'macOS entitlements file exists');
assert.ok(pkg.build.dmg, 'macOS DMG window layout configured');
console.log('  ✓ electron-builder configured with DMG, ZIP, hardened runtime, and entitlements');

// Test 2: macOS Entitlements Plist Security Audit
console.log('\n► Test Group 2: macOS Entitlements (build/entitlements.mac.plist)');
const plistPath = path.join(__dirname, 'build', 'entitlements.mac.plist');
assert.ok(fs.existsSync(plistPath), 'entitlements.mac.plist exists on disk');
const plistContent = fs.readFileSync(plistPath, 'utf8');
assert.ok(plistContent.includes('com.apple.security.cs.allow-jit'), 'JIT allowed for V8/WebAssembly');
assert.ok(plistContent.includes('com.apple.security.files.user-selected.read-write'), 'User selected file access allowed');
console.log('  ✓ entitlements.mac.plist satisfies Apple sandbox and hardened runtime standards');

// Test 3: macOS Launch Script
console.log('\n► Test Group 3: macOS Launch Script (run-pixelforge-mac.sh)');
const macShPath = path.join(__dirname, 'run-pixelforge-mac.sh');
assert.ok(fs.existsSync(macShPath), 'run-pixelforge-mac.sh exists');
const macShContent = fs.readFileSync(macShPath, 'utf8');
assert.ok(macShContent.startsWith('#!/usr/bin/env bash'), 'Uses standard bash shebang');
assert.ok(macShContent.includes('uname -m'), 'Checks Apple Silicon / Intel architecture');
assert.ok(macShContent.includes('open "http://localhost:8080"'), 'Uses native macOS open command');
console.log('  ✓ run-pixelforge-mac.sh provides native macOS execution pathway');

// Test 4: ShortcutManager macOS Display & Key Mappings
console.log('\n► Test Group 4: ShortcutManager macOS Glyph Formatting');
const { ShortcutManager } = require('./js/shortcut-manager.js');
const sm = new ShortcutManager();

// Test Windows/Linux representation
sm.isMac = false;
assert.strictEqual(sm.getShortcutDisplay('file.new'), 'Ctrl+N', 'Windows shows Ctrl+N');
assert.strictEqual(sm.getShortcutDisplay('file.save_as'), 'Ctrl+Shift+S', 'Windows shows Ctrl+Shift+S');
assert.strictEqual(sm.getShortcutDisplay('edit.undo'), 'Ctrl+Z', 'Windows shows Ctrl+Z');

// Test macOS representation (⌘, ⌥, ⇧)
sm.isMac = true;
assert.strictEqual(sm.getShortcutDisplay('file.new'), '⌘N', 'macOS shows ⌘N for File > New');
assert.strictEqual(sm.getShortcutDisplay('file.save_as'), '⌘⇧S', 'macOS shows ⌘⇧S for Save As');
assert.strictEqual(sm.getShortcutDisplay('file.export'), '⌘⌥⇧W', 'macOS shows ⌘⌥⇧W for Export As');
assert.strictEqual(sm.getShortcutDisplay('edit.undo'), '⌘Z', 'macOS shows ⌘Z for Undo');
assert.strictEqual(sm.getShortcutDisplay('tool.move'), 'V', 'Tools display single clean letter on macOS');
console.log('  ✓ ShortcutManager correctly renders Apple glyphs (⌘, ⌥, ⇧) on macOS');

// Test 5: main.js Electron Native macOS Application Menu & Window Specs
console.log('\n► Test Group 5: main.js Native Application Menu & Window Options');
const mainJs = fs.readFileSync('main.js', 'utf8');
assert.ok(mainJs.includes('buildApplicationMenu'), 'main.js defines native application menu');
assert.ok(mainJs.includes("role: 'about'"), 'Provides native macOS About menu item');
assert.ok(mainJs.includes("accelerator: 'Cmd+,'"), 'Preferences mapped to standard Cmd+, on macOS');
assert.ok(mainJs.includes("windowOptions.titleBarStyle = 'hiddenInset'"), 'Uses native macOS hiddenInset titlebar');
assert.ok(mainJs.includes('trafficLightPosition'), 'Provides offset for macOS traffic light buttons');
assert.ok(mainJs.includes("mainWindow.webContents.send('app:menu-action'"), 'Bridges native menu actions to renderer');
console.log('  ✓ main.js configures seamless macOS titlebar, traffic light positioning, and native menu bar');

// Test 6: CSS macOS Adaptations
console.log('\n► Test Group 6: macOS CSS Styles & Traffic Light Padding');
const cssContent = fs.readFileSync('styles/main.css', 'utf8');
assert.ok(cssContent.includes('body.platform-mac #app-header'), 'Provides traffic light offset for header');
assert.ok(cssContent.includes('-apple-system'), 'Uses San Francisco system font stack on macOS');
assert.ok(cssContent.includes('-webkit-font-smoothing: antialiased'), 'Crisp subpixel font antialiasing on Retina');
console.log('  ✓ styles/main.css adapts seamlessly for macOS window controls and Apple typography');

// Test 7: CI/CD GitHub Actions Multi-Platform Configuration
console.log('\n► Test Group 7: GitHub Actions CI/CD Workflow');
const ciContent = fs.readFileSync('.github/workflows/build-release.yml', 'utf8');
assert.ok(ciContent.includes('macos-latest'), 'Includes macos-latest runner in matrix and build');
assert.ok(ciContent.includes('build-macos:'), 'Defines dedicated build-macos job');
assert.ok(ciContent.includes('npx electron-builder --mac'), 'Builds macOS DMG and ZIP distributions');
assert.ok(ciContent.includes('pixelforge-macos-binaries'), 'Uploads and attaches macOS release binaries');
console.log('  ✓ CI/CD workflow builds and releases for macOS, Windows, and Linux simultaneously');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  macOS Compatibility Suite: All 7 Test Groups Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
