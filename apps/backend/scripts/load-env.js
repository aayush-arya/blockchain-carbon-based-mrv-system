// Preloaded via `-r` by node-pg-migrate and other CLI tools so they see the
// same root .env that the app itself loads (see src/config/env.ts).
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
