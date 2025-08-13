#!/usr/bin/env node

/**
 * Build script for Chrome extension
 * Builds each entry point separately and copies static files
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function buildFile(target) {
  console.log(`Building ${target}...`);
  try {
    const { stdout, stderr } = await execAsync(
      `BUILD_TARGET=${target} npx vite build`,
      { cwd: rootDir }
    );
    if (stderr) console.error(stderr);
    if (stdout) console.log(stdout);
    console.log(`✓ Built ${target}`);
  } catch (error) {
    console.error(`✗ Failed to build ${target}:`, error.message);
    throw error;
  }
}

async function copyStaticFiles() {
  console.log('Copying static files...');
  
  const distDir = path.join(rootDir, 'dist');
  
  // Create directories
  const dirs = ['assets/icons', 'assets/badges', 'assets/styles', 'popup', 'background'];
  dirs.forEach(dir => {
    const fullPath = path.join(distDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
  
  // Copy manifest
  const manifestSrc = path.join(rootDir, 'public/manifest.json');
  const manifestDest = path.join(distDir, 'manifest.json');
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, manifestDest);
    console.log('✓ Copied manifest.json');
  }
  
  // Copy CSS
  const cssSrc = path.join(rootDir, 'src/assets/styles/content.css');
  const cssDest = path.join(distDir, 'assets/styles/content.css');
  if (fs.existsSync(cssSrc)) {
    fs.copyFileSync(cssSrc, cssDest);
    console.log('✓ Copied content.css');
  }
  
  // Copy icons
  const iconsDir = path.join(rootDir, 'src/assets/icons');
  const iconsDest = path.join(distDir, 'assets/icons');
  if (fs.existsSync(iconsDir)) {
    const files = fs.readdirSync(iconsDir);
    files.forEach(file => {
      if (file.endsWith('.png')) {
        fs.copyFileSync(
          path.join(iconsDir, file),
          path.join(iconsDest, file)
        );
      }
    });
    console.log('✓ Copied icons');
  }
  
  // Copy popup files
  const popupHtmlSrc = path.join(rootDir, 'src/popup/popup.html');
  if (fs.existsSync(popupHtmlSrc)) {
    fs.copyFileSync(popupHtmlSrc, path.join(distDir, 'popup/popup.html'));
    console.log('✓ Copied popup.html');
  }
  
  const popupCssSrc = path.join(rootDir, 'src/popup/popup.css');
  if (fs.existsSync(popupCssSrc)) {
    fs.copyFileSync(popupCssSrc, path.join(distDir, 'popup/popup.css'));
    console.log('✓ Copied popup.css');
  }
}

async function build() {
  console.log('🔨 Building Chrome Extension...\n');
  
  try {
    // Clean dist directory
    const distDir = path.join(rootDir, 'dist');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir);
    
    // Build each target separately
    await buildFile('content');
    await buildFile('background');
    await buildFile('popup');
    
    // Copy static files
    await copyStaticFiles();
    
    console.log('\n✅ Build complete! Extension ready in dist/ folder');
    console.log('📦 Load the dist/ folder in Chrome Extensions page');
    
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run the build
build();