'use client';

import { ClimberGame } from '@/components/ClimberGame';

export default function LadderPage() {
  return (
    <ClimberGame
      game="ladder"
      title="Ladder"
      subtitle="Climb the rungs. The multiplier grows with every safe step."
      variant="ladder"
    />
  );
}
