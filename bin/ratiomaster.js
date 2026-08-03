#!/usr/bin/env node

import { runCLI } from '../src/cli.js';

runCLI(process.argv).catch((err) => {
  console.error('\nFatal Error:', err.message || err);
  process.exit(1);
});
