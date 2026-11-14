// Minimal internal TestFlight backend: no scheduled jobs or Apple secret provisioning.
process.env.DIARY_TESTFLIGHT_BACKEND = 'true';
const backend = require('./index.cjs');
exports.diary = backend.diary;
exports.accountDeletion = backend.accountDeletion;
