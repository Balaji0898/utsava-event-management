import { serverApi, CACHE_TAGS } from '@/shared/lib/api';
import { sanitizeHtml } from '@/shared/lib/sanitize';
import { BackButton } from '@/shared/ui/back-button';

/**
 * Renders an admin-managed legal page (Terms, Privacy, …). Content is authored
 * in the admin WYSIWYG editor and stored as HTML; it is sanitized here before
 * rendering. Falls back to placeholder text when nothing has been set yet.
 */
export async function LegalPage({
  slug,
  title,
  fallback,
}: {
  slug: string;
  title: string;
  fallback: string;
}) {
  const data = await serverApi<{ slug: string; content: string }>(`/cms/legal/${slug}`, {
    tags: [CACHE_TAGS.cms],
  });
  const raw = (data?.content ?? '').trim();
  const html = raw ? sanitizeHtml(raw) : '';

  return (
    <div className="container-page max-w-3xl py-14">
      <div className="mb-6">
        <BackButton fallback="/" label="Back to home" />
      </div>
      <h1 className="text-4xl font-bold">{title}</h1>
      {html ? (
        <div
          className="prose prose-neutral mt-6 max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="mt-4 text-[rgb(var(--foreground))]/70">{fallback}</p>
      )}
    </div>
  );
}
