/**
 * Main application entry point
 */

import { AppController } from './controllers/AppController.js';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.initialize();
});
