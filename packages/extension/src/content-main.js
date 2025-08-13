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

// Add a persistent green bar at the top with filter controls
const statusBar = document.createElement('div');
statusBar.id = 'lfa-status-bar';
statusBar.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 35px;
  background: linear-gradient(90deg, #2E7D32, #4CAF50);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  font-family: Arial, sans-serif;
  font-size: 13px;
  font-weight: bold;
  z-index: 999999;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
`;

// Create status message
const statusMessage = document.createElement('span');
statusMessage.id = 'lfa-status-message';
statusMessage.textContent = '🏪 Local First Arizona is filtering chain stores';

// Create toggle controls
const toggleContainer = document.createElement('div');
toggleContainer.style.cssText = `
  display: flex;
  align-items: center;
  gap: 10px;
`;

const toggleButton = document.createElement('button');
toggleButton.id = 'lfa-toggle-button';
toggleButton.textContent = 'Switch to Dimming';
toggleButton.style.cssText = `
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  font-weight: bold;
`;

const hideButton = document.createElement('button');
hideButton.textContent = '×';
hideButton.style.cssText = `
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

toggleButton.onclick = function(e) {
  e.stopPropagation();
  // This will be handled by the MapsModifier when it initializes
  window.dispatchEvent(new CustomEvent('lfa-toggle-filter'));
};

hideButton.onclick = function(e) {
  e.stopPropagation();
  statusBar.style.display = 'none';
};

toggleContainer.appendChild(toggleButton);
toggleContainer.appendChild(hideButton);
statusBar.appendChild(statusMessage);
statusBar.appendChild(toggleContainer);

// Add status bar immediately
if (document.body) {
  document.body.appendChild(statusBar);
  document.body.style.marginTop = '35px';
} else {
  // If body doesn't exist yet, wait for it
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(statusBar);
    document.body.style.marginTop = '35px';
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