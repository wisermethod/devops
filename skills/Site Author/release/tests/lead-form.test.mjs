import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = fileURLToPath(new URL('../..', import.meta.url));
const KIT = join(SKILL, 'kit');
const ACTION = 'https://intake.example.com/submit';
const PRIVACY = '/privacy';
const FORM = `<LeadForm action="${ACTION}" privacy="${PRIVACY}" />`;
const FRONTMATTER = '---\ntitle: Contact\ndescription: Contact the organisation.\n---\n\n';
const OLDER_VERSIONS = ['0.1.0', '0.2.0', '0.2.1', '0.2.2', '0.3.0', '0.4.0', '0.4.1', '0.4.2', '0.4.3', '0.5.0'];
const dirs = [];
after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });

function script(name, ...args) {
  return spawnSync(process.execPath, [join(SKILL, 'scripts', name), ...args], { encoding: 'utf8' });
}

function fixture(markup, { privacy = true, redirects, older } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'kit-lead-form-')));
  dirs.push(root);
  writeFileSync(join(root, 'AGENTS.md'), '# Fixture\n\n| Directory | Holds |\n| --- | --- |\n| `sites/` | Sites |\n');
  const stoodUp = script('stand-up.mjs', '--root', root, '--domain', 'example.com',
    '--site-url', 'https://example.com', '--kit', KIT, '--articles', 'none');
  assert.equal(stoodUp.status, 0, output(stoodUp));
  const envelope = join(root, 'sites', 'example.com');
  const site = join(envelope, 'site');
  const pages = join(site, 'src', 'content', 'pages');
  writeFileSync(join(pages, 'contact.mdx'), `${FRONTMATTER}${markup}\n`);
  if (privacy) {
    // The route comes from the slug, not the filename. An unlisted page is still served.
    writeFileSync(join(pages, 'data-policy.md'), '---\ntitle: Privacy\ndescription: Privacy information.\nslug: privacy\nnoindex: true\n'
      + (privacy === 'draft' ? 'draft: true\n' : '') + '---\n\nPrivacy information.\n');
  }
  if (redirects !== undefined) writeFileSync(join(site, 'public', '_redirects'), redirects);
  if (older) {
    const kitPath = join(site, 'kit.json');
    const kit = JSON.parse(readFileSync(kitPath, 'utf8'));
    writeFileSync(kitPath, JSON.stringify({ ...kit, kitVersion: older }));
    const router = join(envelope, 'AGENTS.md');
    writeFileSync(router, readFileSync(router, 'utf8').replace(/^kitVersion: .*$/m, `kitVersion: ${older}`));
  }
  return { envelope, site };
}

function output(result) {
  return [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n');
}

function check({ envelope }, ...args) {
  return script('check.mjs', ...args, envelope);
}

function build(tree) {
  const nodeModules = join(KIT, 'node_modules');
  assert.ok(existsSync(join(nodeModules, '.bin', 'astro')), 'Install the kit dependencies before running this suite.');
  cpSync(nodeModules, join(tree.site, 'node_modules'), { recursive: true, verbatimSymlinks: true });
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: tree.site,
    encoding: 'utf8',
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
  assert.equal(result.status, 0, output(result));
  return readFileSync(join(tree.site, 'dist', 'contact.html'), 'utf8');
}

let built;
function builtFixture() {
  if (!built) {
    const tree = fixture(`${FORM}\n\n${FORM}`);
    built = { ...tree, html: build(tree) };
  }
  return built;
}

function attributes(tag) {
  const source = tag.replace(/^<[^\s>]+\s*/, '');
  return Object.fromEntries(Array.from(source.matchAll(/([^\s=>]+)(?:="([^"]*)")?/g),
    ([, name, value]) => [name, value ?? true]));
}

function forms(html) {
  return [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(([form]) => form);
}

function controls(form) {
  return [...form.matchAll(/<(input|textarea)\b[^>]*>/g)].map(([tag, element]) => ({ element, ...attributes(tag) }));
}

function labelFor(form, id) {
  return [...form.matchAll(/(<label\b[^>]*>)([\s\S]*?)<\/label>/g)]
    .find(([, tag]) => attributes(tag).for === id)?.[2].replace(/<[^>]*>/g, '').trim();
}

test('LeadForm renders the six visitor fields in order with associated labels and browser hints', () => {
  const markup = forms(builtFixture().html);
  assert.equal(markup.length, 2, 'each placement renders one form');
  for (const form of markup) {
    const fields = controls(form).filter(({ name, type }) => name !== 'website' && type !== 'hidden');
    assert.deepEqual(fields.map((field) => [field.name, field.element, field.type, field.required ?? false,
      field.autocomplete, labelFor(form, field.id)]), [
      ['first_name', 'input', 'text', true, 'given-name', 'First name'],
      ['last_name', 'input', 'text', false, 'family-name', 'Last name'],
      ['email', 'input', 'email', true, 'email', 'Work email'],
      ['company', 'input', 'text', false, 'organization', 'Company'],
      ['phone', 'input', 'tel', false, 'tel', 'Phone (optional)'],
      ['message', 'textarea', undefined, true, undefined, 'How can we help?'],
    ]);
  }
  const ids = markup.flatMap((form) => controls(form).flatMap(({ id }) => id ? [id] : []));
  assert.equal(new Set(ids).size, ids.length, 'each form instance has its own label targets');
});

test('LeadForm submits the labelled website trap as text while hiding it from sight and navigation', () => {
  const traps = controls(forms(builtFixture().html)[0]).filter(({ name }) => name === 'website');
  assert.equal(traps.length, 1);
  const [trap] = traps;
  assert.equal(trap.element, 'input');
  assert.equal(trap.type, 'text');
  assert.equal(trap.tabindex, '-1');
  assert.equal(trap.autocomplete, 'off');
  assert.equal(trap.disabled, undefined);
  const form = forms(builtFixture().html)[0];
  assert.equal(labelFor(form, trap.id), 'Website');
  const wrapper = /(<div\b[^>]*>)\s*<label\b[^>]*>Website<\/label>\s*<input\b/.exec(form);
  assert.ok(wrapper);
  assert.equal(attributes(wrapper[1]).hidden, true);
  assert.equal(attributes(wrapper[1]).inert, true);
});

test('LeadForm carries the built page path in an unlabelled hidden input that passes check --built', () => {
  const tree = builtFixture();
  for (const form of forms(tree.html)) {
    const fields = controls(form).filter(({ name }) => name === 'page');
    assert.equal(fields.length, 1);
    const [field] = fields;
    assert.equal(field.element, 'input');
    assert.equal(field.type, 'hidden');
    assert.equal(field.value, '/contact');
    assert.equal(field.id, undefined);
    assert.equal(field.disabled, undefined);
  }
  const result = check(tree, '--built');
  assert.equal(result.status, 0, output(result));
});

test('LeadForm has a plain POST, approved actions, no script and no return address', () => {
  const { html } = builtFixture();
  for (const form of forms(html)) {
    const attrs = attributes(/^<form\b[^>]*>/.exec(form)[0]);
    assert.equal(attrs.method, 'post');
    assert.equal(attrs.action, ACTION);
    assert.equal(attrs.enctype, 'application/x-www-form-urlencoded');
    assert.deepEqual(Object.keys(attrs).filter((name) => !name.startsWith('data-')).sort(),
      ['action', 'class', 'enctype', 'method']);
    assert.deepEqual(controls(form).filter(({ name, type }) => name !== 'page' || type !== 'hidden').map(({ name }) => name),
      ['first_name', 'last_name', 'email', 'company', 'phone', 'message', 'website']);
    assert.match(form, /<button\b[^>]*type="submit"[^>]*>Send<\/button>\s*<a\b[^>]*href="\/privacy"[^>]*>Privacy<\/a>/);
    assert.doesNotMatch(form, /\b(?:on\w+|formaction|formtarget|data-[\w-]*(?:return|redirect)[\w-]*)\s*=/i);
  }
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map(([tag]) => attributes(tag).type);
  assert.deepEqual(scripts, ['application/ld+json'], 'the only script tag is the kit layout metadata');
});

test('check refuses a LeadForm without an absolute HTTPS action', () => {
  for (const action of ['', '/submit', '//intake.example.com/submit', 'http://intake.example.com/submit', 'https:///submit']) {
    const result = check(fixture(`<LeadForm action="${action}" privacy="${PRIVACY}" />`));
    assert.equal(result.status, 1, `action ${action}\n${output(result)}`);
    assert.match(output(result), /LeadForm action.*absolute https:\/\//);
  }
  const missing = check(fixture(`<LeadForm privacy="${PRIVACY}" />`));
  assert.equal(missing.status, 1, output(missing));
  assert.match(output(missing), /LeadForm action.*absolute https:\/\//);
});

test('check refuses a return query or fragment in the LeadForm action', () => {
  for (const suffix of ['?return=https://example.com/thanks', '#thanks']) {
    const result = check(fixture(`<LeadForm action="${ACTION}${suffix}" privacy="${PRIVACY}" />`));
    assert.equal(result.status, 1, output(result));
    assert.match(output(result), /LeadForm action.*query or fragment/);
  }
});

for (const action of ['https://intake.example.com', 'https://intake.example.com/', `${ACTION}/`]) {
  test(`check refuses LeadForm action ${action} and names /submit`, () => {
    const result = check(fixture(`<LeadForm action="${action}" privacy="${PRIVACY}" />`));
    assert.equal(result.status, 1, output(result));
    assert.match(output(result), /LeadForm action.*ends in \/submit/);
  });
}

test('check refuses credentials in the LeadForm action', () => {
  const result = check(fixture(`<LeadForm action="https://user:pass@intake.example.com/submit" privacy="${PRIVACY}" />`));
  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /LeadForm action.*no credentials/);
});

test('check refuses a missing or non-literal LeadForm privacy prop', () => {
  for (const prop of ['', 'privacy={route}', '{...props}']) {
    const result = check(fixture(`<LeadForm action="${ACTION}" ${prop} />`));
    assert.equal(result.status, 1, output(result));
    assert.match(output(result), /LeadForm privacy.*literal site path/);
  }
});

test('check refuses a LeadForm privacy path that is external, missing or draft-only', () => {
  const external = check(fixture(`<LeadForm action="${ACTION}" privacy="https://example.com/privacy" />`));
  assert.equal(external.status, 1, output(external));
  assert.match(output(external), /LeadForm privacy.*literal site path/);
  for (const privacy of [false, 'draft']) {
    const result = check(fixture(FORM, { privacy }));
    assert.equal(result.status, 1, output(result));
    assert.match(output(result), /LeadForm privacy.*\/privacy.*no published page/);
  }
});

test('check accepts comments and redirects whose source is a different path', () => {
  const result = check(fixture(FORM, { redirects: '# /privacy /elsewhere 301\n/old-policy /privacy 301\n' }));
  assert.equal(result.status, 0, output(result));
});

for (const source of ['/privacy', '/privacy/', '/pr%69vacy.html']) {
  test(`check refuses a LeadForm privacy page redirected from ${source}`, () => {
    const result = check(fixture(FORM, { redirects: `${source} /elsewhere 301\n` }));
    assert.equal(result.status, 1, output(result));
    assert.match(output(result), /LeadForm privacy.*\/privacy.*public\/_redirects/);
  });
}

for (const older of OLDER_VERSIONS) {
  test(`check tells kit ${older} to Upgrade when it places LeadForm`, () => {
    const result = check(fixture(FORM, { older }));
    assert.equal(result.status, 1, output(result));
    assert.match(output(result), /uses LeadForm, which kitVersion 0\.6\.0 introduced: run Upgrade/);
  });
}

test('check --built accepts the LeadForm labels, including the hidden trap, and the published privacy page', () => {
  const tree = builtFixture();
  const result = check(tree, '--built');
  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /check PASS/);

  const page = join(tree.site, 'dist', 'contact.html');
  const withoutLabel = tree.html.replace(/<label\b[^>]*>Website<\/label>/, '');
  assert.notEqual(withoutLabel, tree.html);
  try {
    writeFileSync(page, withoutLabel);
    const refused = check(tree, '--built');
    assert.equal(refused.status, 1, output(refused));
    assert.match(output(refused), /name="website".*has no label/);
  } finally {
    writeFileSync(page, tree.html);
  }
});

test('check --built refuses a form with no published privacy page', () => {
  const tree = fixture(FORM, { privacy: false });
  assert.match(build(tree), /<form\b/);
  const result = check(tree, '--built');
  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /LeadForm privacy.*\/privacy.*no published page/);
});

test('check --built refuses a missing privacy artifact even when the source page exists', () => {
  const tree = fixture(FORM);
  build(tree);
  rmSync(join(tree.site, 'dist', 'privacy.html'));
  const result = check(tree, '--built');
  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /LeadForm privacy.*\/privacy.*missing from dist/);
});
