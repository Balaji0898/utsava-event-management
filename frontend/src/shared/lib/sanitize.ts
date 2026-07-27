/**
 * Lightweight, dependency-free HTML sanitizer safe to run on the server
 * (serverless/edge) — unlike DOMPurify/jsdom, which crashes in Vercel's Node
 * runtime and 500'd the legal pages. Content comes from the trusted admin
 * WYSIWYG (tiptap: headings, paragraphs, lists, links, bold/italic), so this
 * conservatively strips scripts/embeds, inline event handlers, and
 * javascript: URLs as defense-in-depth.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  return (
    input
      // drop dangerous elements (and their content where relevant)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<\/?(script|style|iframe|object|embed|form|input|link|meta|base)\b[^>]*>/gi, '')
      // strip inline event handlers: onload=, onclick=, ...
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
      // neutralise javascript: URLs in href/src
      .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"')
      .replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'")
  );
}
