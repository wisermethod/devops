import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import { hashPassword, startRelay } from '../payload/relay.js';
import {
  authed,
  connectSmtp,
  lanHost,
  makeCerts,
  plain,
  relayEnv,
  rfc822,
  session,
  sleep,
  startMock,
  startRelayChild,
  stopped,
  stuff,
  unstuff,
  waitFor,
  writeWorld
} from './support.js';

const certs = makeCerts();
const MAX_BYTES = 5 * 1024 * 1024;
const limit = { timeout: 15000 };

function loginRow(login, domain, password, salt) {
  return {
    login,
    domain,
    upstream: 'main',
    salt,
    sha256: hashPassword(salt, password),
    created: '2026-10-12T00:00:00Z'
  };
}

async function setup(options = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'twenty-relay-case-'));
  let mock;
  let relay;
  try {
    const which = options.certificate || 'good';
    mock = await startMock({
      cert: certs[which].cert,
      key: certs[which].key,
      behavior: options.behavior || 'accept'
    });
    const world = writeWorld(root, {
      mockPort: mock.port,
      token: options.token,
      state: options.state === undefined ? 'send' : options.state,
      login: options.login,
      domain: options.domain,
      password: options.password,
      extraLogins: options.extraLogins
    });
    relay = await startRelay(relayEnv(world, certs, options.env || {}));
    return {
      root,
      mock,
      world,
      relay,
      async stop() {
        await relay.close();
        await mock.close();
        rmSync(root, { recursive: true, force: true });
      }
    };
  } catch (error) {
    if (relay) await relay.close().catch(() => {});
    if (mock) await mock.close().catch(() => {});
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

async function withSetup(options, fn) {
  const ctx = await setup(options);
  try {
    await fn(ctx);
  } finally {
    await ctx.stop();
  }
}

function sender(ctx, local = 'user') {
  return `${local}@${ctx.world.domain}`;
}

function assertNoAuth(mock) {
  for (const upstream of mock.sessions) {
    assert.equal(upstream.auth, '');
    assert.equal(upstream.commands.includes('AUTH'), false);
    assert.equal(upstream.raw.toString('latin1').includes('AUTH'), false);
  }
}

function assertNoData(upstream) {
  assert.ok(upstream, 'upstream session was not opened');
  assert.equal(upstream.commands.includes('DATA'), false);
  assert.equal(upstream.dotSeen, false);
  assert.ok(upstream.commands.includes('RSET') || upstream.closed);
}

async function mapPool(items, width, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, () => worker()));
  return results;
}

async function authAttempt(port, login, password, host) {
  const client = await connectSmtp(port, host ? { host } : {});
  try {
    await client.read(3000);
    await client.cmd('EHLO client', 3000);
    const start = Date.now();
    const reply = await client.cmd(`AUTH PLAIN ${plain(login, password)}`, 5000);
    return { code: reply.code, ms: Date.now() - start, client };
  } catch (error) {
    client.destroy();
    throw error;
  }
}

async function expectMail(ctx, command, code, text) {
  const before = ctx.mock.sessions.length;
  const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
  try {
    const reply = await opened.client.cmd(command, 4000);
    assert.equal(reply.code, code, reply.raw);
    if (text) assert.match(reply.text, text);
    if (code !== 250) assert.equal(ctx.mock.sessions.length, before);
    return reply;
  } finally {
    opened.client.destroy();
  }
}

async function submit(ctx, spec) {
  const opened = await authed(ctx.relay.port, spec.login || ctx.world.login, spec.password || ctx.world.password);
  const client = opened.client;
  const before = ctx.mock.sessions.length;
  const mail = await client.cmd(`MAIL FROM:<${spec.mailFrom || sender(ctx)}>`, 4000);
  if (mail.code !== 250) return { client, before, mail };
  const rcpt = await client.cmd(`RCPT TO:<${spec.rcpt || 'rcpt@elsewhere.test'}>`, 4000);
  const payload = spec.raw || rfc822(spec.headers, spec.body || 'hello\r\n');
  const final = await client.cmd('DATA', 4000);
  let done = final;
  if (final.code === 354) {
    await client.writeBytes(stuff(payload));
    done = await client.read(4000);
  }
  return { client, before, mail, rcpt, final: done, upstream: ctx.mock.sessions[before] };
}

async function expectHeader(ctx, spec, code) {
  const result = await submit(ctx, spec);
  try {
    assert.equal(result.mail.code, 250, result.mail.raw);
    assert.equal(result.rcpt.code, 250, result.rcpt.raw);
    assert.equal(result.final.code, code, result.final && result.final.raw);
    if (code === 550) assertNoData(result.upstream);
    if (code === 250) {
      assert.equal(result.upstream.commands.includes('DATA'), true);
      assert.equal(result.upstream.dotSeen, true);
    }
    return result;
  } finally {
    result.client.destroy();
  }
}

describe('1 listening and the happy path', { concurrency: 1 }, () => {
  test('1. EHLO advertises AUTH PLAIN LOGIN and SIZE 5242880 and hides the forbidden extensions', limit, async () => {
    await withSetup({}, async (ctx) => {
      const client = await connectSmtp(ctx.relay.port);
      try {
        const greeting = await client.read();
        assert.equal(greeting.code, 220);
        const ehlo = await client.cmd('EHLO client');
        assert.equal(ehlo.code, 250);
        const blob = ehlo.lines.join('\n');
        assert.match(blob, /AUTH PLAIN LOGIN/);
        assert.match(blob, /SIZE 5242880/);
        for (const banned of ['STARTTLS', 'CHUNKING', 'SMTPUTF8', '8BITMIME']) {
          assert.equal(blob.includes(banned), false, banned);
        }
      } finally {
        client.destroy();
      }
    });
  });

  test('1. BDAT is refused', limit, async () => {
    await withSetup({}, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        const reply = await opened.client.cmd('BDAT 1 LAST');
        assert.equal(reply.code, 500, reply.raw);
      } finally {
        opened.client.destroy();
      }
    });
  });

  test('1. a good send keeps the bytes, logs one sent line, and journals no address subject or body', limit, async () => {
    const token = 'zztokenvaluezz \t\n';
    await withSetup({ token }, async (ctx) => {
      const body = '.dotline\r\n..twodots\r\nzzbodyzz\r\n';
      const message = rfc822([
        'From: zzsenderzz@example.com',
        'Subject: zzsubjectzz',
        'Message-ID: <mid-happy@example.com>'
      ], body);
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        const mail = await opened.client.cmd('MAIL FROM:<zzsenderzz@example.com>');
        assert.equal(mail.code, 250, mail.raw);
        const rcpt = await opened.client.cmd('RCPT TO:<zzrcptzz@elsewhere.test>');
        assert.equal(rcpt.code, 250, rcpt.raw);
        const data = await opened.client.cmd('DATA');
        assert.equal(data.code, 354, data.raw);
        await opened.client.writeBytes(stuff(message));
        const final = await opened.client.read();
        assert.equal(final.code, 250, final.raw);
        assert.match(final.text, /accepted/);

        const upstream = ctx.mock.sessions[0];
        assert.equal(upstream.commands.includes('AUTH'), true);
        const decoded = Buffer.from(upstream.auth.split(' ')[2], 'base64').toString('latin1');
        assert.equal(decoded, '\0api_token\0zztokenvaluezz');
        assert.equal(upstream.commands.includes('MAIL'), true);
        const stored = upstream.data.toString('latin1');
        assert.equal(stored.includes('..dotline\r\n...twodots\r\n'), true);
        // The mock treats the body's final CRLF as the start of the terminating dot.
        assert.equal(unstuff(`${stored}\r\n`), message);
        assert.equal(upstream.dotSeen, true);

        const tx = ctx.relay.logs.filter((line) => line.startsWith('tx '));
        assert.equal(tx.length, 1);
        assert.match(tx[0], new RegExp(`^tx login=user domain=example.com recipients=1 bytes=${Buffer.byteLength(message)} outcome=sent upstream=[0-9a-f]+$`));
        const journal = readFileSync(ctx.relay.journalPath, 'utf8');
        const intents = journal.split('\n').filter((line) => line.startsWith('intent '));
        const dones = journal.split('\n').filter((line) => line.startsWith('done '));
        assert.equal(intents.length, 1);
        assert.equal(dones.length, 1);
        const id = /id=([0-9a-f]+)/.exec(intents[0])[1];
        assert.match(dones[0], new RegExp(`^done id=${id} outcome=sent$`));
        const haystack = `${ctx.relay.logs.join('\n')}\n${journal}`;
        for (const marker of ['zzsenderzz', 'zzrcptzz', 'zzsubjectzz', 'zzbodyzz', 'elsewhere.test', 'zztokenvaluezz']) {
          assert.equal(haystack.includes(marker), false, marker);
        }
      } finally {
        opened.client.destroy();
      }
    });
  });
});

describe('2 AUTH', { concurrency: 1 }, () => {
  test('2. MAIL FROM without AUTH is 530', limit, async () => {
    await withSetup({}, async (ctx) => {
      const client = await connectSmtp(ctx.relay.port);
      try {
        await client.read();
        await client.cmd('EHLO client');
        const reply = await client.cmd(`MAIL FROM:<${sender(ctx)}>`);
        assert.equal(reply.code, 530, reply.raw);
        assert.equal(ctx.mock.sessions.length, 0);
      } finally {
        client.destroy();
      }
    });
  });

  test('2. a wrong password is 535 and the connection stays open', limit, async () => {
    await withSetup({}, async (ctx) => {
      const client = await connectSmtp(ctx.relay.port);
      try {
        await client.read();
        await client.cmd('EHLO client');
        const reply = await client.cmd(`AUTH PLAIN ${plain(ctx.world.login, 'wrong-password')}`);
        assert.equal(reply.code, 535, reply.raw);
        const noop = await client.cmd('NOOP');
        assert.equal(noop.code, 250, noop.raw);
      } finally {
        client.destroy();
      }
    });
  });

  test('2. three AUTH failures close the connection', limit, async () => {
    await withSetup({}, async (ctx) => {
      const client = await connectSmtp(ctx.relay.port);
      try {
        await client.read();
        await client.cmd('EHLO client');
        for (let i = 0; i < 3; i += 1) {
          const reply = await client.cmd(`AUTH PLAIN ${plain(ctx.world.login, 'wrong-password')}`);
          assert.equal(reply.code, 535, reply.raw);
        }
        await Promise.race([
          client.closed(),
          sleep(1000).then(() => {
            throw new Error('connection stayed open after three failures');
          })
        ]);
      } finally {
        client.destroy();
      }
    });
  });

  test('2. a login past 10 failures in a minute is 454 after at least one second', limit, async () => {
    const lan = lanHost();
    assert.ok(lan);
    await withSetup({
      login: 'alpha',
      domain: 'alpha.example',
      password: 'alpha-secret',
      env: { RELAY_HOST: '0.0.0.0' }
    }, async (ctx) => {
      for (let i = 0; i < 6; i += 1) {
        const attempt = await authAttempt(ctx.relay.port, 'alpha', 'wrong-password', '127.0.0.1');
        attempt.client.destroy();
        assert.equal(attempt.code, 535);
        assert.ok(attempt.ms < 800, String(attempt.ms));
      }
      for (let i = 0; i < 4; i += 1) {
        const attempt = await authAttempt(ctx.relay.port, 'alpha', 'wrong-password', lan);
        attempt.client.destroy();
        assert.equal(attempt.code, 535);
        assert.ok(attempt.ms < 800, String(attempt.ms));
      }
      const slow = await authAttempt(ctx.relay.port, 'alpha', 'wrong-password', lan);
      slow.client.destroy();
      assert.equal(slow.code, 454, String(slow.ms));
      assert.ok(slow.ms >= 1000, String(slow.ms));
    });
  });

  test('2. a source past 10 failures in a minute is 454 after at least one second', limit, async () => {
    await withSetup({}, async (ctx) => {
      for (let i = 0; i < 10; i += 1) {
        const attempt = await authAttempt(ctx.relay.port, `z${i}`, 'wrong-password');
        attempt.client.destroy();
        assert.equal(attempt.code, 535);
        assert.ok(attempt.ms < 800, String(attempt.ms));
      }
      const slow = await authAttempt(ctx.relay.port, 'z10', 'wrong-password');
      slow.client.destroy();
      assert.equal(slow.code, 454, String(slow.ms));
      assert.ok(slow.ms >= 1000, String(slow.ms));
    });
  });

  test('2. a valid login authenticates during another login\'s flood', limit, async () => {
    const lan = lanHost();
    assert.ok(lan);
    await withSetup({
      login: 'alpha',
      domain: 'alpha.example',
      password: 'alpha-secret',
      extraLogins: [loginRow('beta', 'beta.example', 'beta-secret', 'cd'.repeat(16))],
      env: { RELAY_HOST: '0.0.0.0' }
    }, async (ctx) => {
      for (let i = 0; i < 6; i += 1) {
        const attempt = await authAttempt(ctx.relay.port, 'alpha', 'wrong-password', '127.0.0.1');
        attempt.client.destroy();
        assert.equal(attempt.code, 535);
      }
      for (let i = 0; i < 4; i += 1) {
        const attempt = await authAttempt(ctx.relay.port, 'alpha', 'wrong-password', lan);
        attempt.client.destroy();
        assert.equal(attempt.code, 535);
      }
      const flooded = await connectSmtp(ctx.relay.port, { host: lan });
      const valid = await connectSmtp(ctx.relay.port, { host: '127.0.0.1' });
      try {
        await flooded.read();
        await flooded.cmd('EHLO client');
        await valid.read();
        await valid.cmd('EHLO client');
        const started = Date.now();
        const pending = flooded.cmd(`AUTH PLAIN ${plain('alpha', 'wrong-password')}`, 5000);
        const goodStart = Date.now();
        const good = await valid.cmd(`AUTH PLAIN ${plain('beta', 'beta-secret')}`, 3000);
        assert.equal(good.code, 235, good.raw);
        assert.ok(Date.now() - goodStart < 800, String(Date.now() - goodStart));
        const bad = await pending;
        assert.equal(bad.code, 454, bad.raw);
        assert.ok(Date.now() - started >= 1000, String(Date.now() - started));
      } finally {
        flooded.destroy();
        valid.destroy();
      }
    });
  });

  test('2. a valid login authenticates during its own source flood', limit, async () => {
    await withSetup({
      login: 'alpha',
      domain: 'alpha.example',
      password: 'alpha-secret'
    }, async (ctx) => {
      for (let i = 0; i < 10; i += 1) {
        const attempt = await authAttempt(ctx.relay.port, `z${i}`, 'wrong-password');
        attempt.client.destroy();
        assert.equal(attempt.code, 535);
      }
      const flooded = await connectSmtp(ctx.relay.port);
      const valid = await connectSmtp(ctx.relay.port);
      try {
        await flooded.read();
        await flooded.cmd('EHLO client');
        await valid.read();
        await valid.cmd('EHLO client');
        const pending = flooded.cmd(`AUTH PLAIN ${plain('z10', 'wrong-password')}`, 5000);
        const goodStart = Date.now();
        const good = await valid.cmd(`AUTH PLAIN ${plain('alpha', 'alpha-secret')}`, 3000);
        assert.equal(good.code, 235, good.raw);
        assert.ok(Date.now() - goodStart < 800, String(Date.now() - goodStart));
        const bad = await pending;
        assert.equal(bad.code, 454, bad.raw);
      } finally {
        flooded.destroy();
        valid.destroy();
      }
    });
  });

  test('2. at most four AUTH checks run at once', limit, async () => {
    await withSetup({ env: { RELAY_AUTH_SLOT_DELAY_MS: '350' } }, async (ctx) => {
      const opened = [];
      try {
        for (let i = 0; i < 6; i += 1) {
          opened.push(await session(ctx.relay.port, ctx.world.login, ctx.world.password));
        }
        ctx.relay.resetAuthPeak();
        const replies = await Promise.all(opened.map((item) => item.client.cmd(
          `AUTH PLAIN ${plain(ctx.world.login, ctx.world.password)}`,
          5000
        )));
        for (const reply of replies) assert.equal(reply.code, 235, reply.raw);
        assert.equal(ctx.relay.authPeak(), 4);
      } finally {
        for (const item of opened) item.client.destroy();
      }
    });
  });

  test('2. fifty unknown names leave a known login counting from one', limit, async () => {
    const lan = lanHost();
    assert.ok(lan);
    await withSetup({ env: { RELAY_HOST: '0.0.0.0' } }, async (ctx) => {
      for (let i = 0; i < 10; i += 1) {
        const attempt = await authAttempt(ctx.relay.port, `n${i}`, 'wrong-password', '127.0.0.1');
        attempt.client.destroy();
        assert.equal(attempt.code, 535, `unknown ${i}`);
        assert.ok(attempt.ms < 800, String(attempt.ms));
      }
      const rest = await mapPool(Array.from({ length: 40 }, (_, i) => `n${i + 10}`), 6, async (name) => {
        const attempt = await authAttempt(ctx.relay.port, name, 'wrong-password', '127.0.0.1');
        attempt.client.destroy();
        return attempt;
      });
      for (const attempt of rest) assert.equal(attempt.code, 454);
      for (let i = 0; i < 10; i += 1) {
        const attempt = await authAttempt(ctx.relay.port, ctx.world.login, 'wrong-password', lan);
        attempt.client.destroy();
        assert.equal(attempt.code, 535, `failure ${i + 1} after ${attempt.ms}ms`);
        assert.ok(attempt.ms < 800, String(attempt.ms));
      }
      const slow = await authAttempt(ctx.relay.port, ctx.world.login, 'wrong-password', lan);
      slow.client.destroy();
      assert.equal(slow.code, 454, String(slow.ms));
      assert.ok(slow.ms >= 1000, String(slow.ms));
    });
  });
});

describe('3 envelope and headers', { concurrency: 1 }, () => {
  test('3. an empty MAIL FROM is 553', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectMail(ctx, 'MAIL FROM:<>', 553);
    });
  });

  test('3. a foreign MAIL FROM is 553', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectMail(ctx, 'MAIL FROM:<user@other.example>', 553);
    });
  });

  test('3. a subdomain of the login domain is 553', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectMail(ctx, 'MAIL FROM:<user@sub.example.com>', 553);
    });
  });

  test('3. the parent of a subdomain login is 553', limit, async () => {
    await withSetup({ domain: 'mail.example.com' }, async (ctx) => {
      await expectMail(ctx, 'MAIL FROM:<user@example.com>', 553);
    });
  });

  test('3. BODY=8BITMIME is refused', limit, async () => {
    await withSetup({}, async (ctx) => {
      const reply = await expectMail(ctx, `MAIL FROM:<${sender(ctx)}> BODY=8BITMIME`, 555);
      assert.equal(reply.code, 555);
    });
  });

  test('3. SMTPUTF8 is refused', limit, async () => {
    await withSetup({}, async (ctx) => {
      const reply = await expectMail(ctx, `MAIL FROM:<${sender(ctx)}> SMTPUTF8`, 555);
      assert.equal(reply.code, 555);
    });
  });

  test('3. a missing state file is 451', limit, async () => {
    await withSetup({ state: null }, async (ctx) => {
      await expectMail(ctx, `MAIL FROM:<${sender(ctx)}>`, 451, /sending held/);
    });
  });

  test('3. hold is 451', limit, async () => {
    await withSetup({ state: 'hold' }, async (ctx) => {
      await expectMail(ctx, `MAIL FROM:<${sender(ctx)}>`, 451, /sending held/);
    });
  });

  test('3. send with a trailing newline is 451', limit, async () => {
    await withSetup({ state: 'send\n' }, async (ctx) => {
      await expectMail(ctx, `MAIL FROM:<${sender(ctx)}>`, 451, /sending held/);
    });
  });

  test('3. send is admitted', limit, async () => {
    await withSetup({ state: 'send' }, async (ctx) => {
      await expectHeader(ctx, { headers: [`From: ${sender(ctx)}`] }, 250);
    });
  });

  test('3. login A with a From in B\'s domain is 550 and sends no DATA', limit, async () => {
    await withSetup({
      login: 'usera',
      domain: 'alpha.example',
      password: 'alpha-secret',
      extraLogins: [loginRow('userb', 'beta.example', 'beta-secret', 'cd'.repeat(16))]
    }, async (ctx) => {
      await expectHeader(ctx, {
        login: 'usera',
        password: 'alpha-secret',
        mailFrom: 'person@alpha.example',
        headers: ['From: person@beta.example']
      }, 550);
    });
  });

  test('3. login B with a From in A\'s domain is 550 and sends no DATA', limit, async () => {
    await withSetup({
      login: 'usera',
      domain: 'alpha.example',
      password: 'alpha-secret',
      extraLogins: [loginRow('userb', 'beta.example', 'beta-secret', 'cd'.repeat(16))]
    }, async (ctx) => {
      await expectHeader(ctx, {
        login: 'userb',
        password: 'beta-secret',
        mailFrom: 'person@beta.example',
        headers: ['From: person@alpha.example']
      }, 550);
    });
  });

  test('3. a matching From with a foreign Sender is 550 and sends no DATA', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectHeader(ctx, {
        headers: [`From: ${sender(ctx)}`, 'Sender: user@other.example']
      }, 550);
    });
  });

  test('3. two From headers differing only in case are 550 and send no DATA', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectHeader(ctx, {
        headers: [`From: ${sender(ctx)}`, `FROM: ${sender(ctx)}`]
      }, 550);
    });
  });

  test('3. a From with two addresses is 550 and sends no DATA', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectHeader(ctx, {
        headers: [`From: <${sender(ctx)}><other@elsewhere.test>`]
      }, 550);
    });
  });

  test('3. a group From is 550 and sends no DATA', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectHeader(ctx, {
        headers: [`From: undisc:${sender(ctx)};`]
      }, 550);
    });
  });

  test('3. a comment in From is 550 and sends no DATA', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectHeader(ctx, {
        headers: [`From: ${sender(ctx)} (Ada)`]
      }, 550);
    });
  });

  test('3. an encoded-word display name is accepted', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectHeader(ctx, {
        headers: [`From: =?utf-8?q?Ada?= <${sender(ctx)}>`]
      }, 250);
    });
  });

  test('3. a header-like line after the blank line is accepted', limit, async () => {
    await withSetup({}, async (ctx) => {
      const result = await submit(ctx, {
        headers: [`From: ${sender(ctx)}`],
        body: 'From: zzevilzz@other.example\r\n'
      });
      try {
        assert.equal(result.final.code, 250, result.final.raw);
        assert.equal(result.upstream.dotSeen, true);
        assert.equal(result.upstream.data.toString('latin1').includes('zzevilzz'), true);
        const journal = readFileSync(ctx.relay.journalPath, 'utf8');
        assert.equal(`${ctx.relay.logs.join('\n')}\n${journal}`.includes('zzevilzz'), false);
      } finally {
        result.client.destroy();
      }
    });
  });

  test('3. a bare LF in the headers is 550 and sends no DATA', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectHeader(ctx, {
        raw: Buffer.from(`From: ${sender(ctx)}\n\nhello\n`, 'latin1')
      }, 550);
    });
  });

  test('3. Return-Path is 550 and sends no DATA', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectHeader(ctx, {
        headers: [`Return-Path: <${sender(ctx)}>`, `From: ${sender(ctx)}`]
      }, 550);
    });
  });

  test('3. Resent-From is 550 and sends no DATA', limit, async () => {
    await withSetup({}, async (ctx) => {
      await expectHeader(ctx, {
        headers: [`From: ${sender(ctx)}`, `Resent-From: ${sender(ctx)}`]
      }, 550);
    });
  });
});

describe('4 recipients', { concurrency: 1 }, () => {
  test('4. the 51st recipient is 452 and DATA ends 554 with nothing sent upstream', limit, async () => {
    await withSetup({}, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        assert.equal((await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`)).code, 250);
        const codes = [];
        for (let i = 1; i <= 51; i += 1) {
          const reply = await opened.client.cmd(`RCPT TO:<r${i}@elsewhere.test>`);
          codes.push(reply.code);
        }
        assert.deepEqual(codes.slice(0, 50), Array(50).fill(250));
        assert.equal(codes[50], 452);
        const final = await opened.client.cmd('DATA');
        let done = final;
        if (final.code === 354) {
          await opened.client.writeBytes(stuff(rfc822([`From: ${sender(ctx)}`], 'many\r\n')));
          done = await opened.client.read(4000);
        }
        assert.equal(done.code, 554, done.raw);
        const upstream = ctx.mock.sessions[0];
        assert.equal(upstream.commands.filter((verb) => verb === 'RCPT').length, 50);
        assertNoData(upstream);
      } finally {
        opened.client.destroy();
      }
    });
  });

  test('4. mixed upstream recipients end 554 with RSET and no DATA', limit, async () => {
    await withSetup({ behavior: 'mixed' }, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        assert.equal((await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`)).code, 250);
        const codes = [];
        for (const rcpt of ['a@elsewhere.test', 'b@elsewhere.test', 'c@elsewhere.test']) {
          codes.push((await opened.client.cmd(`RCPT TO:<${rcpt}>`)).code);
        }
        assert.deepEqual(codes, [250, 450, 550]);
        const final = await opened.client.cmd('DATA');
        let done = final;
        if (final.code === 354) {
          await opened.client.writeBytes(stuff(rfc822([`From: ${sender(ctx)}`], 'mixed\r\n')));
          done = await opened.client.read(4000);
        }
        assert.equal(done.code, 554, done.raw);
        assertNoData(ctx.mock.sessions[0]);
      } finally {
        opened.client.destroy();
      }
    });
  });

  test('4. a pipelined RCPT TO:<> is counted and the message ends 554', limit, async () => {
    await withSetup({}, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        const message = rfc822([`From: ${sender(ctx)}`, 'Message-ID: <pipe@example.com>'], 'piped\r\n');
        const blob = Buffer.concat([
          Buffer.from(`MAIL FROM:<${sender(ctx)}>\r\nRCPT TO:<a@elsewhere.test>\r\nRCPT TO:<>\r\nDATA\r\n`, 'latin1'),
          stuff(message)
        ]);
        await opened.client.writeBytes(blob);
        const mail = await opened.client.read(4000);
        const rcpt = await opened.client.read(4000);
        const empty = await opened.client.read(4000);
        const data = await opened.client.read(4000);
        const final = await opened.client.read(4000);
        assert.deepEqual(
          [mail.code, rcpt.code, empty.code, data.code, final.code],
          [250, 250, 501, 354, 554]
        );
        assertNoData(ctx.mock.sessions[0]);
      } finally {
        opened.client.destroy();
      }
    });
  });
});

function sizedMessage(total) {
  const head = Buffer.from(`From: user@example.com\r\nMessage-ID: <big@example.com>\r\n\r\n`);
  const tail = Buffer.from('\r\n');
  return Buffer.concat([
    head,
    Buffer.alloc(total - head.length - tail.length, 0x62),
    tail
  ]);
}

describe('5 size and slots', { concurrency: 1 }, () => {
  test('5. a declared SIZE over 5 MiB is 552 at MAIL FROM', limit, async () => {
    await withSetup({}, async (ctx) => {
      const reply = await expectMail(ctx, `MAIL FROM:<${sender(ctx)}> SIZE=5242881`, 552, /5242880/);
      assert.equal(reply.code, 552);
    });
  });

  test('5. an undeclared 5 MiB plus one byte is 552 after the dot with no DATA upstream', limit, async () => {
    await withSetup({}, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        const message = sizedMessage(MAX_BYTES + 1);
        assert.equal(message.length, MAX_BYTES + 1);
        assert.equal((await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`)).code, 250);
        assert.equal((await opened.client.cmd('RCPT TO:<a@elsewhere.test>')).code, 250);
        assert.equal((await opened.client.cmd('DATA')).code, 354);
        await opened.client.writeBytes(message);
        await opened.client.writeBytes(Buffer.from('.\r\n'));
        const final = await opened.client.read(8000);
        assert.equal(final.code, 552, final.raw);
        assertNoData(ctx.mock.sessions[0]);
      } finally {
        opened.client.destroy();
      }
    });
  });

  test('5. two 5 MiB messages are admitted and a third MAIL FROM waits', limit, async () => {
    await withSetup({}, async (ctx) => {
      const message = sizedMessage(MAX_BYTES);
      assert.equal(message.length, MAX_BYTES);
      async function begin() {
        const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
        assert.equal((await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`)).code, 250);
        assert.equal((await opened.client.cmd('RCPT TO:<a@elsewhere.test>')).code, 250);
        assert.equal((await opened.client.cmd('DATA')).code, 354);
        await opened.client.writeBytes(message);
        return opened;
      }
      const first = await begin();
      const second = await begin();
      const third = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        assert.equal(ctx.mock.liveSessions(), 2);
        const before = ctx.mock.sessions.length;
        let answered = false;
        const pending = third.client.cmd(`MAIL FROM:<${sender(ctx)}>`, 10000).then((reply) => {
          answered = true;
          return reply;
        });
        await sleep(400);
        assert.equal(answered, false);
        assert.equal(ctx.mock.sessions.length, before);
        assert.ok(ctx.mock.peakSessions() <= 2);
        await first.client.writeBytes(Buffer.from('.\r\n'));
        const firstFinal = await first.client.read(8000);
        assert.equal(firstFinal.code, 250, firstFinal.raw);
        const thirdMail = await pending;
        assert.equal(thirdMail.code, 250, thirdMail.raw);
        assert.ok(ctx.mock.peakSessions() <= 2);
        await second.client.writeBytes(Buffer.from('.\r\n'));
        assert.equal((await second.client.read(8000)).code, 250);
        assert.equal((await third.client.cmd('RCPT TO:<a@elsewhere.test>')).code, 250);
        const thirdFinal = await third.client.cmd('DATA');
        assert.equal(thirdFinal.code, 354);
        await third.client.writeBytes(stuff(rfc822([`From: ${sender(ctx)}`], 'third\r\n')));
        assert.equal((await third.client.read(4000)).code, 250);
        assert.ok(ctx.mock.peakSessions() <= 2);
      } finally {
        first.client.destroy();
        second.client.destroy();
        third.client.destroy();
      }
    });
  });
});

describe('6 upstream verification', { concurrency: 1 }, () => {
  async function refusedCert(which) {
    await withSetup({ certificate: which }, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        const start = Date.now();
        const reply = await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`, 4000);
        assert.equal(reply.code, 451, reply.raw);
        assert.ok(Date.now() - start < 2000, String(Date.now() - start));
        assertNoAuth(ctx.mock);
      } finally {
        opened.client.destroy();
      }
    });
  }

  test('6. a wrong-host certificate is refused before AUTH', limit, async () => {
    await refusedCert('wrongHost');
  });

  test('6. an untrusted certificate is refused before AUTH', limit, async () => {
    await refusedCert('untrusted');
  });

  test('6. a good certificate still sends', limit, async () => {
    await withSetup({ certificate: 'good' }, async (ctx) => {
      await expectHeader(ctx, { headers: [`From: ${sender(ctx)}`] }, 250);
      assert.equal(ctx.mock.sessions[0].commands.includes('AUTH'), true);
    });
  });

  test('6. a missing upstream token is 451 at MAIL FROM', limit, async () => {
    await withSetup({}, async (ctx) => {
      unlinkSync(path.join(ctx.world.secrets, 'main.token'));
      const reply = await expectMail(ctx, `MAIL FROM:<${sender(ctx)}>`, 451, /upstream not configured/);
      assert.equal(reply.code, 451);
    });
  });

  test('6. an empty upstream token is 451 at MAIL FROM', limit, async () => {
    await withSetup({}, async (ctx) => {
      writeFileSync(path.join(ctx.world.secrets, 'main.token'), '');
      const reply = await expectMail(ctx, `MAIL FROM:<${sender(ctx)}>`, 451, /upstream not configured/);
      assert.equal(reply.code, 451);
    });
  });
});

const shrunk = {
  RELAY_CONNECT_TIMEOUT_MS: '2000',
  RELAY_GREETING_TIMEOUT_MS: '400',
  RELAY_COMMAND_TIMEOUT_MS: '400',
  RELAY_DATA_REPLY_TIMEOUT_MS: '400',
  RELAY_TRANSACTION_TIMEOUT_MS: '5000'
};

function lastInflight(logs) {
  const counts = logs.filter((line) => line.startsWith('inflight count='));
  return counts[counts.length - 1];
}

async function sendSmall(ctx) {
  const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
  try {
    assert.equal((await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`, 3000)).code, 250);
    assert.equal((await opened.client.cmd('RCPT TO:<a@elsewhere.test>', 3000)).code, 250);
    const final = await opened.client.cmd('DATA', 3000);
    assert.equal(final.code, 354, final.raw);
    await opened.client.writeBytes(stuff(rfc822([`From: ${sender(ctx)}`], 'again\r\n')));
    const done = await opened.client.read(3000);
    assert.equal(done.code, 250, done.raw);
  } finally {
    opened.client.destroy();
  }
}

describe('7 timeouts and deadlines', { concurrency: 1 }, () => {
  test('7. a silent upstream is 451 within the greeting timeout and the slot is freed', limit, async () => {
    await withSetup({ behavior: 'silent', env: shrunk }, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        const start = Date.now();
        const reply = await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`, 3000);
        const ms = Date.now() - start;
        assert.equal(reply.code, 451, reply.raw);
        assert.ok(ms >= 350 && ms < 1500, String(ms));
        assert.equal(lastInflight(ctx.relay.logs), 'inflight count=0');
      } finally {
        opened.client.destroy();
      }
      ctx.mock.setBehavior('accept');
      await sendSmall(ctx);
    });
  });

  test('7. a hung EHLO is 451 within the command timeout and the slot is freed', limit, async () => {
    await withSetup({ behavior: 'hang-ehlo', env: shrunk }, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        const start = Date.now();
        const reply = await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`, 3000);
        const ms = Date.now() - start;
        assert.equal(reply.code, 451, reply.raw);
        assert.ok(ms >= 350 && ms < 1500, String(ms));
        assert.equal(lastInflight(ctx.relay.logs), 'inflight count=0');
        assertNoAuth(ctx.mock);
      } finally {
        opened.client.destroy();
      }
      ctx.mock.setBehavior('accept');
      await sendSmall(ctx);
    });
  });

  test('7. a hung DATA is 451 within the command timeout and the slot is freed', limit, async () => {
    await withSetup({ behavior: 'hang-data', env: shrunk }, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        assert.equal((await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`, 3000)).code, 250);
        assert.equal((await opened.client.cmd('RCPT TO:<a@elsewhere.test>', 3000)).code, 250);
        const start = Date.now();
        const openedData = await opened.client.cmd('DATA', 3000);
        assert.equal(openedData.code, 354, openedData.raw);
        await opened.client.writeBytes(stuff(rfc822([`From: ${sender(ctx)}`], 'hang\r\n')));
        const final = await opened.client.read(3000);
        const ms = Date.now() - start;
        assert.equal(final.code, 451, final.raw);
        assert.ok(ms >= 350 && ms < 1500, String(ms));
        assert.equal(lastInflight(ctx.relay.logs), 'inflight count=0');
      } finally {
        opened.client.destroy();
      }
      ctx.mock.setBehavior('accept');
      await sendSmall(ctx);
    });
  });

  test('7. a client gone while the upstream session opens frees its slot', limit, async () => {
    await withSetup({ behavior: 'slow-greeting', env: { RELAY_GREETING_TIMEOUT_MS: '3000' } }, async (ctx) => {
      for (let i = 0; i < 2; i += 1) {
        const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
        opened.client.write(`MAIL FROM:<${sender(ctx)}>`);
        await waitFor(() => ctx.mock.sessions.length === i + 1, 2000, 'upstream opened');
        opened.client.destroy();
      }
      await waitFor(() => ctx.mock.sessions.every((item) => item.closed), 4000, 'upstream sessions closed');
      assert.equal(lastInflight(ctx.relay.logs), 'inflight count=0');
      assert.equal(ctx.relay.logs.filter((line) => line.startsWith('tx ') && line.includes('outcome=incomplete')).length, 2);
      await sendSmall(ctx);
    });
  });

  test('7. two endless DATA streams are cut at the deadline and both slots are freed', limit, async () => {
    await withSetup({
      env: {
        RELAY_DATA_DEADLINE_MS: '500',
        RELAY_TRANSACTION_TIMEOUT_MS: '8000',
        RELAY_IDLE_TIMEOUT_MS: '30000',
        RELAY_COMMAND_TIMEOUT_MS: '2000'
      }
    }, async (ctx) => {
      const timers = [];
      function pump(client) {
        const chunk = Buffer.from(`${'x'.repeat(200)}\r\n`);
        const timer = setInterval(() => {
          if (client.socket.destroyed) {
            clearInterval(timer);
            return;
          }
          client.socket.write(chunk);
        }, 25);
        timers.push(timer);
        client.socket.once('close', () => clearInterval(timer));
        client.socket.once('error', () => clearInterval(timer));
      }
      const first = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      const second = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        for (const opened of [first, second]) {
          assert.equal((await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`)).code, 250);
          assert.equal((await opened.client.cmd('RCPT TO:<a@elsewhere.test>')).code, 250);
          assert.equal((await opened.client.cmd('DATA')).code, 354);
          pump(opened.client);
        }
        assert.equal(ctx.mock.liveSessions(), 2);
        await Promise.race([
          Promise.all([first.client.closed(), second.client.closed()]),
          sleep(2000).then(() => {
            throw new Error('DATA deadline did not close both clients');
          })
        ]);
        for (const upstream of ctx.mock.sessions.slice(0, 2)) {
          assert.equal(upstream.dotSeen, false);
          assert.equal(upstream.commands.includes('DATA'), false);
        }
        assert.equal(lastInflight(ctx.relay.logs), 'inflight count=0');
        await sendSmall(ctx);
        assert.ok(ctx.mock.peakSessions() <= 2);
      } finally {
        for (const timer of timers) clearInterval(timer);
        first.client.destroy();
        second.client.destroy();
      }
    });
  });
});

describe('8 ambiguity and the journal', { concurrency: 1 }, () => {
  test('8. a client disconnect after the final dot is logged and journalled ambiguous', limit, async () => {
    await withSetup({ behavior: 'hold-final' }, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        const message = rfc822([
          `From: ${sender(ctx)}`,
          'Message-ID: <ambig@example.com>'
        ], 'zzbodyzz\r\n');
        assert.equal((await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`)).code, 250);
        assert.equal((await opened.client.cmd('RCPT TO:<a@elsewhere.test>')).code, 250);
        assert.equal((await opened.client.cmd('DATA')).code, 354);
        await opened.client.writeBytes(stuff(message));
        await waitFor(() => ctx.mock.sessions[0] && ctx.mock.sessions[0].dotSeen, 3000, 'dot');
        await sleep(50);
        opened.client.destroy();
        await waitFor(() => ctx.relay.logs.some((line) => line.includes('outcome=ambiguous')), 2000, 'ambiguous log');
        const tx = ctx.relay.logs.find((line) => line.includes('outcome=ambiguous'));
        assert.match(tx, /message_id=<ambig@example.com>/);
        const journal = readFileSync(ctx.relay.journalPath, 'utf8');
        assert.match(journal, /done id=[0-9a-f]+ outcome=ambiguous/);
        assert.equal(`${ctx.relay.logs.join('\n')}\n${journal}`.includes('zzbodyzz'), false);
      } finally {
        opened.client.destroy();
      }
    });
  });

  test('8. SIGKILL after the dot is counted ambiguous on restart and not again', limit, async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'twenty-relay-case-'));
    let mock;
    const children = [];
    try {
      mock = await startMock({
        cert: certs.good.cert,
        key: certs.good.key,
        behavior: 'hold-final'
      });
      const world = writeWorld(root, { mockPort: mock.port, state: 'send' });
      const env = relayEnv(world, certs, {
        RELAY_DATA_REPLY_TIMEOUT_MS: '8000',
        RELAY_COMMAND_TIMEOUT_MS: '8000',
        RELAY_TRANSACTION_TIMEOUT_MS: '12000'
      });
      const first = startRelayChild(env);
      children.push(first.child);
      const port = await first.ready();
      const opened = await authed(port, world.login, world.password);
      const message = rfc822([
        `From: user@${world.domain}`,
        'Message-ID: <kill@example.com>'
      ], 'zzbodyzz\r\n');
      assert.equal((await opened.client.cmd(`MAIL FROM:<user@${world.domain}>`)).code, 250);
      assert.equal((await opened.client.cmd('RCPT TO:<a@elsewhere.test>')).code, 250);
      assert.equal((await opened.client.cmd('DATA')).code, 354);
      await opened.client.writeBytes(stuff(message));
      await waitFor(() => mock.sessions.some((item) => item.dotSeen), 4000, 'dot');
      const exited = once(first.child, 'exit');
      first.child.kill('SIGKILL');
      await exited;
      opened.client.destroy();
      const mid = readFileSync(world.journal, 'utf8');
      assert.match(mid, /^intent /m);
      assert.equal(mid.includes('outcome=ambiguous'), false);
      assert.equal(mid.includes('zzbodyzz'), false);

      async function boot(count) {
        const child = startRelayChild(env);
        children.push(child.child);
        await child.ready();
        assert.match(child.output(), new RegExp(`journal ambiguous=${count}`));
        await stopped(child.child);
      }
      await boot(1);
      const after = readFileSync(world.journal, 'utf8');
      assert.match(after, /done id=[0-9a-f]+ outcome=ambiguous/);
      assert.equal(after.includes('zzbodyzz'), false);
      await boot(0);
    } finally {
      for (const child of children) await stopped(child);
      if (mock) await mock.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('8. a client disconnect before the final dot is incomplete and sends no dot', limit, async () => {
    await withSetup({}, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        assert.equal((await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`)).code, 250);
        assert.equal((await opened.client.cmd('RCPT TO:<a@elsewhere.test>')).code, 250);
        assert.equal((await opened.client.cmd('DATA')).code, 354);
        await opened.client.writeBytes(Buffer.from(`From: ${sender(ctx)}\r\n\r\nzzbodyzz\r\n`));
        opened.client.destroy();
        await waitFor(() => ctx.relay.logs.some((line) => line.includes('outcome=incomplete')), 2000, 'incomplete');
        assert.equal(ctx.mock.sessions[0].dotSeen, false);
        assert.equal(ctx.mock.sessions[0].commands.includes('DATA'), false);
      } finally {
        opened.client.destroy();
      }
    });
  });

  test('8. a journal over 1 MiB rotates to .1 and keeps an unresolved intent', limit, async () => {
    await withSetup({}, async (ctx) => {
      const oldId = '0123456789abcdef';
      const intent = `intent id=${oldId} login=user domain=example.com recipients=1 bytes=1 message_id=- time=2026-10-12T00:00:00.000Z session=bbbbbbbbbbbbbbbb\n`;
      writeFileSync(ctx.relay.journalPath, Buffer.concat([
        Buffer.from(intent),
        Buffer.alloc(1024 * 1024, 0x78)
      ]));
      await expectHeader(ctx, { headers: [`From: ${sender(ctx)}`] }, 250);
      const text = readFileSync(ctx.relay.journalPath, 'utf8');
      const rotated = readFileSync(`${ctx.relay.journalPath}.1`, 'utf8');
      assert.match(rotated, new RegExp(`intent id=${oldId}`));
      assert.match(text, new RegExp(`^intent id=${oldId} `, 'm'));
      assert.equal(text.includes(`done id=${oldId}`), false);
    });
  });
});

describe('9 hold, reload and rotation', { concurrency: 1 }, () => {
  function replaceLogins(conf, contents) {
    const dest = path.join(conf, 'logins.json');
    const tmp = `${dest}.${process.pid}.tmp`;
    writeFileSync(tmp, contents);
    renameSync(tmp, dest);
  }

  function loginFile(world, password) {
    return `${JSON.stringify([loginRow(world.login, world.domain, password, world.salt)], null, 2)}\n`;
  }

  async function authCode(port, login, password) {
    let client;
    try {
      client = await connectSmtp(port);
      await client.read(3000);
      await client.cmd('EHLO client', 3000);
      const reply = await client.cmd(`AUTH PLAIN ${plain(login, password)}`, 4000);
      return reply.code;
    } catch {
      return 'dropped';
    } finally {
      if (client) client.destroy();
    }
  }

  // `halt` stops new AUTH commands. Call it from the reload once the signal
  // or reload() has been issued, so later failures stay under the delay of ten.
  async function authLoad(port, login, password, reload) {
    const codes = [];
    let stop = false;
    async function worker() {
      while (!stop) codes.push(await authCode(port, login, password));
    }
    const workers = [worker(), worker()];
    try {
      await waitFor(() => codes.filter((code) => code === 235).length >= 4, 4000, 'auth load');
      await sleep(20);
      await reload(() => {
        stop = true;
      });
    } finally {
      stop = true;
      await Promise.all(workers);
    }
    assert.ok(codes.length >= 4, `only ${codes.length} AUTH replies`);
    assert.ok(codes.includes(235));
    for (const code of codes) assert.ok(code === 235 || code === 535, `AUTH answered ${code}`);
  }

  test('9. hold written between MAIL FROM and the final dot still sends', limit, async () => {
    await withSetup({}, async (ctx) => {
      const opened = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        assert.equal((await opened.client.cmd(`MAIL FROM:<${sender(ctx)}>`)).code, 250);
        writeFileSync(path.join(ctx.world.conf, 'state'), 'hold');
        assert.equal((await opened.client.cmd('RCPT TO:<a@elsewhere.test>')).code, 250);
        const message = rfc822([`From: ${sender(ctx)}`], 'zzbodyzz\r\n');
        assert.equal((await opened.client.cmd('DATA')).code, 354);
        await opened.client.writeBytes(stuff(message));
        const final = await opened.client.read(4000);
        assert.equal(final.code, 250, final.raw);
        assert.equal(ctx.mock.sessions[0].commands.includes('DATA'), true);
        assert.equal(ctx.mock.sessions[0].dotSeen, true);
        assert.match(ctx.relay.logs.find((line) => line.startsWith('tx ')), /outcome=sent/);
      } finally {
        opened.client.destroy();
      }
      const again = await authed(ctx.relay.port, ctx.world.login, ctx.world.password);
      try {
        const before = ctx.mock.sessions.length;
        const held = await again.client.cmd(`MAIL FROM:<${sender(ctx)}>`, 4000);
        assert.equal(held.code, 451, held.raw);
        assert.match(held.text, /sending held/);
        assert.equal(ctx.mock.sessions.length, before);
      } finally {
        again.client.destroy();
      }
    });
  });

  test('9. an atomic login rotation reloads under AUTH load', limit, async () => {
    await withSetup({}, async (ctx) => {
      const nextPassword = 'rotated-password';
      await authLoad(ctx.relay.port, ctx.world.login, ctx.world.password, (halt) => {
        replaceLogins(ctx.world.conf, loginFile(ctx.world, nextPassword));
        const before = ctx.relay.logs.length;
        const result = ctx.relay.reload();
        halt();
        assert.equal(result.ok, true);
        assert.ok(ctx.relay.logs.slice(before).some((line) => line.includes('status=loaded')));
      });
      assert.equal(await authCode(ctx.relay.port, ctx.world.login, ctx.world.password), 535);
      assert.equal(await authCode(ctx.relay.port, ctx.world.login, nextPassword), 235);
    });
  });

  test('9. SIGHUP rotates a login under AUTH load', limit, async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'twenty-relay-case-'));
    let mock;
    let running;
    try {
      mock = await startMock({ cert: certs.good.cert, key: certs.good.key, behavior: 'accept' });
      const world = writeWorld(root, { mockPort: mock.port, state: 'send' });
      const nextPassword = 'rotated-password';
      running = startRelayChild(relayEnv(world, certs));
      const port = await running.ready();
      await authLoad(port, world.login, world.password, async (halt) => {
        replaceLogins(world.conf, loginFile(world, nextPassword));
        const mark = running.output().length;
        running.child.kill('SIGHUP');
        halt();
        await waitFor(() => running.output().slice(mark).includes('status=loaded'), 2000, 'sighup reload');
      });
      assert.equal(running.output().includes('status=refused'), false);
      assert.equal(await authCode(port, world.login, world.password), 535);
      assert.equal(await authCode(port, world.login, nextPassword), 235);
    } finally {
      if (running) await stopped(running.child);
      if (mock) await mock.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('9. a second login for a bound domain is refused on reload', limit, async () => {
    await withSetup({}, async (ctx) => {
      const rows = [
        loginRow(ctx.world.login, ctx.world.domain, ctx.world.password, ctx.world.salt),
        loginRow('twin', ctx.world.domain.toUpperCase(), 'twin-secret', 'cd'.repeat(16))
      ];
      replaceLogins(ctx.world.conf, `${JSON.stringify(rows, null, 2)}\n`);
      const result = ctx.relay.reload();
      assert.equal(result.ok, false);
      assert.equal(await authCode(ctx.relay.port, 'twin', 'twin-secret'), 535);
      assert.equal(await authCode(ctx.relay.port, ctx.world.login, ctx.world.password), 235);
    });
  });

  test('9. an invalid logins.json is refused and the old login still authenticates', limit, async () => {
    await withSetup({}, async (ctx) => {
      replaceLogins(ctx.world.conf, '{');
      const before = ctx.relay.logs.length;
      const result = ctx.relay.reload();
      assert.equal(result.ok, false);
      assert.ok(ctx.relay.logs.slice(before).some((line) => line.includes('status=refused')));
      assert.equal(await authCode(ctx.relay.port, ctx.world.login, ctx.world.password), 235);
    });
  });
});
