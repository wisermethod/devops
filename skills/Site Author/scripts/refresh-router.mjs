#!/usr/bin/env node
// Refresh only recognized envelope policy passages; preserve local identity.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { currentKit, versionLine } from './envelope.mjs';
import { refreshRouter } from './router.mjs';
console.log(versionLine());
try {
  const { values } = parseArgs({ options: { site: { type: 'string' } } });
  if (!values.site) throw new Error('required: --site <envelope-folder>');
  const envelope = path.resolve(values.site);
  const site = currentKit(envelope);
  const kit = JSON.parse(fs.readFileSync(path.join(site, 'kit.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(kit.kitVersion)) throw new Error('invalid site kitVersion');
  const result = refreshRouter(envelope, kit.kitVersion);
  console.log(result.changed ? `refresh-router: archived AGENTS.md as ${result.archive}; refreshed managed policy` : 'refresh-router: current; unchanged, no archive');
} catch (error) {
  console.error(`refresh-router FAIL: ${error.message}`);
  process.exitCode = 1;
}
