/**
 * Generate placeholder icons for the Chrome extension
 * These are simple colored squares with "LFA" text
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple SVG icon generator
function generateIcon(size) {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#4CAF50"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.3}px" 
          font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">
      LFA
    </text>
  </svg>`;
  return svg;
}

// Convert SVG to PNG-like data URL (for simplicity, we'll save as SVG)
function saveSVGAsFile(svg, filepath) {
  fs.writeFileSync(filepath, svg, 'utf8');
}

// Main function to generate all icons
function generateIcons() {
  const sizes = [16, 32, 48, 128];
  const iconsDir = path.join(__dirname, '..', 'src', 'assets', 'icons');
  
  // Create icons directory if it doesn't exist
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  sizes.forEach(size => {
    const svg = generateIcon(size);
    const filename = `icon-${size}.svg`;
    const filepath = path.join(iconsDir, filename);
    saveSVGAsFile(svg, filepath);
    console.log(`Generated ${filename}`);
  });
  
  // Also create PNG placeholders (empty files for now)
  sizes.forEach(size => {
    const filename = `icon-${size}.png`;
    const filepath = path.join(iconsDir, filename);
    // Create a simple base64 PNG placeholder
    const pngPlaceholder = createPNGPlaceholder(size);
    fs.writeFileSync(filepath, pngPlaceholder);
    console.log(`Generated ${filename}`);
  });
}

// Create a minimal PNG placeholder
function createPNGPlaceholder(size) {
  // This creates a minimal valid PNG file (1x1 green pixel)
  // In production, you'd use a proper image library
  const greenPixelPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, // bit depth: 8, color type: 2 (RGB)
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0xFE, 0xFF, 
    0x00, 0x4C, 0xAF, 0x50, // Green color approximation
    0x9C, 0x3C, 0x11, 0xB7, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  
  return greenPixelPNG;
}

// Run the generator
generateIcons();