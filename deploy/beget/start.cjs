// Passenger loads a CommonJS entry point, then the existing ESM server.
process.env.NODE_ENV = 'production';
process.env.DATA_DIR ||= require('node:path').resolve(__dirname, '../../../inquiries');
process.env.CMS_DATA_DIR ||= require('node:path').resolve(__dirname, '../../../content');
process.env.MAIL_SENDMAIL ||= '/usr/local/bin/sendmail';
process.env.MAIL_FROM ||= 'website@infoprab.beget.tech';
import('../../server.mjs').catch(error => {
  console.error('Application startup failed:', error.message);
  process.exitCode = 1;
});
