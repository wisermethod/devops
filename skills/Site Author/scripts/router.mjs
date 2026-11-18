// Shared read-only router assessment and conservative refresh for Site Author.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEADINGS = ['Content vs code', 'Check and preview', 'Publish boundary'];
const PASSAGES = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'scripts/router-passages.json'), 'utf8'));
const slot = (heading, text) => heading !== 'Content vs code' ? 0
  : text.startsWith('Content jobs may change') ? 0 : text.startsWith('`site/src/custom/') ? 1
    : text.startsWith('Content jobs may not change') ? 2 : -1;
const shellQuote = (value) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
export const refreshCommand = (envelope) => `node ${shellQuote(path.join(SKILL_DIR, 'scripts/refresh-router.mjs'))} --site ${shellQuote(envelope)}`;
const reconcile = 'Site Author Refresh router: reconcile the named managed passage with site-AGENTS.md, archive the original before an approved manual rewrite, restore canonical managed policy, and preserve local facts and restrictions unchanged in their own site-local section only when they do not waive a mandatory gate; ask about ambiguous text rather than deleting, relaxing or relocating a waiver to pass; then rerun Refresh router and Check';
function refuse(why) { throw new Error(`${why}; next action: ${reconcile}. Nothing was changed`); }

function stat(file) {
  try { return fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
// Unlike existsSync, lstat also sees dangling links. Check every ancestor before
// opening either the router or its recovery path.
function noLinks(file) {
  for (let part = path.resolve(file); ; part = path.dirname(part)) {
    const info = stat(part);
    if (info?.isSymbolicLink()) refuse(`symbolic link at ${part}`);
    if (part === path.dirname(part)) break;
  }
}
function readRouter(file) {
  noLinks(file);
  const info = stat(file);
  if (!info?.isFile() || !(info.mode & 0o444)) refuse('AGENTS.md is missing, unreadable or not a regular file');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.ino !== info.ino || opened.dev !== info.dev) refuse('AGENTS.md changed while opening');
    const bytes = fs.readFileSync(fd);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.includes('\0')) refuse('AGENTS.md contains NUL');
    return { text, bytes, info };
  } finally { fs.closeSync(fd); }
}
// Mask inactive Markdown without changing UTF-16 offsets or line endings. This
// is deliberately a bounded scanner, not a Markdown renderer. Unsupported text
// inside a managed section still refuses rather than being interpreted as policy.
function activeMarkdown(text) {
  let comment = false;
  let fence = null;
  return text.split(/(?<=\n)/).map((line) => {
    const blank = (value) => value.replace(/[^\r\n]/g, ' ');
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.char}{${fence.length},}[ \\t]*\\r?\\n?$`).test(line)) fence = null;
      return blank(line);
    }
    // A delimiter hidden by a comment cannot open or close a code fence.
    if (!comment) {
      const open = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)/.exec(line);
      if (open && (open[1][0] !== '`' || !open[2].includes('`'))) {
        fence = { char: open[1][0], length: open[1].length };
        return blank(line);
      }
      if (/^(?: {4}| {0,3}\t)/.test(line)) return blank(line);
    }
    let active = '';
    for (let i = 0; i < line.length;) {
      if (comment) {
        const end = line.indexOf('-->', i);
        const stop = end < 0 ? line.length : end + 3;
        active += blank(line.slice(i, stop));
        i = stop;
        if (end >= 0) comment = false;
      } else {
        const start = line.indexOf('<!--', i);
        if (start < 0) { active += line.slice(i); break; }
        active += line.slice(i, start);
        i = start;
        comment = true;
      }
    }
    return active;
  }).join('');
}
function sections(text) {
  const result = {};
  const active = activeMarkdown(text);
  // Raw HTML text containers can hide every following heading from Markdown.
  // Their interpretation is outside the supported router grammar. Refuse tags
  // anywhere in active text, including after a masked comment or inline prefix;
  // a closing tag in a local section must not hide policy from this check.
  if (/<\/?(?:pre|script|style|textarea|xmp|plaintext)(?:\s|>|\/)/i.test(active)) refuse('unsupported raw HTML text container');
  const headings = [...active.matchAll(/^ {0,3}#{1,6}[ \t]+([^\r\n]+)\r?$/gm)];
  for (const name of HEADINGS) {
    const matches = headings.filter((m) => m[1].trim().replace(/[ \t]+#+$/, '').toLowerCase() === name.toLowerCase());
    if (matches.length !== 1 || !matches[0][0].startsWith(`## ${name}`) || matches[0][1] !== name) refuse(`missing, duplicated or ambiguous heading: ${name}`);
    const start = matches[0].index + matches[0][0].length;
    const end = headings.find((m) => m.index > start && /^ {0,3}#{1,2}[ \t]/.test(m[0]))?.index ?? text.length;
    result[name] = { start, end, body: text.slice(start, end), active: active.slice(start, end) };
    if (headings.some((m) => m.index >= start && m.index < end)) refuse(`ambiguous nested heading in ${name}`);
  }
  return result;
}
// Supported envelope frontmatter: unindented ASCII identifier keys, optional
// spaces before ':' and at least one after it, and one single-line scalar per key. Simple quoted
// values are allowed (single quotes double to escape); YAML escapes, comments,
// collections, tags, anchors and block scalars are outside this grammar.
function frontmatter(text) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!front) refuse('not a supported site envelope router: missing frontmatter');
  const fields = new Map();
  let offset = front[0].indexOf('\n') + 1;
  for (const line of front[1].split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*) *: +(.+?) *$/.exec(line);
    if (!match) refuse('unsupported frontmatter: use an unindented flat scalar mapping with unquoted identifier keys and a space after each colon');
    const [, key, raw] = match;
    const normalized = key.toLowerCase();
    if (fields.has(normalized)) refuse(`duplicate frontmatter key: ${key}`);
    if (normalized === 'root' || normalized === 'type') refuse('not a supported site envelope router: root/type declaration');
    let value;
    if (/^"[^"\\\r\n]*"$/.test(raw)) value = raw.slice(1, -1);
    else if (/^'(?:[^'\r\n]|'')*'$/.test(raw)) value = raw.slice(1, -1).replaceAll("''", "'");
    else if (!/^[\s\-?:,\[\]{}#&*!|>'"%@`]/.test(raw) && !/[\t\[\]{}#]|:(?:\s|$)/.test(raw)) value = raw;
    else refuse(`unsupported frontmatter scalar: ${key}; use a plain scalar or simple quoted value without YAML escapes, anchors, tags, collections or blocks`);
    fields.set(normalized, { key, value, start: offset, line, raw });
    offset += line.length + (text.slice(offset + line.length, offset + line.length + 2) === '\r\n' ? 2 : 1);
  }
  const domain = fields.get('domain');
  if (domain?.key !== 'domain' || !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(domain.value)
    || domain.value.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) refuse('missing or unsupported envelope domain identity');
  const version = fields.get('kitversion');
  if (version?.key !== 'kitVersion' || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version.value)) refuse('missing or ambiguous kitVersion');
  return version;
}
function computeRouter(text, kitVersion) {
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(kitVersion)) refuse('invalid target kitVersion');
  const version = frontmatter(text);
  const current = sections(fs.readFileSync(path.join(SKILL_DIR, 'site-AGENTS.md'), 'utf8'));
  const old = sections(text);
  let next = text;
  // Source offsets, not the template's heading order, determine splice order.
  for (const heading of [...HEADINGS].sort((a, b) => old[b].start - old[a].start)) {
    const area = old[heading];
    const targets = current[heading].body.trim().split(/\n\n/);
    const newline = text.includes('\r\n') ? '\r\n' : '\n';
    const paragraphs = area.body.split(/(\r?\n[ \t]*\r?\n)/);
    const seen = new Set();
    let offset = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      const raw = paragraphs[i];
      const active = area.active.slice(offset, offset + raw.length);
      offset += raw.length;
      if (i % 2 || !raw.trim()) continue;
      const passage = raw.trim().replaceAll('\r\n', '\n');
      const match = active.trim() === raw.trim() && PASSAGES[heading].find((p) => p.text === passage);
      if (!match) refuse(`custom managed passage in ${heading}`);
      const index = slot(heading, passage);
      if (index < 0 || seen.has(index)) refuse(`duplicated or unsupported managed passage in ${heading}`);
      seen.add(index);
      paragraphs[i] = raw.replace(raw.trim(), targets[index].replaceAll('\n', newline));
    }
    // Only the oldest template's known missing custom-code policy is filled.
    if (!seen.has(0) || (heading === 'Content vs code' && !seen.has(2))) refuse(`unsupported managed passage in ${heading}`);
    let body = paragraphs.join('');
    if (heading === 'Content vs code' && !seen.has(1)) {
      const before = targets[2].replaceAll('\n', newline);
      body = body.replace(before, `${targets[1].replaceAll('\n', newline)}${newline}${newline}${before}`);
    }
    next = next.slice(0, area.start) + body + next.slice(area.end);
  }
  const line = version.line.replace(version.raw, version.raw.replace(version.value, kitVersion));
  next = next.slice(0, version.start) + line + next.slice(version.start + version.line.length);
  if (/Webmaster\s+Job\s+[23]/i.test(activeMarkdown(next))) refuse('obsolete Webmaster publish instructions outside a recognized passage');
  return next;
}
export function assessRouter(envelope, kitVersion) {
  const file = path.join(envelope, 'AGENTS.md');
  const read = readRouter(file);
  const next = computeRouter(read.text, kitVersion);
  // Validate the complete candidate before even planning an archive. A clean
  // second assessment proves every managed section survived the splices.
  if (computeRouter(next, kitVersion) !== next) refuse('computed router is not idempotent');
  return { ...read, file, next, stale: next !== read.text };
}

export function refreshRouter(envelope, kitVersion) {
  const plan = assessRouter(envelope, kitVersion);
  if (!plan.stale) return { changed: false };
  if (!(plan.info.mode & 0o222)) refuse('AGENTS.md is not writable');
  const dir = path.join(envelope, 'zArchive');
  noLinks(dir);
  const archiveStat = stat(dir);
  if (archiveStat && (!archiveStat.isDirectory() || !(archiveStat.mode & 0o222))) refuse('unsafe or unwritable zArchive path');
  const date = new Date().toISOString().slice(2, 10);
  let archive;
  for (let n = 1; ; n++) {
    archive = path.join(dir, `${date} V${n} - AGENTS.md`);
    const existing = stat(archive);
    if (existing?.isSymbolicLink() || (existing && !existing.isFile())) refuse(`unsafe archive path: ${archive}`);
    if (!existing) break;
  }
  // Verify the router again before creating recovery, and never overwrite an
  // archive. The descriptor write cannot follow a substituted router symlink.
  if (!readRouter(plan.file).bytes.equals(plan.bytes)) refuse('AGENTS.md changed before refresh');
  fs.mkdirSync(dir, { recursive: true });
  noLinks(dir);
  fs.writeFileSync(archive, plan.bytes, { flag: 'wx', mode: plan.info.mode & 0o777 });
  const fd = fs.openSync(plan.file, fs.constants.O_RDWR | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const info = fs.fstatSync(fd);
    if (!info.isFile() || info.ino !== plan.info.ino || info.dev !== plan.info.dev || !fs.readFileSync(fd).equals(plan.bytes)) refuse('AGENTS.md changed before write');
    fs.writeSync(fd, Buffer.from(plan.next), 0, Buffer.byteLength(plan.next), 0);
    fs.ftruncateSync(fd, Buffer.byteLength(plan.next));
  } finally { fs.closeSync(fd); }
  return { changed: true, archive };
}
