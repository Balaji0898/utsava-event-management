import { serverApi, CACHE_TAGS } from '@/shared/lib/api';
import { Reveal } from '@/shared/motion/primitives';
import { BackButton } from '@/shared/ui/back-button';
import { T } from '@/shared/i18n';
import { Tr } from '@/shared/i18n/tr';
import { ServicesGrid, type Department } from '@/features/website/components/services-grid';

export const metadata = { title: 'Services' };

// Render at request time (see homepage note) so services always load live data
// rather than a page prerendered empty at build. Data is cached via `serverApi`.
export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const departments =
    (await serverApi<Department[]>('/departments', { tags: [CACHE_TAGS.departments] })) ?? [];

  return (
    <div className="container-page py-14">
      <div className="mb-6">
        <BackButton fallback="/" label="Back to home" />
      </div>
      <Reveal>
        <h1 className="text-4xl font-bold">
          <T k="services.title" />
        </h1>
        <p className="mt-2 text-[rgb(var(--foreground))]/60">
          <T k="services.subtitle" />
        </p>
      </Reveal>

      <div data-testid="services-list">
        <ServicesGrid departments={departments} />
      </div>

      {departments.length === 0 && (
        <p className="mt-10 text-[rgb(var(--foreground))]/70">
          <Tr>No services available yet.</Tr>
        </p>
      )}
    </div>
  );
}
