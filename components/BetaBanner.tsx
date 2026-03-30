"use client";

import { BETA_CONFIG } from '@/constants/beta';

export default function BetaBanner() {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white text-center text-sm py-2.5 px-4 font-medium">
      {BETA_CONFIG.BANNER_MESSAGE}
    </div>
  );
}
