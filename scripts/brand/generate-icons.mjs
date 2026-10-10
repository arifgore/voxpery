#!/usr/bin/env node
// Regenerates every app icon from the master logo (apps/web/public/voxpery-logo.svg).
// Each size is rendered from the vector at its exact pixel size, so small icons are not
// downscaled bitmaps. Uses the Playwright Chromium installed for the web app.
//
// Usage: node scripts/brand/generate-icons.mjs   (run `npx playwright install chromium` in apps/web first if needed)
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(join(root, 'apps/web/package.json'))
const { chromium } = require('@playwright/test')

const master = readFileSync(join(root, 'apps/web/public/voxpery-logo.svg'), 'utf8')
const defs = master.match(/<defs>[\s\S]*?<\/defs>/)[0]
const fox = master.match(/<g id="fox">[\s\S]*?<\/g>/)[0]
const tileColor = master.match(/<rect id="tile"[^>]*fill="(#[0-9A-Fa-f]{6})"/)[1]

// Layouts on the 64-unit grid. `scale` shrinks the artwork around the centre.
const VARIANTS = {
  // Rounded tile with a small margin: desktop, tray, favicon, PWA "any", in-app.
  rounded: { plate: `<rect x="2" y="2" width="60" height="60" rx="15" fill="${tileColor}"/>`, scale: 1 },
  // macOS app icon grid: the tile takes about 80% of the canvas.
  macos: { plate: `<rect x="2" y="2" width="60" height="60" rx="13.5" fill="${tileColor}"/>`, scale: 0.8125 },
  // Opaque square: iOS and apple-touch-icon (the OS applies its own mask).
  square: { plate: `<rect width="64" height="64" fill="${tileColor}"/>`, scale: 1, foxScale: 0.86 },
  // PWA maskable: full bleed, artwork inside the 80% safe zone.
  maskable: { plate: `<rect width="64" height="64" fill="${tileColor}"/>`, scale: 1, foxScale: 0.72 },
  // Android round launcher.
  round: { plate: `<circle cx="32" cy="32" r="30" fill="${tileColor}"/>`, scale: 1, foxScale: 0.86 },
  // Android adaptive foreground: artwork only, inside the 66/108 safe zone.
  foreground: { plate: '', scale: 1, foxScale: 0.58 },
}

function svgFor(variant, size) {
  const { plate, scale, foxScale = 1 } = VARIANTS[variant]
  const around = (s, body) => (s === 1 ? body : `<g transform="translate(32 32) scale(${s}) translate(-32 -32)">${body}</g>`)
  const art = plate + around(foxScale, fox.replace('<g id="fox">', '<g>'))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${defs}${around(scale, art)}</svg>`
}

const TARGETS = [
  // Desktop (Tauri bundle, Windows/Linux)
  ['apps/desktop/src-tauri/icons/32x32.png', 'rounded', 32],
  ['apps/desktop/src-tauri/icons/64x64.png', 'rounded', 64],
  ['apps/desktop/src-tauri/icons/128x128.png', 'rounded', 128],
  ['apps/desktop/src-tauri/icons/128x128@2x.png', 'rounded', 256],
  ['apps/desktop/src-tauri/icons/icon.png', 'rounded', 512],
  ['apps/desktop/src-tauri/icons/icon_preview.png', 'rounded', 32],
  ['apps/desktop/src-tauri/icons/tray.png', 'rounded', 64],
  ['apps/desktop/src-tauri/icons/StoreLogo.png', 'rounded', 50],
  ...[30, 44, 71, 89, 107, 142, 150, 284, 310].map((s) => [`apps/desktop/src-tauri/icons/Square${s}x${s}Logo.png`, 'rounded', s]),
  // Android
  ...[['mdpi', 48, 108], ['hdpi', 49, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]].flatMap(([dpi, launcher, fg]) => [
    [`apps/desktop/src-tauri/icons/android/mipmap-${dpi}/ic_launcher.png`, 'rounded', launcher],
    [`apps/desktop/src-tauri/icons/android/mipmap-${dpi}/ic_launcher_round.png`, 'round', launcher],
    [`apps/desktop/src-tauri/icons/android/mipmap-${dpi}/ic_launcher_foreground.png`, 'foreground', fg],
  ]),
  // iOS
  ...[
    ['20x20@1x', 20], ['20x20@2x', 40], ['20x20@2x-1', 40], ['20x20@3x', 60],
    ['29x29@1x', 29], ['29x29@2x', 58], ['29x29@2x-1', 58], ['29x29@3x', 87],
    ['40x40@1x', 40], ['40x40@2x', 80], ['40x40@2x-1', 80], ['40x40@3x', 120],
    ['60x60@2x', 120], ['60x60@3x', 180], ['76x76@1x', 76], ['76x76@2x', 152],
    ['83.5x83.5@2x', 167], ['512@2x', 1024],
  ].map(([name, s]) => [`apps/desktop/src-tauri/icons/ios/AppIcon-${name}.png`, 'square', s]),
  // Web
  ['apps/web/public/1024.png', 'rounded', 1024],
  ['apps/web/public/pwa-192.png', 'rounded', 192],
  ['apps/web/public/pwa-512.png', 'rounded', 512],
  ['apps/web/public/pwa-maskable-512.png', 'maskable', 512],
  ['apps/web/public/favicon-32.png', 'rounded', 32],
  ['apps/web/public/apple-touch-icon.png', 'square', 180],
]

const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 256]
// macOS icns types with PNG payloads.
const ICNS_ENTRIES = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024], ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
const cache = new Map()
async function render(variant, size) {
  const key = `${variant}:${size}`
  if (!cache.has(key)) {
    await page.setViewportSize({ width: Math.max(size, 16), height: Math.max(size, 16) })
    await page.setContent(`<html><body style="margin:0;background:transparent">${svgFor(variant, size)}</body></html>`)
    cache.set(key, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }))
  }
  return cache.get(key)
}

for (const [file, variant, size] of TARGETS) {
  writeFileSync(join(root, file), await render(variant, size))
}

// Windows .ico with PNG frames; the 32 px frame is byte-identical to 32x32.png.
const icoFrames = await Promise.all(ICO_SIZES.map((s) => render('rounded', s)))
const icoHeader = Buffer.alloc(6 + 16 * ICO_SIZES.length)
icoHeader.writeUInt16LE(0, 0)
icoHeader.writeUInt16LE(1, 2)
icoHeader.writeUInt16LE(ICO_SIZES.length, 4)
let offset = icoHeader.length
ICO_SIZES.forEach((s, i) => {
  const entry = 6 + i * 16
  icoHeader.writeUInt8(s === 256 ? 0 : s, entry)
  icoHeader.writeUInt8(s === 256 ? 0 : s, entry + 1)
  icoHeader.writeUInt16LE(1, entry + 4)
  icoHeader.writeUInt16LE(32, entry + 6)
  icoHeader.writeUInt32LE(icoFrames[i].length, entry + 8)
  icoHeader.writeUInt32LE(offset, entry + 12)
  offset += icoFrames[i].length
})
writeFileSync(join(root, 'apps/desktop/src-tauri/icons/icon.ico'), Buffer.concat([icoHeader, ...icoFrames]))

// macOS .icns with the padded macOS layout.
const icnsChunks = []
for (const [type, s] of ICNS_ENTRIES) {
  const data = await render('macos', s)
  const head = Buffer.alloc(8)
  head.write(type, 0, 'ascii')
  head.writeUInt32BE(data.length + 8, 4)
  icnsChunks.push(head, data)
}
const icnsBody = Buffer.concat(icnsChunks)
const icnsHead = Buffer.alloc(8)
icnsHead.write('icns', 0, 'ascii')
icnsHead.writeUInt32BE(icnsBody.length + 8, 4)
writeFileSync(join(root, 'apps/desktop/src-tauri/icons/icon.icns'), Buffer.concat([icnsHead, icnsBody]))

await browser.close()
console.log(`Generated ${TARGETS.length} PNG files, icon.ico and icon.icns from voxpery-logo.svg`)
