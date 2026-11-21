// With build.format 'file', Astro's build-time URL ends in .html. The site's public URL does not.
export function publicPagePath(pathname) {
  return pathname.replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/+$/, '') || '/';
}
