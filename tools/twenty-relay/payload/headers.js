/**
 * Strict From and Sender grammar.
 *
 * A mailbox is an addr-spec, or an optional display name and one <addr-spec>.
 * The parse consumes the whole value. Groups, comments, routes and a second
 * address do not match. Encoded words are accepted and not decoded.
 * The header block allows only CRLF line endings. Unfolding removes a CRLF
 * that is immediately followed by space or tab, and leaves that space or tab.
 */

const ATEXT = /[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]/;
const FTEXT = /[!-9;-~]/;

function isLabelChar(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '-';
}

function isDigitOrLetter(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9');
}

/**
 * Parse one mailbox. expectedDomain, when given, is compared lowercase and exact.
 * Returns { ok: true, local, domain } or { ok: false }.
 */
export function parseMailbox(value, expectedDomain) {
  if (typeof value !== 'string') return { ok: false };
  const s = value;
  let i = 0;

  function peek() {
    return s[i];
  }

  function eatWsp() {
    while (s[i] === ' ' || s[i] === '\t') i += 1;
  }

  function parseAtom() {
    const start = i;
    while (ATEXT.test(s[i] || '')) i += 1;
    return i > start;
  }

  function parseDotAtom() {
    const start = i;
    if (!parseAtom()) return null;
    while (s[i] === '.') {
      i += 1;
      if (!parseAtom()) return null;
    }
    return s.slice(start, i);
  }

  function parseLabel() {
    const start = i;
    if (!isDigitOrLetter(s[i] || '')) return false;
    i += 1;
    while (isLabelChar(s[i] || '')) i += 1;
    const label = s.slice(start, i);
    if (label.length > 63 || label.endsWith('-')) {
      i = start;
      return false;
    }
    return true;
  }

  function parseDomain() {
    const start = i;
    if (!parseLabel()) return null;
    while (s[i] === '.') {
      const mark = i;
      i += 1;
      if (!parseLabel()) {
        i = mark;
        break;
      }
    }
    const domain = s.slice(start, i);
    if (!domain || domain.length > 253 || domain.endsWith('.')) return null;
    return domain.toLowerCase();
  }

  function parseAddrSpec() {
    const mark = i;
    const local = parseDotAtom();
    if (local === null || s[i] !== '@') {
      i = mark;
      return null;
    }
    i += 1;
    const domain = parseDomain();
    if (domain === null) {
      i = mark;
      return null;
    }
    return { local, domain };
  }

  function parseQuoted() {
    if (s[i] !== '"') return false;
    const mark = i;
    i += 1;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '"') {
        i += 1;
        return true;
      }
      if (ch === '\\') {
        const next = s[i + 1];
        if (next === undefined || next < ' ' || next > '~') {
          i = mark;
          return false;
        }
        i += 2;
        continue;
      }
      if (ch < ' ' || ch > '~') {
        i = mark;
        return false;
      }
      i += 1;
    }
    i = mark;
    return false;
  }

  function parseEncodedWord() {
    if (s.slice(i, i + 2) !== '=?') return false;
    const mark = i;
    i += 2;
    function token() {
      const start = i;
      while (i < s.length) {
        const code = s.charCodeAt(i);
        if (code <= 32 || code >= 127 || s[i] === '?') break;
        i += 1;
      }
      return i > start;
    }
    if (!token() || s[i] !== '?') {
      i = mark;
      return false;
    }
    i += 1;
    if (!token() || s[i] !== '?') {
      i = mark;
      return false;
    }
    i += 1;
    const textStart = i;
    while (i < s.length) {
      const code = s.charCodeAt(i);
      if (code <= 32 || code >= 127 || s[i] === '?') break;
      i += 1;
    }
    if (i === textStart || s.slice(i, i + 2) !== '?=') {
      i = mark;
      return false;
    }
    i += 2;
    return true;
  }

  function parseWord() {
    if (parseEncodedWord()) return true;
    if (parseQuoted()) return true;
    if (parseAtom()) return true;
    return false;
  }

  function parseDisplayName() {
    if (!parseWord()) return false;
    while (true) {
      const mark = i;
      eatWsp();
      if (peek() === '<' || peek() === undefined) {
        i = mark;
        return true;
      }
      if (!parseWord()) {
        i = mark;
        return true;
      }
    }
  }

  function parseAngle() {
    if (s[i] !== '<') return null;
    i += 1;
    if (s[i] === '@' || s[i] === '<') return null;
    const addr = parseAddrSpec();
    if (!addr || s[i] !== '>') return null;
    i += 1;
    return addr;
  }

  function finish(addr) {
    if (!addr) return { ok: false };
    eatWsp();
    if (i !== s.length) return { ok: false };
    if (expectedDomain !== undefined && addr.domain !== String(expectedDomain).toLowerCase()) {
      return { ok: false };
    }
    return { ok: true, local: addr.local, domain: addr.domain };
  }

  eatWsp();
  if (peek() === '<') return finish(parseAngle());

  const mark = i;
  const bare = parseAddrSpec();
  if (bare) {
    const after = i;
    eatWsp();
    if (i === s.length) return finish(bare);
    i = after;
  }
  i = mark;
  if (peek() !== '<') {
    if (!parseDisplayName()) return { ok: false };
    eatWsp();
  }
  return finish(parseAngle());
}

function unfold(text) {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\r' && text[i + 1] === '\n' && (text[i + 2] === ' ' || text[i + 2] === '\t')) {
      i += 1;
      continue;
    }
    out += text[i];
  }
  return out;
}

/**
 * Inspect the header block of a message. The body is not read.
 * A failure carries a reason for tests. The relay does not send that reason.
 */
export function inspectHeaders(message, expectedDomain) {
  const bytes = Buffer.isBuffer(message) ? message : Buffer.from(String(message), 'utf8');
  let end = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    if (b === 0x0d) {
      if (bytes[i + 1] !== 0x0a) return { ok: false, reason: 'bare-cr' };
      if (bytes[i + 2] === 0x0d && bytes[i + 3] === 0x0a) {
        end = i;
        break;
      }
      i += 1;
      continue;
    }
    if (b === 0x0a) return { ok: false, reason: 'bare-lf' };
  }
  if (end < 0) return { ok: false, reason: 'no-separator' };

  const raw = bytes.subarray(0, end).toString('latin1');
  const unfolded = unfold(raw);
  const lines = unfolded.length === 0 ? [] : unfolded.split('\r\n');
  let fromCount = 0;
  let senderCount = 0;
  let fromValue = null;
  let senderValue = null;
  let messageId = '';

  for (const line of lines) {
    if (line === '') return { ok: false, reason: 'empty-line' };
    let name = '';
    let n = 0;
    while (n < line.length && FTEXT.test(line[n])) {
      name += line[n];
      n += 1;
    }
    if (name.length === 0 || line[n] !== ':') return { ok: false, reason: 'bad-field' };
    const lower = name.toLowerCase();
    const value = line.slice(n + 1).replace(/^[ \t]+/, '');
    if (lower === 'return-path') return { ok: false, reason: 'return-path' };
    if (lower.startsWith('resent-')) return { ok: false, reason: 'resent' };
    if (lower === 'from') {
      fromCount += 1;
      fromValue = value;
    } else if (lower === 'sender') {
      senderCount += 1;
      senderValue = value;
    } else if (lower === 'message-id' && messageId === '') {
      messageId = value.replace(/[\r\n\t ]+/g, '');
    }
  }

  if (fromCount !== 1) return { ok: false, reason: 'from-count' };
  if (senderCount > 1) return { ok: false, reason: 'sender-count' };
  const from = parseMailbox(fromValue, expectedDomain);
  if (!from.ok) return { ok: false, reason: 'from' };
  if (senderCount === 1) {
    const sender = parseMailbox(senderValue, expectedDomain);
    if (!sender.ok) return { ok: false, reason: 'sender' };
  }
  return { ok: true, messageId };
}
