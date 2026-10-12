import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { inspectHeaders, parseMailbox } from '../payload/headers.js';

const DOMAIN = 'example.com';

function message(headers, body = 'hello', sep = '\r\n') {
  return Buffer.from(`${headers.join(sep)}${sep}${sep}${body}${sep}`, 'latin1');
}

describe('mailbox grammar', () => {
  test('accepts a bare addr-spec in the login domain', () => {
    const parsed = parseMailbox('user@example.com', DOMAIN);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.local, 'user');
    assert.equal(parsed.domain, 'example.com');
  });

  test('accepts a quoted display name and one angle address', () => {
    const parsed = parseMailbox('"Ada Lovelace" <user@example.com>', DOMAIN);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.domain, 'example.com');
  });

  test('accepts an encoded-word display name without decoding it', () => {
    const parsed = parseMailbox('=?utf-8?q?Ada?= <user@example.com>', DOMAIN);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.local, 'user');
  });

  test('compares the domain lowercase and exact', () => {
    assert.equal(parseMailbox('User@Example.COM', DOMAIN).ok, true);
    assert.equal(parseMailbox('user@mail.example.com', DOMAIN).ok, false);
    assert.equal(parseMailbox('user@example.com', 'mail.example.com').ok, false);
  });

  test('rejects a group, a comment, a route, and a second address', () => {
    assert.equal(parseMailbox('undisc:user@example.com;', DOMAIN).ok, false);
    assert.equal(parseMailbox('user@example.com (Ada)', DOMAIN).ok, false);
    assert.equal(parseMailbox('<@route:user@example.com>', DOMAIN).ok, false);
    assert.equal(parseMailbox('<user@example.com><other@example.com>', DOMAIN).ok, false);
    assert.equal(parseMailbox('user@example.com, other@example.com', DOMAIN).ok, false);
  });

  test('rejects an empty value and trailing junk', () => {
    assert.equal(parseMailbox('', DOMAIN).ok, false);
    assert.equal(parseMailbox('user@example.com junk', DOMAIN).ok, false);
    assert.equal(parseMailbox('=?utf-8?q?user@example.com?=', DOMAIN).ok, false);
  });
});

describe('header block', () => {
  test('requires CRLF and unfolds a folded From', () => {
    const folded = message([
      'From: =?utf-8?q?Ada?=',
      ' <user@example.com>',
      'Message-ID: <mid-1@example.com>'
    ]);
    const parsed = inspectHeaders(folded, DOMAIN);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.messageId, '<mid-1@example.com>');
  });

  test('rejects a bare LF and a bare CR in the header block', () => {
    const lf = Buffer.from('From: user@example.com\n\nhello\n', 'latin1');
    assert.equal(inspectHeaders(lf, DOMAIN).reason, 'bare-lf');
    const cr = Buffer.from('From: user@example.com\r\r\n\r\nhello\r\n', 'latin1');
    assert.equal(inspectHeaders(cr, DOMAIN).reason, 'bare-cr');
  });

  test('rejects two From headers that differ only in case', () => {
    const parsed = inspectHeaders(message([
      'From: user@example.com',
      'FROM: user@example.com'
    ]), DOMAIN);
    assert.equal(parsed.reason, 'from-count');
  });

  test('rejects a foreign From, a foreign Sender, Return-Path, and Resent-From', () => {
    assert.equal(inspectHeaders(message(['From: user@other.example']), DOMAIN).reason, 'from');
    assert.equal(inspectHeaders(message([
      'From: user@example.com',
      'Sender: user@other.example'
    ]), DOMAIN).reason, 'sender');
    assert.equal(inspectHeaders(message([
      'Return-Path: <user@example.com>',
      'From: user@example.com'
    ]), DOMAIN).reason, 'return-path');
    assert.equal(inspectHeaders(message([
      'From: user@example.com',
      'Resent-From: user@example.com'
    ]), DOMAIN).reason, 'resent');
  });

  test('accepts an encoded-word display name and ignores a header-like body line', () => {
    const parsed = inspectHeaders(message(
      ['From: =?utf-8?q?Ada?= <user@example.com>', 'Subject: zzsubjectzz'],
      'From: evil@other.example'
    ), DOMAIN);
    assert.equal(parsed.ok, true);
    assert.equal(JSON.stringify(parsed).includes('zzsubjectzz'), false);
  });

  test('rejects a From with two addresses, a group, and a comment', () => {
    assert.equal(inspectHeaders(message(['From: <user@example.com><other@example.com>']), DOMAIN).ok, false);
    assert.equal(inspectHeaders(message(['From: undisc:user@example.com;']), DOMAIN).ok, false);
    assert.equal(inspectHeaders(message(['From: user@example.com (Ada)']), DOMAIN).ok, false);
  });
});
