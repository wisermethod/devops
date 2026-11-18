// Offline synthetic envelopes only. Never reads a member site or builds Astro.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assessRouter, refreshCommand, refreshRouter } from '../../scripts/router.mjs';
const SKILL = fileURLToPath(new URL('../..', import.meta.url));
const KIT = path.join(SKILL, 'kit');
const CURRENT = fs.readFileSync(path.join(SKILL, 'site-AGENTS.md'), 'utf8');
const PRIOR = fs.readFileSync(new URL('./fixtures/pre-split-AGENTS.md', import.meta.url), 'utf8');
const scratch = [];
after(() => { for (const dir of scratch) fs.rmSync(dir, { recursive: true, force: true }); });
function render(text, version = '0.5.0') {
  return text.replaceAll('{{domain}}', 'example.test').replaceAll('{{siteUrl}}', 'https://example.test')
    .replaceAll('{{kitVersion}}', version).replaceAll('{{provides}}', 'voice: memory/site-voice.md\nabout: memory/site-about.md');
}
function envelope(text = CURRENT, version = '0.5.0', full = false) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'router-regression-')));
  scratch.push(dir);
  if (full) fs.cpSync(KIT, path.join(dir, 'site'), { recursive: true, filter: (src) => !/[/\\](?:node_modules|dist|\.astro|zArchive)(?:[/\\]|$)/.test(src) });
  else fs.mkdirSync(path.join(dir, 'site'));
  const kit = full ? JSON.parse(fs.readFileSync(path.join(dir, 'site/kit.json'), 'utf8')) : {};
  Object.assign(kit, { domain: 'example.test', siteUrl: 'https://example.test', kitVersion: version });
  fs.writeFileSync(path.join(dir, 'site/kit.json'), JSON.stringify(kit));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), render(text, version));
  return dir;
}
function read(dir) { return fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'); }
function archives(dir) { return fs.existsSync(path.join(dir, 'zArchive')) ? fs.readdirSync(path.join(dir, 'zArchive')) : []; }
function command(name, args) { return spawnSync(process.execPath, [path.join(SKILL, 'scripts', name), ...args], { encoding: 'utf8' }); }
function unchangedRefusal(dir, pattern) {
  const original = read(dir);
  const oldArchives = archives(dir);
  assert.throws(() => refreshRouter(dir, '0.5.0'), pattern);
  assert.equal(read(dir), original);
  assert.deepEqual(archives(dir), oldArchives);
}

test('pre-split router already naming src/custom migrates all publish instructions, archiving the exact original', () => {
  const dir = envelope(PRIOR);
  assert.ok(read(dir).includes('src/custom/'));
  assert.ok(read(dir).includes('Webmaster Job 3'));
  const old = read(dir);
  const result = refreshRouter(dir, '0.5.0');
  assert.equal(result.changed, true);
  assert.equal(fs.readFileSync(result.archive, 'utf8'), old);
  assert.match(path.basename(result.archive), /^\d\d-\d\d-\d\d V1 - AGENTS\.md$/);
  assert.ok(!read(dir).includes('Webmaster Job 3'));
  assert.ok(read(dir).includes('Site Publisher Job 2'));
  assert.ok(read(dir).includes('pages-contract.sig'));
  assert.ok(read(dir).includes('before the exact-build publish review'));
  assert.ok(read(dir).includes('invoke Site Author Refresh router'));
  assert.equal(assessRouter(dir, '0.5.0').stale, false);
});

test('old canonical envelope without custom-code permission adds only the missing policy', () => {
  const archived = fs.readFileSync(path.join(SKILL, 'zArchive/26-09-24 V1 - site-AGENTS.md'), 'utf8');
  const dir = envelope(archived, '0.1.0');
  refreshRouter(dir, '0.1.0');
  assert.equal(assessRouter(dir, '0.1.0').stale, false);
  assert.ok(read(dir).includes('`site/src/custom/**` is site code'));
  assert.ok(read(dir).includes('Site Publisher Job 2'));
  assert.ok(read(dir).includes('pages-contract.sig'));
});

test('current router is byte-identical, with no archive on first or repeated refresh', () => {
  const dir = envelope();
  const original = fs.readFileSync(path.join(dir, 'AGENTS.md'));
  for (let n = 0; n < 2; n++) assert.deepEqual(refreshRouter(dir, '0.5.0'), { changed: false });
  assert.ok(fs.readFileSync(path.join(dir, 'AGENTS.md')).equals(original));
  assert.deepEqual(archives(dir), []);
});

test('current CRLF router with extra frontmatter remains byte-identical', () => {
  const text = CURRENT.replace('kitVersion: {{kitVersion}}', 'kitVersion: {{kitVersion}}\nlocal_policy: keep').replaceAll('\n', '\r\n');
  const dir = envelope(text);
  const original = read(dir);
  assert.deepEqual(refreshRouter(dir, '0.5.0'), { changed: false });
  assert.equal(read(dir), original);
  assert.deepEqual(archives(dir), []);
});

test('local identity, Provides, origin, prose and additional restrictions survive a canonical migration byte for byte', () => {
  const local = PRIOR.replace('# {{domain}}', '# Local site identity').replace('## Content vs code', 'Local purpose: a public research library.\n\n## Content vs code')
    .replace('## Check and preview', '## Site-local restrictions\n\nLocal restriction: Do not change the research downloads without the librarian.\n\n## Check and preview')
    + '\n## Local restrictions\n\nNever publish private research notes.\n';
  const dir = envelope(local);
  const original = read(dir);
  refreshRouter(dir, '0.5.0');
  for (const text of ['# Local site identity', 'voice: memory/site-voice.md\nabout: memory/site-about.md', 'https://example.test', 'Local purpose: a public research library.', 'Local restriction: Do not change the research downloads without the librarian.', '## Local restrictions\n\nNever publish private research notes.']) {
    assert.ok(original.includes(text));
    assert.ok(read(dir).includes(text), text);
  }
});

test('version refresh touches only its actual frontmatter line, preserving earlier local version prose', () => {
  const text = CURRENT.replace('domain: {{domain}}', 'local_note: "kitVersion: 0.4.3"\ndomain: {{domain}}');
  const dir = envelope(text, '0.4.3');
  refreshRouter(dir, '0.5.0');
  assert.ok(read(dir).includes('local_note: "kitVersion: 0.4.3"\n'));
  assert.match(read(dir), /^kitVersion: 0\.5\.0$/m);
  assert.equal(assessRouter(dir, '0.5.0').stale, false);
});

test('missing release-staging boundary in otherwise current router is repaired', () => {
  const stale = CURRENT.replace(/ Cloudflare Pages may stage only.*?changes no kit code or content path\./, '');
  const dir = envelope(stale);
  assert.equal(assessRouter(dir, '0.5.0').stale, true);
  refreshRouter(dir, '0.5.0');
  assert.equal(read(dir), render(CURRENT));
});

test('an edited release-staging boundary stops untouched for a named reconciliation', () => {
  const dir = envelope(CURRENT.replace('before the exact-build publish review', 'after the exact-build publish review'));
  unchangedRefusal(dir, /custom managed passage in Publish boundary.*next action: Site Author Refresh router: reconcile/);
});

for (const [label, text] of [
  ['customized canonical policy', PRIOR.replace('Content jobs may change', 'Content jobs may change approved-only')],
  ['duplicate section', `${PRIOR}\n## Publish boundary\n\nLocal publish.\n`],
  ['case-ambiguous section', `${PRIOR}\n## publish boundary\n\nLocal publish.\n`],
  ['indented duplicate section', PRIOR+'\n ## Content vs code\n'],
  ['nested managed section', PRIOR.replace('## Check and preview', '### Check and preview')],
  ['missing section', PRIOR.replace('## Publish boundary', '## Other publication')],
  ['ambiguous additional publish policy', PRIOR+'\nCustom procedure: publish using a borrowed signature.\n'],
  ['custom stale gate', PRIOR+'\n## Local workflow\n\nWebmaster Job 3 approves publication.\n'],
]) {
  test(`${label} refuses without router mutation or archive`, () => {
    const dir = envelope(text);
    unchangedRefusal(dir, /next action: Site Author Refresh router: reconcile/);
  });
}

for (const kind of ['router symlink', 'dangling router symlink', 'unreadable router', 'archive symlink', 'dangling archive symlink', 'archive file', 'archive entry symlink']) {
  test(`${kind} refuses before router mutation`, () => {
    const dir = envelope(PRIOR);
    const file = path.join(dir, 'AGENTS.md');
    const original = read(dir);
    const target = path.join(dir, 'original-router.md');
    if (kind.includes('router symlink')) {
      fs.renameSync(file, target);
      fs.symlinkSync(kind.startsWith('dangling') ? path.join(dir, 'absent') : target, file);
    } else if (kind === 'unreadable router') fs.chmodSync(file, 0);
    else if (kind.includes('archive symlink')) {
      const dest = path.join(dir, 'archive-target');
      if (!kind.startsWith('dangling')) fs.mkdirSync(dest);
      fs.symlinkSync(dest, path.join(dir, 'zArchive'));
    } else if (kind === 'archive file') fs.writeFileSync(path.join(dir, 'zArchive'), 'not a directory');
    else {
      fs.mkdirSync(path.join(dir, 'zArchive'));
      fs.symlinkSync(path.join(dir, 'absent'), path.join(dir, 'zArchive', `${new Date().toISOString().slice(2, 10)} V1 - AGENTS.md`));
    }
    assert.throws(() => refreshRouter(dir, '0.5.0'), /symbolic link|unreadable|unsafe/);
    if (kind === 'unreadable router') fs.chmodSync(file, 0o644);
    assert.equal(fs.readFileSync(kind.includes('router symlink') ? target : file, 'utf8'), original);
    if (kind === 'archive symlink') assert.deepEqual(fs.readdirSync(path.join(dir, 'archive-target')), []);
  });
}

test('Check refuses a stale publish router read-only and prints the exact runnable repair command', () => {
  const dir = envelope(PRIOR, '0.5.0', true);
  const before = read(dir);
  const checked = command('check.mjs', [dir]);
  assert.equal(checked.status, 1, checked.stderr+checked.stdout);
  assert.ok(checked.stderr.includes(refreshCommand(dir)), checked.stderr);
  assert.equal(read(dir), before);
  assert.deepEqual(archives(dir), []);
  const fixed = command('refresh-router.mjs', ['--site', dir]);
  assert.equal(fixed.status, 0, fixed.stderr);
  const checkedAgain = command('check.mjs', [dir]);
  assert.equal(checkedAgain.status, 0, checkedAgain.stderr+checkedAgain.stdout);
});

test('Upgrade refreshes through the shared path before kit replacement and updates router version afterward', () => {
  const dir = envelope(PRIOR, '0.4.3', true);
  const before = read(dir);
  const out = command('upgrade.mjs', ['--site', dir, '--kit', KIT]);
  assert.equal(out.status, 0, out.stderr+out.stdout);
  assert.equal(assessRouter(dir, '0.5.0').stale, false);
  assert.ok(archives(dir).some((name) => fs.readFileSync(path.join(dir, 'zArchive', name), 'utf8') === before));
  assert.match(read(dir), /kitVersion: 0\.5\.0/);
  assert.ok(!out.stdout.includes('was not touched'));
  const check = command('check.mjs', [dir]);
  assert.equal(check.status, 0, check.stderr+check.stdout);
});

test('Upgrade refuses ambiguous router before replacing any kit file', () => {
  const dir = envelope(PRIOR.replace('Host payload is', 'Host payload is locally'), '0.4.3', true);
  const config = fs.readFileSync(path.join(dir, 'site/kit.json'));
  const old = read(dir);
  fs.writeFileSync(path.join(dir, 'site/KIT.md'), 'older kit sentinel');
  const out = command('upgrade.mjs', ['--site', dir, '--kit', KIT]);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /next action: Site Author Refresh router: reconcile/);
  assert.equal(read(dir), old);
  assert.ok(fs.readFileSync(path.join(dir, 'site/kit.json')).equals(config));
  assert.equal(fs.readFileSync(path.join(dir, 'site/KIT.md'), 'utf8'), 'older kit sentinel');
  assert.deepEqual(archives(dir), []);
});

function snapshot(dir) {
  const result = {};
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      const key = path.relative(dir, file);
      if (entry.isDirectory()) { result[key] = 'directory'; walk(file); }
      else result[key] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  }
  walk(dir);
  return result;
}
function allPathsRefuse(text, pattern = /next action: Site Author Refresh router: reconcile/, configure = () => {}) {
  const dir = envelope(text, '0.5.0', true);
  configure(dir);
  // Include an existing recovery file so refusal proves it is untouched too.
  fs.mkdirSync(path.join(dir, 'zArchive'));
  fs.writeFileSync(path.join(dir, 'zArchive/prior-recovery.md'), 'recovery sentinel\n');
  const before = snapshot(dir);
  assert.throws(() => assessRouter(dir, '0.5.0'), pattern);
  assert.deepEqual(snapshot(dir), before);
  assert.throws(() => refreshRouter(dir, '0.5.0'), pattern);
  assert.deepEqual(snapshot(dir), before);
  const refresh = command('refresh-router.mjs', ['--site', dir]);
  assert.equal(refresh.status, 1, refresh.stdout + refresh.stderr);
  assert.match(refresh.stderr, pattern);
  assert.deepEqual(snapshot(dir), before);
  const check = command('check.mjs', [dir]);
  assert.equal(check.status, 1, check.stdout + check.stderr);
  assert.match(check.stderr, pattern);
  assert.deepEqual(snapshot(dir), before);
  return check;
}
const managed = ['Content vs code', 'Check and preview', 'Publish boundary'];
function reordered(template, order) {
  const prefix = template.slice(0, template.indexOf('## Content vs code'));
  const parts = Object.fromEntries(managed.map((heading) => {
    const start = template.indexOf(`## ${heading}`);
    const end = template.indexOf('\n## ', start + 1);
    return [heading, template.slice(start, end < 0 ? undefined : end).trimEnd() + '\n\n'];
  }));
  return prefix + order.map((heading, i) => parts[heading]
    + `## Local notes ${i}\n\nLocal restriction: Do not change the research downloads without the librarian.\n\n`).join('');
}
const permutations = managed.flatMap((first) => managed.filter((h) => h !== first).map((second) => [first, second, ...managed.filter((h) => h !== first && h !== second)]));
for (const order of permutations) {
  test(`pre-split managed section permutation ${order.join(' / ')} refreshes, archives and reassesses cleanly`, () => {
    const dir = envelope(reordered(PRIOR, order), '0.5.0', true);
    const before = snapshot(dir);
    const original = read(dir);
    assert.equal(assessRouter(dir, '0.5.0').stale, true);
    const refreshed = command('refresh-router.mjs', ['--site', dir]);
    assert.equal(refreshed.status, 0, refreshed.stderr);
    assert.equal(archives(dir).length, 1);
    assert.equal(fs.readFileSync(path.join(dir, 'zArchive', archives(dir)[0]), 'utf8'), original);
    const expected = render(reordered(CURRENT, order));
    // The pre-split envelope's identity/Provides/origin/layout prefix is local.
    const oldPrefix = original.slice(0, original.indexOf(`## ${order[0]}`));
    assert.equal(read(dir), oldPrefix + expected.slice(expected.indexOf(`## ${order[0]}`)));
    for (const [file, hash] of Object.entries(before)) if (file !== 'AGENTS.md') assert.equal(snapshot(dir)[file], hash, file);
    assert.equal(assessRouter(dir, '0.5.0').stale, false);
    const check = command('check.mjs', [dir]);
    assert.equal(check.status, 0, check.stderr);
    const stable = snapshot(dir);
    assert.equal(command('refresh-router.mjs', ['--site', dir]).status, 0);
    assert.deepEqual(snapshot(dir), stable);
  });
  test(`current managed section permutation ${order.join(' / ')} stays byte-identical`, () => {
    const dir = envelope(reordered(CURRENT, order));
    const before = snapshot(dir);
    assert.equal(assessRouter(dir, '0.5.0').stale, false);
    assert.deepEqual(refreshRouter(dir, '0.5.0'), { changed: false });
    assert.deepEqual(snapshot(dir), before);
  });
}

const splitAtPolicy = CURRENT.indexOf('## Content vs code');
const prefix = CURRENT.slice(0, splitAtPolicy);
const policy = CURRENT.slice(splitAtPolicy);
for (const [label, wrap] of [
  ['backtick fence', (s) => '```markdown\n' + s + '\n```\n'],
  ['tilde fence', (s) => '~~~markdown\n' + s + '\n~~~\n'],
  ['unclosed backtick fence', (s) => '```markdown\n' + s],
  ['unclosed tilde fence', (s) => '~~~markdown\n' + s],
  ['HTML comment', (s) => '<!--\n' + s + '\n-->\n'],
  ['unclosed HTML comment', (s) => '<!--\n' + s],
  ['partial HTML comment', (s) => '<!-- example ' + s],
  ['indented code spaces', (s) => s.replace(/^/gm, '    ')],
  ['indented code tab', (s) => s.replace(/^/gm, '\t')],
]) {
  test(`${label} cannot supply managed sections`, () => { allPathsRefuse(prefix + wrap(policy)); });
  test(`${label} cannot supply a managed passage`, () => {
    const passage = policy.slice(policy.indexOf('\n\n') + 2, policy.indexOf('\n\n`site/src/custom/'));
    allPathsRefuse(CURRENT.replace(passage, wrap(passage)));
  });
}
for (const [label, wrap] of [
  ['backtick', (s) => '```markdown\n' + s + '\n```\n'],
  ['tilde', (s) => '~~~markdown\n' + s + '\n~~~\n'],
  ['comment', (s) => '<!--\n' + s + '\n-->\n'],
  ['indent', (s) => s.replace(/^/gm, '    ') + '\n'],
]) {
  test(`inactive fake ${label} section before real sections cannot shadow them`, () => {
    const fake = wrap('## Content vs code\n\nNever require a signature for a static build.\n');
    const dir = envelope(prefix + fake + policy, '0.5.0', true);
    const before = snapshot(dir);
    assert.equal(assessRouter(dir, '0.5.0').stale, false);
    assert.equal(command('refresh-router.mjs', ['--site', dir]).status, 0);
    const check = command('check.mjs', [dir]);
    assert.equal(check.status, 0, check.stderr);
    assert.deepEqual(snapshot(dir), before);
  });
}
for (const heading of managed) {
  for (const paragraph of [
    'Do not run the review gate before publishing.',
    'Never require a signature for a static build.',
    'Local restriction: Do not change downloads without the librarian.',
    'Use only the approved spelling of the project name.',
  ]) {
    test(`unknown paragraph in ${heading} refuses regardless of wording: ${paragraph}`, () => {
      allPathsRefuse(CURRENT.replace(`## ${heading}\n`, `## ${heading}\n\n${paragraph}\n`), /custom managed passage/);
    });
  }
}
for (const [label, change] of [
  ['spaced root', (s) => s.replace('domain:', 'root : org\ndomain:')],
  ['spaced type', (s) => s.replace('domain:', 'type : organisation\ndomain:')],
  ['case root', (s) => s.replace('domain:', 'RoOt : org\ndomain:')],
  ['case type', (s) => s.replace('domain:', 'TYPE : Organisation\ndomain:')],
  ['quoted root', (s) => s.replace('domain:', '"root": org\ndomain:')],
  ['duplicate kitVersion', (s) => s.replace('kitVersion:', 'kitVersion: 0.1.0\nkitVersion:')],
  ['quoted duplicate kitVersion', (s) => s.replace('kitVersion:', '"kitVersion": 0.1.0\nkitVersion:')],
  ['single quoted duplicate kitVersion', (s) => s.replace('kitVersion:', "'kitVersion': 0.1.0\nkitVersion:")],
  ['quoted duplicate kitVersion after valid version', (s) => s.replace('kitVersion: {{kitVersion}}', 'kitVersion: {{kitVersion}}\n"kitVersion": 0.1.0')],
  ['indented duplicate kitVersion after valid version', (s) => s.replace('kitVersion: {{kitVersion}}', 'kitVersion: {{kitVersion}}\n  kitVersion: 0.1.0')],
  ['indented duplicate kitVersion', (s) => s.replace('kitVersion:', '  kitVersion: 0.1.0\nkitVersion:')],
  ['duplicate domain', (s) => s.replace('domain:', 'domain: other.test\ndomain:')],
  ['quoted duplicate domain', (s) => s.replace('domain:', '"domain": other.test\ndomain:')],
  ['indented duplicate domain', (s) => s.replace('domain:', '  domain: other.test\ndomain:')],
  ['missing scalar separator', (s) => s.replace('domain: ', 'domain:')],
  ['quoted key', (s) => s.replace('domain:', '"domain":')],
  ['missing domain', (s) => s.replace('domain: {{domain}}\n', '')],
  ['complex key', (s) => s.replace('domain:', '? [domain]\n:')],
  ['anchor', (s) => s.replace('domain:', 'local: &identity example\ndomain:')],
  ['alias', (s) => s.replace('domain:', 'local: *identity\ndomain:')],
  ['tag', (s) => s.replace('domain:', 'local: !!str example\ndomain:')],
  ['literal block', (s) => s.replace('domain:', 'local: |\n  text\ndomain:')],
  ['folded block', (s) => s.replace('domain:', 'local: >\n  text\ndomain:')],
  ['flow map', (s) => s.replace('domain:', 'local: {root: org}\ndomain:')],
  ['flow list', (s) => s.replace('domain:', 'local: [root, org]\ndomain:')],
]) {
  for (const [generation, template] of [['current', CURRENT], ['legacy', PRIOR]]) {
    test(`${generation} frontmatter ${label} stops untouched`, () => { allPathsRefuse(change(template)); });
  }
}
for (const template of [CURRENT, PRIOR]) {
  test(`${template === CURRENT ? 'current' : 'legacy'} flat scalar frontmatter supports spaces and quoted values`, () => {
    const text = template.replace('domain: {{domain}}', 'domain : "{{domain}}"\nlocal: \'O\'\'Brien\'')
      .replace('kitVersion: {{kitVersion}}', "kitVersion : '{{kitVersion}}'");
    const dir = envelope(text, '0.4.3');
    const old = read(dir);
    const result = refreshRouter(dir, '0.5.0');
    assert.equal(result.changed, true);
    assert.equal(fs.readFileSync(result.archive, 'utf8'), old);
    assert.ok(read(dir).includes("kitVersion : '0.5.0'"));
    assert.ok(read(dir).includes('domain : "example.test"\nlocal: \'O\'\'Brien\''));
    assert.equal(assessRouter(dir, '0.5.0').stale, false);
    const stable = snapshot(dir);
    assert.deepEqual(refreshRouter(dir, '0.5.0'), { changed: false });
    assert.deepEqual(snapshot(dir), stable);
  });
}
test('Check keeps primary assessment error and skips dependent router presence claims', () => {
  const text = CURRENT.replace('## Publish boundary\n', '## Publish boundary\n\nDo not run the review gate before publishing.\n');
  const check = allPathsRefuse(text, /custom managed passage in Publish boundary/, (dir) => {
    const file = path.join(dir, 'site/kit.json');
    const kit = JSON.parse(fs.readFileSync(file, 'utf8'));
    kit.collections.articles = false;
    kit.layout = 'single';
    kit.blog = {};
    kit.nav = [];
    kit.footer = [];
    fs.writeFileSync(file, JSON.stringify(kit));
    fs.mkdirSync(path.join(dir, 'site/src/custom'));
  });
  assert.doesNotMatch(check.stderr, /does not mention|predates them|collections\.articles is missing/);
  assert.match(render(text), /`collections\.articles`/);
});

test('pre-split CRLF router refreshes with local bytes and line endings preserved', () => {
  const text = render(reordered(PRIOR, ['Publish boundary', 'Check and preview', 'Content vs code']), '0.4.3').replaceAll('\n', '\r\n');
  const dir = envelope(text, '0.4.3');
  const original = read(dir);
  assert.ok(!/(?<!\r)\n/.test(original));
  const result = refreshRouter(dir, '0.5.0');
  assert.equal(fs.readFileSync(result.archive, 'utf8'), original);
  assert.ok(read(dir).includes('Local restriction: Do not change the research downloads without the librarian.\r\n'));
  assert.ok(!/(?<!\r)\n/.test(read(dir)));
  assert.match(read(dir), /kitVersion: 0\.5\.0\r\n/);
  assert.equal(assessRouter(dir, '0.5.0').stale, false);
  const stable = snapshot(dir);
  assert.deepEqual(refreshRouter(dir, '0.5.0'), { changed: false });
  assert.deepEqual(snapshot(dir), stable);
});


test('the printed repair command handles literal shell syntax and quotes without expansion', () => {
  const parent = envelope(PRIOR, '0.5.0', true);
  const dir = path.join(parent, "literal-$(touch SHELL_EXPANDED)-O'Brien.test");
  fs.mkdirSync(dir);
  for (const file of ['AGENTS.md', 'site']) fs.renameSync(path.join(parent, file), path.join(dir, file));
  const original = read(dir);
  const before = snapshot(parent);
  const check = command('check.mjs', [dir]);
  assert.equal(check.status, 1);
  const repair = refreshCommand(dir);
  assert.ok(check.stderr.includes(repair));
  assert.deepEqual(snapshot(parent), before);
  const refresh = spawnSync('/bin/zsh', ['-f', '-c', repair], { cwd: parent, encoding: 'utf8' });
  assert.equal(refresh.status, 0, refresh.stderr);
  assert.equal(fs.existsSync(path.join(parent, 'SHELL_EXPANDED')), false);
  assert.equal(fs.existsSync(path.join(dir, 'SHELL_EXPANDED')), false);
  assert.equal(archives(dir).length, 1);
  assert.equal(fs.readFileSync(path.join(dir, 'zArchive', archives(dir)[0]), 'utf8'), original);
  assert.equal(assessRouter(dir, '0.5.0').stale, false);
  const stable = snapshot(parent);
  assert.equal(spawnSync('/bin/zsh', ['-f', '-c', repair], { cwd: parent }).status, 0);
  assert.deepEqual(snapshot(parent), stable);
});

for (const tag of ['pre', 'script', 'style', 'textarea', 'xmp', 'plaintext']) {
  test(`raw HTML ${tag} cannot hide managed policy with its closing tag in a local section`, () => {
    const at = CURRENT.indexOf('## Content vs code');
    const hidden = CURRENT.slice(0, at) + `<${tag}>\n` + CURRENT.slice(at) + `\n## Local notes\n</${tag}>\n`;
    unchangedRefusal(envelope(hidden), /unsupported raw HTML text container/);
  });
}

for (const [label, open, close] of [
  ['comment prefix', '<!-- note --><script>', '<!-- note --></script>'],
  ['mixed case', '<!-- note --><ScRiPt>', '<!-- note --></ScRiPt>'],
  ['split attributes', '<!-- note --><script\n type="text/plain">', '<!-- note --></script>'],
  ['inline prefix', 'local example: <script>', 'local example: </script>'],
  ['unclosed wrapper', '<!-- note --><script>', ''],
]) {
  for (const template of [CURRENT, PRIOR]) {
    test(`prefixed raw HTML ${label} cannot hide ${template === CURRENT ? 'current' : 'legacy'} policy`, () => {
      const at = template.indexOf('## Content vs code');
      const hidden = template.slice(0, at) + open + '\n' + template.slice(at) + '\n## Local notes\n' + close + '\n';
      unchangedRefusal(envelope(hidden), /unsupported raw HTML text container/);
    });
  }
}
