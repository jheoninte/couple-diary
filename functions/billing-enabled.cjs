// Use only after APPLE_PRIVATE_KEY and Apple environment configuration are provisioned.
// Explicit exports keep Scheduler excluded from the beta deployment.
const backend = require('./index.cjs');
exports.diary = backend.diary;
exports.accountDeletion = backend.accountDeletion;
exports.appleBilling = backend.appleBilling;
exports.appleNotifications = backend.appleNotifications;
