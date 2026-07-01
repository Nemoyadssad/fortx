import { LegalShell, Section } from '@/components/LegalShell';

export const metadata = { title: 'Privacy Policy — FORTX' };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 2026">
      <p>
        This Policy explains what we collect, why, and your choices. By using FORTX you
        agree to this Policy.
      </p>

      <Section heading="1. What we collect">
        <p>
          Account data you provide (such as e-mail and password, stored only as a secure
          hash). Activity data generated as you use the Service (bets, game rounds, balances,
          ledger entries). Technical data such as device and browser information needed to run
          and secure the Service.
        </p>
      </Section>

      <Section heading="2. How we use it">
        <p>
          To create and secure your account, run games and settle balances, prevent fraud and
          abuse, comply with legal obligations, and — only if you opt in — send promotional
          messages.
        </p>
      </Section>

      <Section heading="3. Cookies and local storage">
        <p>
          We use local storage to keep you signed in (your session token). We do not need
          advertising cookies to run the core Service.
        </p>
      </Section>

      <Section heading="4. Sharing">
        <p>
          We do not sell your personal data. We share data only with service providers that
          help us operate (such as hosting and, where you connect it, a payment provider), and
          where required by law.
        </p>
      </Section>

      <Section heading="5. Retention">
        <p>
          We keep account and transaction records for as long as your account is active and as
          required to meet legal and accounting obligations, then delete or anonymise them.
        </p>
      </Section>

      <Section heading="6. Your rights">
        <p>
          Depending on your location you may have rights to access, correct, export, or delete
          your data, and to withdraw marketing consent at any time. Contact us to exercise
          them.
        </p>
      </Section>

      <Section heading="7. Contact">
        <p>For privacy requests, reach us through in-app live support.</p>
      </Section>
    </LegalShell>
  );
}
