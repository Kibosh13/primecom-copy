// Passenger loads a CommonJS entry point, then the existing ESM server.
process.env.NODE_ENV = 'production';
process.env.DATA_DIR ||= require('node:path').resolve(__dirname, '../../../inquiries');
process.env.CMS_DATA_DIR ||= require('node:path').resolve(__dirname, '../../../content');
import('../../server.mjs').catch(error => {
  console.error('Application startup failed:', error.message);
  process.exitCode = 1;
});
