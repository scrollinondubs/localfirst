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

console.log('Local First Arizona extension content scripts loaded');