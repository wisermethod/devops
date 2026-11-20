// Check and the component both read the same literal URL and path rules.
const unsafeAddress = /[\s\u0000-\u001f\u007f\\<>"']/;
const entity = /&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/i;

export function leadFormActionProblem(value) {
  const instruction = 'must be the absolute https:// intake address from your Wiser CRM install, written as a literal';
  if (typeof value !== 'string' || !/^https:\/\/[^/]/.test(value) || unsafeAddress.test(value) || entity.test(value)) {
    return instruction;
  }
  if (/[?#]/.test(value)) return 'must have no query or fragment. The intake worker sets the return address';
  try {
    const url = new URL(value);
    if (url.username || url.password) return 'must have no credentials. Use the public intake address from your Wiser CRM install';
    return null;
  } catch {
    return instruction;
  }
}

// Return the site route used to look up the page in content and dist/.
export function leadFormPrivacyRoute(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || unsafeAddress.test(value) || entity.test(value) || /[?#]|%2f/i.test(value)) return null;
  if (value === '/') return value;
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  if (unsafeAddress.test(decoded) || /[?#]/.test(decoded)) return null;
  const segments = decoded.slice(1).split('/');
  return segments.every((part) => part && part !== '.' && part !== '..') ? decoded : null;
}
