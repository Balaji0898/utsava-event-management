import { LegalPage } from '@/features/website/components/legal-page';

export const metadata = { title: 'Privacy Policy' };
export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  return (
    <LegalPage
      slug="privacy"
      title="Privacy Policy"
      fallback="Our privacy policy will be published here soon."
    />
  );
}
