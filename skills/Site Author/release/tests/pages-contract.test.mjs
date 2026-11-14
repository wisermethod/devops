// The kit's Pages release contract and the publisher's layout catalog, against
// the actual kit and against the base connector's generic verifier.
//
// Run with the base connector's directory named explicitly (see ../README.md):
//   WISER_CLOUDFLARE_CONNECTOR=/abs/path/to/wiser/connectors/cloudflare \
//     node --test "skills/Site Author/release/tests/pages-contract.test.mjs"
//
// release/pages-contract.json is the static contract source for kit 0.5.0 and
// release/pages-layouts.json is the publisher's layout catalog source. Both are
// UNSIGNED and UNPUBLISHED: no signature ships beside them, the kit tree carries
// neither, and nothing here publishes them. Signing the contract and installing
// it into envelopes, and signing and publishing the catalog at the URL the base
// connector's pages-trust.json names, are later, separately approved release
// steps. Every signature below is made with a FIXTURE Ed25519 key generated in
// memory for this process, trusted only by a temporary copy of the connector; it
// is never written or printed, and a pass here proves nothing about a production
// signature. Every publisher download below is served by a fake.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const RELEASE_DIR = join(HERE, '..');
const SKILL = join(RELEASE_DIR, '..');
const KIT = join(SKILL, 'kit');
const CONTRACT_PATH = join(RELEASE_DIR, 'pages-contract.json');
const CONTRACT_BYTES = readFileSync(CONTRACT_PATH);
const CONTRACT = JSON.parse(CONTRACT_BYTES);
const CATALOG_PATH = join(RELEASE_DIR, 'pages-layouts.json');
const CATALOG_BYTES = readFileSync(CATALOG_PATH);
const CATALOG = JSON.parse(CATALOG_BYTES);
const WORKER = readFileSync(join(KIT, 'src', 'function', '_worker.js'));
const PAGES_DOMAIN = Buffer.from('wiser.pages-release.v1\u0000', 'latin1');
const LAYOUTS_DOMAIN = Buffer.from('wiser.pages-layouts.v1\u0000', 'latin1');
const CONNECTOR = process.env.WISER_CLOUDFLARE_CONNECTOR;
const BUILD_TIME = '2026-10-08T15:04:05.000Z';
// The layout every kit release before the signed contract was published under.
// Its foreign-route protection must never be removed from the catalog.
const LEGACY = { root_name: 'site', assets: 'dist' };

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const scratches = [];
after(() => { for (const dir of scratches) rmSync(dir, { recursive: true, force: true }); });

function requireConnector() {
  assert.ok(CONNECTOR && isAbsolute(CONNECTOR) && existsSync(join(CONNECTOR, 'index.js')),
    'set WISER_CLOUDFLARE_CONNECTOR to the absolute path of the base connectors/cloudflare directory');
  return CONNECTOR;
}

// The trusted catalog URLs come from the base connector's own Pages trust.
function trustedUrls() {
  const trust = JSON.parse(readFileSync(join(requireConnector(), 'pages-trust.json'), 'utf8'));
  const entry = trust.publishers[CONTRACT.publisher];
  assert.ok(entry, `the base connector trusts publisher ${CONTRACT.publisher}`);
  return { catalog: entry.catalog, catalog_signature: entry.catalog_signature };
}

// FIXTURE identity: in memory only.
function fixtureIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const ed25519 = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64');
  return {
    key: { id: sha(Buffer.from(ed25519)).slice(0, 16), ed25519 },
    signPages(bytes) { return sign(null, Buffer.concat([PAGES_DOMAIN, bytes]), privateKey); },
    signLayouts(bytes) { return sign(null, Buffer.concat([LAYOUTS_DOMAIN, bytes]), privateKey); },
  };
}

function connectorCopy(source, trustKeys) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'kit-contract-connector-')));
  scratches.push(base);
  const dir = join(base, 'cloudflare');
  mkdirSync(dir);
  for (const entry of readdirSync(source)) {
    if (entry === 'tests' || entry === 'pages-trust.json') continue;
    cpSync(join(source, entry), join(dir, entry), { recursive: true });
  }
  writeFileSync(join(dir, 'pages-trust.json'), `${JSON.stringify({
    format: 1,
    purpose: 'cloudflare.pages.deploy',
    publishers: { [CONTRACT.publisher]: { keys: trustKeys, ...trustedUrls() } },
  }, null, 2)}\n`);
  return { dir };
}

// A fake publisher host serving the catalog source's exact bytes and a signature.
function publisher(identity, { bytes = CATALOG_BYTES, signature } = {}) {
  const urls = trustedUrls();
  const served = new Map([[urls.catalog, bytes], [urls.catalog_signature, signature || identity.signLayouts(bytes)]]);
  const requests = [];
  return {
    requests,
    async fetchRelease(url, { maxBytes } = {}) {
      requests.push({ url, maxBytes });
      const hit = served.get(url);
      if (!hit) throw Object.assign(new Error('not served'), { object: { status: 'vendor_error', reason: 'release HTTP error', http_status: 404 } });
      if (hit.length > maxBytes) throw Object.assign(new Error('too large'), { object: { status: 'denied', reason: 'release body exceeds maxBytes' } });
      return { status: 200, bytes: new Uint8Array(hit), content_type: 'application/octet-stream' };
    },
  };
}

// The kit's data format, as kit/src/lib/scheduled-build.mjs buildBin writes it.
function scheduleBin() {
  const head = Buffer.from(JSON.stringify({ v: 1, kitVersion: CONTRACT.release, buildTime: BUILD_TIME, paths: {} }), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(head.length);
  return Buffer.concat([Buffer.from('WKS1'), len, head]);
}

// A real-layout envelope in a temporary directory, the contract and a FIXTURE
// signature at its site/ root.
function envelope(identity, { worker = WORKER } = {}) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'kit-contract-site-')));
  scratches.push(base);
  const site = join(base, 'example.test', 'site');
  const layout = CONTRACT.layout;
  mkdirSync(join(site, layout.assets), { recursive: true });
  cpSync(join(KIT, 'kit.json'), join(site, layout.identity.path));
  mkdirSync(join(site, '.astro'));
  writeFileSync(join(site, layout.build.path), `${JSON.stringify({ [layout.build.time]: BUILD_TIME })}\n`);
  writeFileSync(join(site, layout.assets, 'index.html'), '<h1>Kit contract fixture</h1>\n');
  writeFileSync(join(site, layout.assets, '_routes.json'), '{"decoy":true}\n');
  const fn = join(site, layout.function.directory);
  mkdirSync(fn);
  const routes = Buffer.from(`${JSON.stringify({ version: 1, include: ['/articles/fixture-due*'], exclude: [] })}\n`);
  const data = scheduleBin();
  writeFileSync(join(fn, layout.function.worker), worker);
  writeFileSync(join(fn, layout.function.routes), routes);
  writeFileSync(join(fn, layout.function.data), data);
  const r = CONTRACT.record;
  writeFileSync(join(fn, layout.function.record), `${JSON.stringify({
    [r.version]: CONTRACT.release,
    [r.time]: BUILD_TIME,
    [r.hashes.worker]: sha(worker),
    [r.hashes.routes]: sha(routes),
    [r.hashes.data]: sha(data),
    [r.carried]: ['2026-10-08T15:21:00.000Z'],
    [r.not_carried]: [],
    [r.paths]: 1,
  }, null, 2)}\n`);
  const contractPath = join(site, 'pages-release.json');
  writeFileSync(contractPath, CONTRACT_BYTES);
  const signaturePath = join(site, 'pages-release.sig');
  writeFileSync(signaturePath, identity.signPages(CONTRACT_BYTES));
  return {
    site,
    data,
    routes,
    input: {
      account_id: 'acct-1', project_name: 'kit-contract-fixture', dir: join(site, layout.assets),
      release_contract: contractPath, release_signature: signaturePath,
    },
  };
}

// The unmarked legacy output: the kit's layout with no kit.json anywhere, the
// case a name-only screen used to refuse.
function unmarkedLegacy(...below) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'kit-legacy-unmarked-')));
  scratches.push(base);
  const dir = join(base, 'example.test', LEGACY.root_name, ...LEGACY.assets.split('/'), ...below);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<h1>Unmarked legacy output</h1>\n');
  return { base, dir };
}

function functionsBuild(base, assets) {
  const dir = join(base, `functions-build-${scratches.length}`);
  mkdirSync(dir);
  const b = 'LegacyBoundary';
  writeFileSync(join(dir, '_worker.bundle'), [
    `--${b}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n${JSON.stringify({ main_module: 'worker.js' })}\r\n`,
    `--${b}\r\nContent-Disposition: form-data; name="worker.js"; filename="worker.js"\r\nContent-Type: application/javascript+module\r\n\r\nexport default {}\r\n`,
    `--${b}--\r\n`,
  ].join(''));
  writeFileSync(join(dir, '_routes.json'), `${JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] })}\n`);
  writeFileSync(join(dir, 'functions-filepath-routing-config.json'), `${JSON.stringify({ routes: [] })}\n`);
  writeFileSync(join(dir, 'build.json'), `${JSON.stringify({ assets, functions: join(base, 'functions-src'), sources: [{ path: 'api/x.js', sha256: 'd'.repeat(64) }] })}\n`);
  return dir;
}

function fakeProvider(calls, server) {
  const ok = (result) => ({ status: 200, data: { success: true, result, errors: [], messages: [] }, headers: {} });
  return {
    ...(server ? { fetchRelease: (url, opts) => server.fetchRelease(url, opts) } : {}),
    async proxy(request) {
      calls.push(request);
      if (request.method === 'GET' && request.endpoint.endsWith('/upload-token')) return ok({ jwt: 'fixture-jwt' });
      if (request.endpoint === '/pages/assets/check-missing') return ok(request.body.hashes);
      if (request.method === 'POST' && request.endpoint.endsWith('/deployments')) return ok({ id: 'dep-kit-fixture' });
      return ok(null);
    },
  };
}

function formParts(contentType, body) {
  const boundary = contentType.split('boundary=')[1];
  const raw = body.toString('latin1');
  const parts = [];
  for (const piece of raw.split(`--${boundary}`)) {
    const part = piece.replace(/^\r\n/, '');
    const at = part.indexOf('\r\n\r\n');
    if (at < 0) continue;
    const head = part.slice(0, at);
    let value = part.slice(at + 4);
    if (value.endsWith('\r\n')) value = value.slice(0, -2);
    parts.push({ name: /name="([^"]*)"/.exec(head)?.[1], type: /Content-Type: ([^\r\n]+)/i.exec(head)?.[1], value: Buffer.from(value, 'latin1') });
  }
  return parts;
}

async function load(dir) {
  return import(pathToFileURL(join(dir, 'index.js')).href);
}

test('the contract describes the shipped kit: worker fingerprint, release and layout', () => {
  assert.equal(sha(WORKER), CONTRACT.worker.sha256);
  assert.equal(JSON.parse(readFileSync(join(KIT, 'kit.json'), 'utf8'))[CONTRACT.layout.identity.version], CONTRACT.release);
  const build = readFileSync(join(KIT, 'src', 'lib', 'scheduled-build.mjs'), 'utf8');
  const fn = CONTRACT.layout.function;
  assert.match(build, new RegExp(`'${fn.directory}'`));
  for (const name of [fn.worker, fn.routes, fn.data, fn.record]) assert.ok(build.includes(`'${name}'`), name);
  assert.ok(build.includes(`Buffer.from('${Buffer.from(CONTRACT.data.magic, 'base64').toString('latin1')}')`));
  assert.ok(build.includes(`{ ${CONTRACT.data.version_field}: ${CONTRACT.data.version},`));
  const r = CONTRACT.record;
  for (const key of [r.version, r.time, r.hashes.worker, r.hashes.routes, r.hashes.data, r.carried, r.not_carried, r.paths]) {
    assert.match(build, new RegExp(`\\b${key}\\b`), key);
  }
  // The worker imports its data under the data file's own name, the bundle part name.
  assert.ok(WORKER.toString('utf8').includes(`from './${fn.data}'`));
  assert.ok(readFileSync(join(KIT, 'astro.config.mjs'), 'utf8').includes(`kit-build.json`));
  assert.equal(CONTRACT.layout.build.path, '.astro/kit-build.json');
});

test('the layout catalog source is closed, passes the connector\'s own check, and keeps the legacy layout', async () => {
  const { parseLayoutCatalog } = await import(pathToFileURL(join(requireConnector(), 'pages-release.js')).href);
  const parsed = parseLayoutCatalog(CATALOG_BYTES, CONTRACT.publisher);
  assert.equal(parsed.error, undefined, parsed.error);
  assert.deepEqual(Object.keys(CATALOG), ['format', 'purpose', 'publisher', 'layouts']);
  assert.equal(CATALOG.publisher, CONTRACT.publisher);
  const pairs = CATALOG.layouts.map((layout) => `${layout.root_name}/${layout.assets}`);
  // The legacy entry is never removed, and the contract's own layout is listed
  // before any contract using it is published.
  assert.ok(pairs.includes(`${LEGACY.root_name}/${LEGACY.assets}`), 'legacy layout retained');
  assert.ok(pairs.includes(`${CONTRACT.layout.root_name}/${CONTRACT.layout.assets}`), 'contract layout listed');
  // The catalog names layouts only: no worker, hash or code approval.
  for (const layout of CATALOG.layouts) assert.deepEqual(Object.keys(layout), ['root_name', 'assets']);
  assert.equal(/sha256|worker|[0-9a-f]{64}/.test(CATALOG_BYTES.toString('utf8')), false);
});

test('the production contract and catalog are unsigned, unpublished and not installed in the kit', () => {
  assert.deepEqual(readdirSync(RELEASE_DIR).filter((name) => statSync(join(RELEASE_DIR, name)).isFile()).sort(),
    ['README.md', 'pages-contract-0.1.0.json', 'pages-contract.json', 'pages-layouts.json']);
  const stack = [KIT];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      if (entry.isDirectory()) stack.push(join(dir, entry.name));
      else assert.equal(/pages-(release|contract|layouts)|layouts\.sig/.test(entry.name), false, join(dir, entry.name));
    }
  }
});

test('FIXTURE-signed real-layout contract reaches the fake provider with the kit bundle, after reading the catalog', async () => {
  const identity = fixtureIdentity();
  const copy = connectorCopy(requireConnector(), [identity.key]);
  const tree = envelope(identity);
  const server = publisher(identity);
  const manifest = JSON.parse(readFileSync(join(copy.dir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.modules.pages.actions.deploy.confirmation, 'always');
  const { modules } = await load(copy.dir);
  const calls = [];
  const result = await modules.pages.deploy(tree.input, fakeProvider(calls, server));
  assert.equal(result.deployment?.id, 'dep-kit-fixture', JSON.stringify(result));
  assert.deepEqual(server.requests.map((r) => r.url), [trustedUrls().catalog, trustedUrls().catalog_signature]);
  assert.deepEqual(result.release, { publisher: CONTRACT.publisher, release: CONTRACT.release, key_id: identity.key.id });
  assert.equal(result.function.worker_sha256, CONTRACT.worker.sha256);
  assert.equal(result.function.module_name, '_worker.js');
  assert.deepEqual(result.manifest, ['/index.html']);
  const posted = calls.filter((call) => call.method === 'POST' && call.endpoint.endsWith('/deployments'));
  assert.equal(posted.length, 1);
  const form = formParts(posted[0].binary_body.content_type, Buffer.from(posted[0].binary_body.base64, 'base64'));
  assert.deepEqual(form.map((part) => part.name), ['manifest', '_worker.bundle', '_routes.json']);
  const bundleBytes = form[1].value;
  const bundle = formParts(`multipart/form-data; boundary=${bundleBytes.toString('latin1').split('\r\n', 1)[0].slice(2)}`, bundleBytes);
  assert.deepEqual(bundle.map((part) => part.name), ['metadata', '_worker.js', 'schedule.bin']);
  assert.deepEqual(JSON.parse(bundle[0].value.toString('utf8')), { main_module: '_worker.js' });
  assert.equal(bundle[1].type, 'application/javascript+module');
  assert.ok(bundle[1].value.equals(WORKER));
  assert.ok(bundle[2].value.equals(tree.data));
  assert.ok(form[2].value.equals(tree.routes));
});

test('the real-layout contract is refused when its publisher\'s catalog omits its layout', async () => {
  const identity = fixtureIdentity();
  const copy = connectorCopy(requireConnector(), [identity.key]);
  const tree = envelope(identity);
  const omitted = Buffer.from(`${JSON.stringify({ ...CATALOG, layouts: [{ root_name: 'other-root', assets: 'public' }] }, null, 2)}\n`);
  const { modules } = await load(copy.dir);
  const calls = [];
  const result = await modules.pages.deploy(tree.input, fakeProvider(calls, publisher(identity, { bytes: omitted })));
  assert.equal(result.status, 'invalid_arguments', JSON.stringify(result));
  assert.equal(result.reason, 'release layout is not in its publisher\'s layout catalog');
  assert.equal(calls.length, 0);
});

for (const [label, below] of [['the unmarked legacy output itself', []], ['a directory below it', ['articles']]]) {
  for (const action of ['deploy_static', 'deploy_with_functions']) {
    test(`${action} refuses ${label} (no kit.json anywhere) with zero Cloudflare calls`, async () => {
      const identity = fixtureIdentity();
      const copy = connectorCopy(requireConnector(), [identity.key]);
      const { base, dir } = unmarkedLegacy(...below);
      let marker = false;
      for (let at = dir; at !== join(at, '..'); at = join(at, '..')) marker ||= existsSync(join(at, 'kit.json'));
      assert.equal(marker, false, 'the fixture carries no payload marker');
      const server = publisher(identity);
      const { modules } = await load(copy.dir);
      const calls = [];
      const input = { account_id: '0123456789abcdef0123456789abcdef', project_name: 'legacy-unmarked', dir,
        ...(action === 'deploy_with_functions' ? { functions_build: functionsBuild(base, dir) } : {}) };
      const result = await modules.pages[action](input, fakeProvider(calls, server));
      assert.equal(result.status, 'invalid_arguments', JSON.stringify(result));
      assert.equal(result.reason, 'release payload: use cloudflare.pages.deploy');
      assert.equal(calls.length, 0);
      assert.equal(server.requests.length, 2);
    });
  }
}

test('unrelated foreign static and Functions output still deploys with the real catalog', async () => {
  const identity = fixtureIdentity();
  const copy = connectorCopy(requireConnector(), [identity.key]);
  const { modules } = await load(copy.dir);
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'kit-foreign-')));
  scratches.push(base);
  const dir = join(base, 'project', 'out');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<h1>Foreign</h1>\n');
  for (const action of ['deploy_static', 'deploy_with_functions']) {
    const calls = [];
    const input = { account_id: '0123456789abcdef0123456789abcdef', project_name: 'foreign-site', dir,
      ...(action === 'deploy_with_functions' ? { functions_build: functionsBuild(base, dir) } : {}) };
    const result = await modules.pages[action](input, fakeProvider(calls, publisher(identity)));
    assert.equal(result.status, undefined, `${action} ${JSON.stringify(result)}`);
    assert.equal(calls.filter((call) => call.method === 'POST' && call.endpoint.endsWith('/deployments')).length, 1, action);
  }
});

test('the base connector as shipped does not accept the FIXTURE signature, so no unsigned or fixture path exists', async () => {
  const identity = fixtureIdentity();
  const tree = envelope(identity);
  const server = publisher(identity);
  const { modules } = await load(requireConnector());
  const calls = [];
  const result = await modules.pages.deploy(tree.input, fakeProvider(calls, server));
  assert.equal(result.status, 'invalid_arguments');
  assert.equal(result.reason, 'release signature is not from a trusted Pages publisher');
  assert.equal(calls.length, 0);
  rmSync(tree.input.release_signature);
  const unsigned = await modules.pages.deploy(tree.input, fakeProvider(calls, server));
  assert.equal(unsigned.status, 'invalid_arguments');
  assert.equal(calls.length, 0);
  assert.deepEqual(server.requests, []);
  // Nor does it accept a FIXTURE-signed catalog: the unmarked legacy output and
  // unrelated output alike are refused before any call.
  const { dir } = unmarkedLegacy();
  const refused = await modules.pages.deploy_static({ account_id: '0123456789abcdef0123456789abcdef', project_name: 'x', dir }, fakeProvider(calls, server));
  assert.equal(refused.status, 'invalid_arguments');
  assert.equal(refused.reason, `publisher layout catalog is not signed by its publisher: ${CONTRACT.publisher}`);
  assert.equal(calls.length, 0);
});

test('a changed kit worker with a self-consistent record is refused on the signed fingerprint', async () => {
  const identity = fixtureIdentity();
  const copy = connectorCopy(requireConnector(), [identity.key]);
  const tree = envelope(identity, { worker: Buffer.concat([WORKER, Buffer.from('\n// changed\n')]) });
  const { modules } = await load(copy.dir);
  const calls = [];
  const result = await modules.pages.deploy(tree.input, fakeProvider(calls, publisher(identity)));
  assert.equal(result.reason, 'unapproved worker fingerprint');
  assert.equal(calls.length, 0);
});

// The legacy identity/layout facts were read from the named 0.1.0 envelope's
// kit.json, static Astro configuration and directory existence. No source
// content, member data or worker fingerprint is carried into this fixture.
const STATIC_BYTES = readFileSync(join(RELEASE_DIR, 'pages-contract-0.1.0.json'));
const STATIC = JSON.parse(STATIC_BYTES);
const LEGACY_IDENTITY = Object.freeze({ kitVersion: '0.1.0' });
function legacyEnvelope(identity) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'legacy-static-contract-')));
  scratches.push(base);
  const site = join(base, 'example.test', 'site');
  mkdirSync(join(site, 'dist'), { recursive: true });
  writeFileSync(join(site, 'kit.json'), JSON.stringify(LEGACY_IDENTITY));
  writeFileSync(join(site, 'dist', 'index.html'), '<h1>Legacy static fixture</h1>\n');
  const contractPath = join(site, 'pages-release.json');
  const signaturePath = join(site, 'pages-release.sig');
  writeFileSync(contractPath, STATIC_BYTES);
  writeFileSync(signaturePath, identity.signPages(STATIC_BYTES));
  return { site, input: {
    account_id: 'acct-1', project_name: 'legacy-contract-fixture', dir: join(site, 'dist'),
    release_contract: contractPath, release_signature: signaturePath,
  } };
}

test('legacy source preserves the actual identity/version and static layout without inventing a Function fingerprint', async () => {
  const { parseContract } = await import(pathToFileURL(join(requireConnector(), 'pages-release.js')).href);
  const parsed = parseContract(STATIC_BYTES);
  assert.equal(parsed.error, undefined, parsed.error);
  assert.deepEqual(Object.keys(STATIC), Object.keys(CONTRACT));
  assert.equal(STATIC.publisher, CONTRACT.publisher);
  assert.equal(STATIC.release, LEGACY_IDENTITY.kitVersion);
  assert.equal(STATIC.layout.root_name, 'site');
  assert.equal(STATIC.layout.assets, 'dist');
  assert.deepEqual(STATIC.layout.identity, { path: 'kit.json', version: 'kitVersion' });
  assert.equal(STATIC.worker, null);
  assert.equal(STATIC.data, null);
  assert.equal(STATIC.record, null);
  assert.equal(/sha256|[0-9a-f]{64}/.test(STATIC_BYTES.toString('utf8')), false);
  assert.ok(CATALOG.layouts.some((entry) => entry.root_name === STATIC.layout.root_name && entry.assets === STATIC.layout.assets));
  assert.equal(readdirSync(RELEASE_DIR).some((name) => name.endsWith('.sig')), false);
});

test('FIXTURE-signed legacy static release deploys through the fake provider, with Function null and no build record', async () => {
  const identity = fixtureIdentity();
  const copy = connectorCopy(requireConnector(), [identity.key]);
  const tree = legacyEnvelope(identity);
  const server = publisher(identity);
  const { modules } = await load(copy.dir);
  const calls = [];
  const result = await modules.pages.deploy(tree.input, fakeProvider(calls, server));
  assert.equal(result.deployment?.id, 'dep-kit-fixture', JSON.stringify(result));
  assert.equal(result.function, null);
  assert.deepEqual(result.release, { publisher: STATIC.publisher, release: '0.1.0', key_id: identity.key.id });
  assert.deepEqual(result.manifest, ['/index.html']);
  assert.equal(existsSync(join(tree.site, STATIC.layout.build.path)), false);
  assert.equal(existsSync(join(tree.site, STATIC.layout.function.directory)), false);
  assert.equal(server.requests.length, 2, 'publisher reads');
  const posted = calls.filter((call) => call.method === 'POST' && call.endpoint.endsWith('/deployments'));
  assert.equal(posted.length, 1, 'provider deployment');
  const form = formParts(posted[0].binary_body.content_type, Buffer.from(posted[0].binary_body.base64, 'base64'));
  assert.deepEqual(form.map((part) => part.name), ['manifest']);
});

test('legacy static release refuses an added current self-consistent Function before any publisher read or provider call', async () => {
  const identity = fixtureIdentity();
  const copy = connectorCopy(requireConnector(), [identity.key]);
  const tree = legacyEnvelope(identity);
  const current = envelope(identity);
  cpSync(join(current.site, CONTRACT.layout.function.directory), join(tree.site, STATIC.layout.function.directory), { recursive: true });
  const server = publisher(identity);
  const { modules } = await load(copy.dir);
  const calls = [];
  const result = await modules.pages.deploy(tree.input, fakeProvider(calls, server));
  assert.equal(result.status, 'invalid_arguments');
  assert.equal(result.reason, 'static-only release forbids the Function directory');
  assert.equal(calls.length, 0, 'provider calls');
  assert.equal(server.requests.length, 0, 'publisher reads');
});

test('legacy static source keeps exact identity/version binding and cannot reuse the current release contract', async () => {
  const identity = fixtureIdentity();
  const copy = connectorCopy(requireConnector(), [identity.key]);
  const { modules } = await load(copy.dir);
  for (const change of ['identity version', 'identity field', 'current contract']) {
    const tree = legacyEnvelope(identity);
    if (change === 'identity version') writeFileSync(join(tree.site, 'kit.json'), '{"kitVersion":"0.5.0"}');
    if (change === 'identity field') writeFileSync(join(tree.site, 'kit.json'), '{"version":"0.1.0"}');
    if (change === 'current contract') {
      writeFileSync(tree.input.release_contract, CONTRACT_BYTES);
      writeFileSync(tree.input.release_signature, identity.signPages(CONTRACT_BYTES));
    }
    const server = publisher(identity);
    const calls = [];
    const result = await modules.pages.deploy(tree.input, fakeProvider(calls, server));
    assert.equal(result.status, 'invalid_arguments', change);
    assert.match(result.reason, /release version mismatch|release identity unreadable/, change);
    assert.equal(calls.length, 0, 'provider calls');
    assert.equal(server.requests.length, 0, 'publisher reads');
  }
});

test('shipping trust refuses legacy static fixture signatures and unsigned bytes without any publisher or provider call', async () => {
  const identity = fixtureIdentity();
  const tree = legacyEnvelope(identity);
  const { modules } = await load(requireConnector());
  const calls = [];
  const server = publisher(identity);
  const result = await modules.pages.deploy(tree.input, fakeProvider(calls, server));
  assert.equal(result.reason, 'release signature is not from a trusted Pages publisher');
  rmSync(tree.input.release_signature);
  const unsigned = await modules.pages.deploy(tree.input, fakeProvider(calls, server));
  assert.equal(unsigned.status, 'invalid_arguments');
  assert.equal(calls.length, 0);
  assert.equal(server.requests.length, 0);
});
