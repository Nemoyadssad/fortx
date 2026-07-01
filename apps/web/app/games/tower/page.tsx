'use client';

import { ClimberGame } from '@/components/ClimberGame';

export default function TowerPage() {
  return (
    <ClimberGame
      game="tower"
      title="Tower"
      subtitle="Climb floor by floor. One mine hides in each row."
      variant="tower"
      withDifficulty
    />
  );
}
