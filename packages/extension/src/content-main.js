/**
 * Main entry point for content scripts
 * This file bundles all content scripts into a single file for Chrome
 */

// Import all the modules in the correct order
import './shared/constants.js';
import './shared/api-client.js';
import './shared/business-matcher.js';
import './content-scripts/business-detector.js';
import './content-scripts/ui-injector.js';
import './content-scripts/maps-modifier.js';

console.log('🏪 LOCAL FIRST ARIZONA EXTENSION - CONTENT SCRIPT STARTING');
console.warn('🏪 LFA DEBUG: Content script file loaded at', new Date().toISOString());
window.LFA_EXTENSION_LOADED = true;

// Add a persistent green bar at the top to confirm extension is running
const statusBar = document.createElement('div');
statusBar.id = 'lfa-status-bar';
statusBar.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 30px;
  background: linear-gradient(90deg, #2E7D32, #4CAF50);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Arial, sans-serif;
  font-size: 14px;
  font-weight: bold;
  z-index: 999999;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  cursor: pointer;
`;
statusBar.innerHTML = '🏪 Local First Arizona Extension Active - Click to hide';
statusBar.onclick = function() {
  this.style.display = 'none';
};

// Add status bar immediately
if (document.body) {
  document.body.appendChild(statusBar);
  document.body.style.marginTop = '30px';
} else {
  // If body doesn't exist yet, wait for it
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(statusBar);
    document.body.style.marginTop = '30px';
  });
}

// Also add the temporary indicator
setTimeout(() => {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    top: 40px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `;
  indicator.textContent = 'LFA Extension Loaded Successfully!';
  document.body.appendChild(indicator);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }, 3000);
}, 1000);