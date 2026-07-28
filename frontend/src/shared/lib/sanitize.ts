/**
 * Dependency-free, allowlist-based HTML sanitizer safe to run on the server
 * (serverless/edge) — unlike DOMPurify/jsdom, which crashes in Vercel's Node
 * runtime and 500'd the legal pages.
 *
 * Content comes from the trusted admin WYSIWYG (tiptap: headings, paragraphs,
 * lists, links, bold/italic). This is an ALLOWLIST: only known-safe tags survive
 * (unknown tags are dropped), and on those tags only an explicit set of
 * attributes is kept — so inline event handlers (onerror/onload/onclick/…) and
 * every other attribute are removed by construction, not by pattern-matching.
 * URL attributes are additionally restricted to safe schemes, which blocks
 * `javascript:`/`data:` URLs (including entity-encoded and unquoted forms).
 */

// Tags kept in the output. Anything else has its tags stripped (text preserved).
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'small', 'sub', 'sup', 'mark',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

// Per-tag attribute allowlist. Any attribute not listed here is dropped, which
// removes all on* event handlers and style/srcset/etc. by construction.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
};

// Tags whose entire contents (not just the tag) must be discarded.
const VOID_CONTENT = /<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi;

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos|colon);/gi, (m, n) => {
      const map: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':' };
      return map[n.toLowerCase()] ?? m;
    });
}

/** True if a URL attribute value uses a safe scheme (or is relative/anchor). */
function isSafeUrl(raw: string): boolean {
  // Decode entities, then strip whitespace and ALL control chars so tricks like
  // "java\tscript:" or "javascript&#58;" can't slip a dangerous scheme through.
  const value = decodeEntities(raw)
    .replace(/[\s\u0000-\u001F\u007F]+/g, '')
    .toLowerCase();
  if (!value) return false;
  // Relative paths, anchors, and query/fragment-only URLs are safe.
  if (/^(\/|#|\.|\?)/.test(value)) return true;
  // Explicit safe schemes only (blocks javascript:, data:, vbscript:, …).
  return /^(https?:|mailto:|tel:)/.test(value);
}

function parseAttrs(attrString: string): Array<{ name: string; value: string | null }> {
  const attrs: Array<{ name: string; value: string | null }> = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrString)) !== null) {
    const name = m[1];
    let value: string | null = null;
    if (m[2] != null) {
      value = m[2].replace(/^["']|["']$/g, '');
    }
    attrs.push({ name, value });
  }
  return attrs;
}

function rebuildTag(closing: boolean, tag: string, attrString: string, selfClose: boolean): string {
  if (closing) return `</${tag}>`;
  const allowed = ALLOWED_ATTRS[tag];
  const kept: string[] = [];
  if (allowed) {
    for (const { name, value } of parseAttrs(attrString)) {
      const lname = name.toLowerCase();
      if (lname.startsWith('on')) continue; // never keep event handlers
      if (!allowed.has(lname)) continue;
      if ((lname === 'href' || lname === 'src') && value != null && !isSafeUrl(value)) continue;
      if (value == null) {
        kept.push(lname);
      } else {
        const safe = value.replace(/"/g, '&quot;');
        kept.push(`${lname}="${safe}"`);
      }
    }
    // Harden external links against reverse-tabnabbing.
    if (tag === 'a' && kept.some((a) => a.startsWith('target='))) {
      if (!kept.some((a) => a.startsWith('rel='))) kept.push('rel="noopener noreferrer"');
    }
  }
  const body = kept.length ? ` ${kept.join(' ')}` : '';
  return `<${tag}${body}${selfClose ? ' /' : ''}>`;
}

export function sanitizeHtml(input: string): string {
  if (!input) return '';
  let html = input
    // strip comments and dangerous elements together with their contents
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(VOID_CONTENT, '');

  html = html.replace(
    // match an opening/closing tag; attribute part tolerates quoted strings
    /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\s*(\/)?\s*>/g,
    (match, closing, rawTag, attrString, selfClose) => {
      const tag = String(rawTag).toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return ''; // drop unknown tags, keep text
      return rebuildTag(Boolean(closing), tag, attrString ?? '', Boolean(selfClose));
    },
  );

  return html;
}
