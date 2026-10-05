#!/usr/bin/env node
/**
 * vm-job: build argv for one tracked background job, and classify the answer.
 * Node built-ins only. The rules every shipped script follows are
 * wiser/standards/script-contract.md. What a user meets is wiser/tools/RUNNING.md.
 */

import { runVmJob } from './vm-job-core.js';

try {
  const result = runVmJob(process.argv.slice(2));
  if (typeof result === 'string') {
    process.stdout.write(result.endsWith('\n') ? result : `${result}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
} catch (error) {
  const message = error instanceof Error && error.message
    ? error.message
    : 'Error: vm-job failed.';
  const line = message.startsWith('Error:') ? message : `Error: vm-job failed: ${message}`;
  process.stderr.write(line.endsWith('\n') ? line : `${line}\n`);
  process.exit(1);
}
