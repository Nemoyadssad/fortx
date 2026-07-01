import { LegalShell, Section } from '@/components/LegalShell';

export const metadata = { title: 'Responsible Gaming — FORTX' };

export default function ResponsibleGamingPage() {
  return (
    <LegalShell title="Responsible Gaming" updated="June 2026">
      <p>
        FORTX is meant to be entertaining. Play for fun, within limits you set for yourself,
        and never to chase losses or as a way to make money.
      </p>

      <Section heading="18+ only">
        <p>
          The Service is strictly for adults aged 18 or older (or the age of majority where
          you live). We may ask you to verify your age.
        </p>
      </Section>

      <Section heading="Stay in control">
        <p>
          Decide in advance how much time and how much you want to spend, and stop when
          you reach that limit. Take regular breaks. Don’t play when stressed, upset, or under
          the influence.
        </p>
      </Section>

      <Section heading="Warning signs">
        <p>
          Spending more time or more than you intended, trying to win back losses, hiding
          your play, or feeling anxious about it are signs to step back. If play stops being
          fun, take a break.
        </p>
      </Section>

      <Section heading="Self-exclusion">
        <p>
          If you’d like to pause or close your account, contact in-app live support and we’ll
          help you take a break or self-exclude.
        </p>
      </Section>

      <Section heading="Getting help">
        <p>
          If gambling is affecting your life or someone you know, please reach out to a local
          support organisation in your country for confidential help and advice.
        </p>
      </Section>
    </LegalShell>
  );
}
