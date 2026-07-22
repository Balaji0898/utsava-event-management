import { LegalPage } from '@/features/website/components/legal-page';

export const metadata = { title: 'Terms & Conditions' };
export const dynamic = 'force-dynamic';

export default function TermsPage() {
  return (
    <LegalPage
      slug="terms"
      title="Terms & Conditions"
      fallback="Our terms & conditions will be published here soon."
    />
  );
}
