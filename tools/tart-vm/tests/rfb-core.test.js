import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { RfbClient, desEncryptBlock, textKeyEvents, vncKey } from '../scripts/tart-vm-core.js';

const capture = fs.readFileSync(new URL('fixtures/rfb-server.bin', import.meta.url));

test('DES encrypts independent known vectors and the VNC key reverses only the first eight bytes', () => {
  for (const [key, plain, cipher] of [
    ['133457799BBCDFF1', '0123456789ABCDEF', '85E813540F0AB405'],
    ['0000000000000000', '0000000000000000', '8CA64DE9C1B123A7']
  ]) {
    const encrypted = desEncryptBlock(Buffer.from(key, 'hex'), Buffer.from(plain, 'hex'));
    assert.equal(encrypted.toString('hex'), cipher.toLowerCase());
  }
  assert.equal(vncKey('password plus').toString('hex'), '0e86ceceeef64e26');
  assert.equal(vncKey('pa').toString('hex'), '0e86000000000000');
  assert.equal(vncKey(Uint8Array.of(0x01, 0x81)).toString('hex'), '8081000000000000');
});

test('one-byte feeds decode the recorded Tart handshake and exact 64x64 pixel bytes', () => {
  assert.equal(capture.length, 16472);
  assert.equal(capture.toString('ascii', 0, 12), 'RFB 003.008\n');
  assert.deepEqual([...capture.subarray(12, 14)], [1, 2]);
  assert.equal(capture.readUInt32BE(30), 0);
  assert.equal(capture.toString('ascii', 58, 72), 'Virtualization');
  assert.equal(capture.subarray(72, 88).toString('hex'), '00000001000000000040004000000000');

  const client = new RfbClient('password');
  const events = [];
  const messages = [];
  for (let offset = 0; offset < capture.length; offset += 1) {
    const result = client.feed(Uint8Array.of(capture[offset]));
    events.push(...result.events);
    messages.push(...result.send);
  }
  assert.deepEqual(events, [
    { type: 'version', version: 'RFB 003.008' },
    { type: 'security', offered: [2], selected: 2 },
    { type: 'security-result', result: 0 },
    { type: 'server-init', width: 1024, height: 768, name: 'Virtualization', format: {
      bpp: 32, depth: 24, bigEndian: false, trueColour: true, redMax: 255, greenMax: 255,
      blueMax: 255, redShift: 16, greenShift: 8, blueShift: 0
    } },
    { type: 'framebuffer-update', raw: [{ x: 0, y: 0, width: 64, height: 64 }], resized: false }
  ]);
  assert.equal(messages[0].toString('ascii'), 'RFB 003.008\n');
  assert.equal(messages[1].toString('hex'), '02');
  assert.equal(messages[2].length, 16);
  assert.equal(messages[3].toString('hex'), '01');
  assert.equal(messages[4].toString('hex'), '0200000200000000ffffff21');
  assert.equal(messages.length, 5);
  const { width, height, pixels } = client.framebuffer;
  assert.deepEqual([width, height], [1024, 768]);
  for (let row = 0; row < 64; row += 1) {
    assert.deepEqual(pixels.subarray(row * 4096, row * 4096 + 256),
      capture.subarray(88 + row * 256, 88 + (row + 1) * 256));
  }
  assert.deepEqual([...pixels.subarray(256, 260)], [0, 0, 0, 0]);
});

test('format negotiation requests BGRX and server clipboard bytes are dropped, with Bell ignored by the client', () => {
  const client = new RfbClient('password');
  const handshake = Buffer.from(capture.subarray(0, 72));
  handshake[38] = 16;
  const { send } = client.feed(handshake);
  assert.equal(send.at(-2).toString('hex'), '000000002018000100ff00ff00ff100800000000');
  const cutText = Buffer.from('030000000000000300010202', 'hex');
  assert.deepEqual(client.feed(cutText.subarray(0, 9)), { send: [], events: [] });
  assert.deepEqual(client.feed(cutText.subarray(9)), {
    send: [], events: [{ type: 'server-cut-text-dropped' }, { type: 'bell' }]
  });
  assert.throws(() => client.feed(Buffer.from([1])), /SetColourMapEntries.*true colour/);
});

test('the complete shifted punctuation set maps to the unshifted physical keys', () => {
  const events = textKeyEvents('~!@#$%^&*()_+{}|:"<>?');
  const unshifted = '`1234567890-=[]\\;\',./';
  assert.equal(events.length, unshifted.length * 4);
  for (const [index, character] of [...unshifted].entries()) {
    assert.deepEqual(events.slice(index * 4, index * 4 + 4).map((bytes) => [bytes[1], bytes.readUInt32BE(4)]),
      [[1, 0xffe1], [1, character.charCodeAt(0)], [0, character.charCodeAt(0)], [0, 0xffe1]]);
  }
});

function hostInputCalls(source) {
  return source.match(/CGEvent|CGPost|CGWarpMouseCursorPosition|IOHIDPostEvent|hidutil|osascript|System Events|pbcopy|pbpaste|NSPasteboard|cliclick/gi) ?? [];
}

function checkScripts(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) checkScripts(path);
    else if (entry.isFile()) assert.deepEqual(hostInputCalls(fs.readFileSync(path, 'utf8')), [], path);
  }
}

test('no script in the tool uses host-input or clipboard calls', () => {
  checkScripts(fileURLToPath(new URL('../scripts/', import.meta.url)));
});

test('the host-input matcher refuses a planted call', () => {
  assert.deepEqual(hostInputCalls('native.CGEventPost(tap, event);'), ['CGEvent']);
  assert.deepEqual(hostInputCalls('spawn("osascript", ["-e", "tell application System Events"]);'),
    ['osascript', 'System Events']);
  assert.deepEqual(hostInputCalls('native.CGPostMouseEvent(point, true, 1, true); CGPostKeyboardEvent(0, 49, true);'),
    ['CGPost', 'CGPost']);
  assert.deepEqual(hostInputCalls('IOHIDPostEvent(port, type, location, data); spawn("hidutil", ["property"]);'),
    ['IOHIDPostEvent', 'hidutil']);
});

test('server cut text over the cap ends the session instead of stalling it', () => {
  const client = new RfbClient('password');
  client.feed(capture);
  assert.throws(() => client.feed(Uint8Array.of(3, 0, 0, 0, 0xff, 0xff, 0xff, 0xff)), /cut text of 4294967295 bytes/);
  const small = new RfbClient('password');
  small.feed(capture);
  const { events } = small.feed(Uint8Array.of(3, 0, 0, 0, 0, 0, 0, 2, 0x68, 0x69));
  assert.deepEqual(events, [{ type: 'server-cut-text-dropped' }]);
});
