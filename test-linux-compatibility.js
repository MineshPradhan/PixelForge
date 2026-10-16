// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Linux Compatibility & Cross-Platform Suite
// ══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Linux Compatibility & Environment Suite');
console.log('════════════════════════════════════════════════════════════════\n');

// Test 1: Desktop Entry Specification (freedesktop.org standard)
console.log('► Test Group 1: Linux .desktop Entry Verification');
const desktopPath = path.join(__dirname, 'pixelforge.desktop');
assert.ok(fs.existsSync(desktopPath), 'pixelforge.desktop exists');

const desktopContent = fs.readFileSync(desktopPath, 'utf8');
assert.ok(desktopContent.includes('[Desktop Entry]'), 'Contains [Desktop Entry] header');
assert.ok(desktopContent.includes('Name=PixelForge Studio'), 'Valid application name');
assert.ok(desktopContent.includes('Categories=Graphics'), 'Valid Graphics category');
assert.ok(desktopContent.includes('Type=Application'), 'Valid Application type');
assert.ok(desktopContent.includes('MimeType='), 'Registers supported raster & vector MIME types');
console.log('  ✓ pixelforge.desktop complies with freedesktop.org specification');

// Test 2: Linux Shell Launcher Script
console.log('\n► Test Group 2: Linux Launcher Script (run-pixelforge.sh)');
const shPath = path.join(__dirname, 'run-pixelforge.sh');
assert.ok(fs.existsSync(shPath), 'run-pixelforge.sh exists');

const shContent = fs.readFileSync(shPath, 'utf8');
assert.ok(shContent.startsWith('#!/usr/bin/env bash'), 'Uses standard bash shebang');
assert.ok(shContent.includes('electron .'), 'Supports native desktop Electron execution');
assert.ok(shContent.includes('server.js'), 'Supports web server fallback mode');
console.log('  ✓ run-pixelforge.sh provides robust desktop & web launch pathways');

// Test 3: Linux Packaging Configuration in package.json
console.log('\n► Test Group 3: package.json Linux Build Configuration');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.ok(pkg.build, 'package.json contains build configuration');
assert.ok(pkg.build.linux, 'package.json defines linux build targets');
assert.ok(pkg.build.linux.target.includes('AppImage'), 'Builds Linux AppImage');
assert.ok(pkg.build.linux.target.includes('tar.gz'), 'Builds portable tar.gz');
assert.ok(pkg.build.linux.target.includes('deb'), 'Builds Debian/Ubuntu .deb package');
assert.strictEqual(pkg.build.linux.category, 'Graphics', 'Category is Graphics');
console.log('  ✓ electron-builder configured for AppImage, tar.gz, and deb Linux targets');

// Test 4: App Icon Resolution & Format
console.log('\n► Test Group 4: High-Resolution App Icon (assets/icon.png)');
const iconPath = path.join(__dirname, 'assets', 'icon.png');
assert.ok(fs.existsSync(iconPath), 'assets/icon.png exists');

const iconBuf = fs.readFileSync(iconPath);
const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
assert.ok(iconBuf.slice(0, 8).equals(pngSig), 'icon.png has valid PNG binary signature');

// Verify IHDR dimensions (512x512)
const w = iconBuf.readUInt32BE(16);
const h = iconBuf.readUInt32BE(20);
assert.strictEqual(w, 512, 'Icon width is 512px');
assert.strictEqual(h, 512, 'Icon height is 512px');
console.log('  ✓ assets/icon.png is a pristine 512x512 PNG');

// Test 5: Linux Case-Sensitive Filesystem Audit
console.log('\n► Test Group 5: Case-Sensitive Filesystem Link Audit');
const html = fs.readFileSync('index.html', 'utf8');
const scriptMatches = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);

let caseErrors = 0;
scriptMatches.forEach(relPath => {
  const fullPath = path.join(__dirname, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`  ✗ Missing script path: ${relPath}`);
    caseErrors++;
    return;
  }
  // Verify exact casing on disk
  const dir = path.dirname(fullPath);
  const base = path.basename(fullPath);
  const realFiles = fs.readdirSync(dir);
  if (!realFiles.includes(base)) {
    console.error(`  ✗ Case mismatch on disk for: ${relPath}`);
    caseErrors++;
  }
});
assert.strictEqual(caseErrors, 0, 'Zero case-sensitivity mismatches across all scripts');
console.log(`  ✓ All ${scriptMatches.length} script paths strictly match on-disk file casing`);

// Test 6: Cross-Platform Electron Main Process
console.log('\n► Test Group 6: Electron Main Process Linux Window Handling');
const mainCode = fs.readFileSync('main.js', 'utf8');
assert.ok(mainCode.includes("process.platform === 'linux'"), 'main.js detects Linux platform');
assert.ok(mainCode.includes('windowOptions.frame = true'), 'main.js enables standard window frame on Linux');
console.log('  ✓ main.js manages Linux window manager frame decoration correctly');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  Linux Compatibility Suite: All 6 Test Groups Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
