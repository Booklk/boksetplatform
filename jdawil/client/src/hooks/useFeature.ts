import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import api from '../lib/api';

interface PlanWithGates {
  slug: string;
  featureGates: Record<string, boolean>;
}

/**
 * Hook to check if a feature is available for the current vendor's plan.
 *
 * Usage:
 *   const { hasFeature, isLoading, planName } = useFeature('pos');
 *   if (!hasFeature) show upgrade screen;
 */
export function useFeature(featureId: string) {
  const { user } = useAuth();
  const vendorPlan = user?.vendor?.subscriptionPlan ?? 'free';

  // Fetch current plan's feature gates
  const { data: plans = [], isLoading } = useQuery<PlanWithGates[]>({
    queryKey: ['platform-plans'],
    queryFn: () => api.get('/plans').then(r => r.data),
    staleTime: 10 * 60 * 1000, // cache 10 min
  });

  // Find the vendor's plan
  const currentPlan = plans.find(p => p.slug === vendorPlan);
  const gates = currentPlan?.featureGates ?? {};

  // During trial, all features are open
  const isTrial = user?.vendor?.subscriptionStatus === 'trial';

  // Feature is available if: trial OR gate is true OR gate not defined (default open)
  const hasFeature = isTrial || gates[featureId] !== false;

  return {
    hasFeature,
    isLoading,
    isTrial,
    planName: currentPlan?.slug ?? vendorPlan,
    planNameAr: (currentPlan as any)?.nameAr ?? vendorPlan,
  };
}

/**
 * Check multiple features at once.
 */
export function useFeatures(featureIds: string[]) {
  const { user } = useAuth();
  const vendorPlan = user?.vendor?.subscriptionPlan ?? 'free';

  const { data: plans = [], isLoading } = useQuery<PlanWithGates[]>({
    queryKey: ['platform-plans'],
    queryFn: () => api.get('/plans').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const currentPlan = plans.find(p => p.slug === vendorPlan);
  const gates = currentPlan?.featureGates ?? {};
  const isTrial = user?.vendor?.subscriptionStatus === 'trial';

  const results: Record<string, boolean> = {};
  for (const id of featureIds) {
    results[id] = isTrial || gates[id] !== false;
  }

  return { features: results, isLoading, isTrial };
}
