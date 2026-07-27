import { serverApi, CACHE_TAGS } from '@/shared/lib/api';
import { Reveal } from '@/shared/motion/primitives';
import { BackButton } from '@/shared/ui/back-button';
import { TestimonialCard, type Testimonial } from '@/features/website/components/testimonials';
import { TestimonialForm } from '@/features/website/components/testimonial-form';
import { Tr } from '@/shared/i18n/tr';

export const metadata = { title: 'Testimonials' };
export const dynamic = 'force-dynamic';

export default async function TestimonialsPage() {
  const items =
    (await serverApi<Testimonial[]>('/cms/testimonials', { tags: [CACHE_TAGS.cms] })) ?? [];

  return (
    <div className="container-page py-14">
      <div className="mb-6">
        <BackButton fallback="/" label="Back to home" />
      </div>
      <Reveal>
        <h1 className="text-4xl font-bold">
          <Tr>What our clients say</Tr>
        </h1>
        <p className="mt-2 text-[rgb(var(--foreground))]/60">
          <Tr>
            {`${items.length} review${items.length === 1 ? '' : 's'} from celebrations we've been part of.`}
          </Tr>
        </p>
      </Reveal>

      {items.length > 0 ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <TestimonialCard key={t.id} t={t} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-[rgb(var(--foreground))]/50">
          <Tr>No reviews yet — be the first!</Tr>
        </p>
      )}

      <section className="mt-16">
        <TestimonialForm />
      </section>
    </div>
  );
}
