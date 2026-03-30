"use client";

import { useState, useEffect } from 'react';
import { BETA_CONFIG } from '@/constants/beta';

export default function BetaSpots() {
  const [spotsLeft, setSpotsLeft] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/beta/spots')
      .then(res => res.json())
      .then(data => setSpotsLeft(data.spotsLeft))
      .catch(() => setSpotsLeft(BETA_CONFIG.BETA_USER_LIMIT));
  }, []);

  if (!BETA_CONFIG.IS_BETA) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      <span className="text-[12px] text-[#888]">
        {spotsLeft !== null ? (
          <>
            <span className="text-white font-medium">{spotsLeft}</span>
            {' '}beta spots remaining
          </>
        ) : (
          'Loading...'
        )}
      </span>
    </div>
  );
}
