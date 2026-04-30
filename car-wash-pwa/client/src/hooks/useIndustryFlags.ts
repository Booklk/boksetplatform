import { useAuth } from './useAuth';
import { getIndustryFlags } from '../lib/labels';

/**
 * Vendor-side industry flags. Reads vendor.industry from the auth
 * store and returns the same booleans the public storefront uses.
 *
 * Use this in vendor pages to gate UI that doesn't apply to every
 * sector (e.g. license plate columns, vehicle pickers).
 */
export function useIndustryFlags() {
  const { user } = useAuth();
  return getIndustryFlags(user?.vendor?.industry);
}
