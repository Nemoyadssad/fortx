import { LegalShell, Section } from '@/components/LegalShell';

export const metadata = { title: 'Terms of Use — FORTX' };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Use" updated="June 2026">
      <p>
        These Terms govern your use of FORTX (the “Service”). By creating an account or
        using the Service you agree to these Terms. If you do not agree, do not use the
        Service.
      </p>

      <Section heading="1. Eligibility">
        <p>
          You must be at least 18 years old (or the age of majority in your jurisdiction,
          whichever is higher) and legally permitted to use the Service where you live. You
          are responsible for ensuring the Service is lawful in your location.
        </p>
      </Section>

      <Section heading="2. Your account">
        <p>
          You agree to provide accurate information, keep your credentials secure, and accept
          responsibility for all activity on your account. One account per person. We may
          suspend or close accounts that breach these Terms.
        </p>
      </Section>

     <Section heading="3. Balance and play">
        <p>
          Your account balance reflects deposits, withdrawals, winnings, and any promotional
          credit, subject to the rules of each game and promotion. Game outcomes are
          determined server-side using a provably-fair method.
        </p>
      </Section>

      <Section heading="4. Bonuses and promo codes">
        <p>
          Welcome packs, promo codes, and other offers may carry conditions (eligibility,
          wagering, expiry). We may modify or withdraw an offer, and may void bonuses obtained
          through abuse, fraud, or error.
        </p>
      </Section>

      <Section heading="5. Fair use">
        <p>
          You agree not to cheat, exploit bugs, use bots or automation, collude, or attempt to
          manipulate outcomes or balances. Doing so may result in forfeited balances and
          account closure.
        </p>
      </Section>

      <Section heading="6. Availability and changes">
        <p>
          The Service is provided “as is”. We may change, suspend, or discontinue features at
          any time. We may update these Terms; continued use after changes means you accept
          them.
        </p>
      </Section>

      <Section heading="7. Limitation of liability">
        <p>
          To the maximum extent permitted by law, we are not liable for indirect or
          consequential losses arising from your use of the Service.
        </p>
      </Section>

      <Section heading="8. Contact">
        <p>Questions about these Terms? Reach us through in-app live support.</p>
      </Section>
    </LegalShell>
  );
}
