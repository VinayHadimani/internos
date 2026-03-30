import { BETA_CONFIG } from '@/constants/beta';

interface UserLimits {
  tailoring_count: number;
  matches_visible: number;
  cover_letters: boolean;
  email_alerts: boolean;
  application_tracking: boolean;
}

export function getUserLimits(plan: string): UserLimits {
  if (BETA_CONFIG.IS_BETA) {
    return BETA_CONFIG.LIMITS;
  }

  switch (plan) {
    case 'pro':
    case 'annual':
      return {
        tailoring_count: 999999,
        matches_visible: 999999,
        cover_letters: true,
        email_alerts: true,
        application_tracking: true,
      };
    case 'free':
    default:
      return {
        tailoring_count: 2,
        matches_visible: 10,
        cover_letters: false,
        email_alerts: false,
        application_tracking: true,
      };
  }
}

export function canUseFeature(
  feature: string,
  plan: string,
  usage: number
): boolean {
  const limits = getUserLimits(plan);
  const featureMap: Record<string, keyof UserLimits> = {
    tailoring: 'tailoring_count',
    matches: 'matches_visible',
    cover_letters: 'cover_letters',
    email_alerts: 'email_alerts',
    application_tracking: 'application_tracking',
  };

  const limit = limits[featureMap[feature]];
  if (typeof limit === 'boolean') return limit;
  if (typeof limit === 'number') return usage < limit;

  return false;
}
