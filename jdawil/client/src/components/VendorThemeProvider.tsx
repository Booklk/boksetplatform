import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useVendorTheme } from '../store/vendorTheme';

interface VendorPublicData {
  id: number;
  nameAr: string;
  nameEn?: string;
  slug: string;
  primaryColor: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  isActive?: boolean;
  [key: string]: unknown;
}

interface VendorThemeProviderProps {
  slug?: string;
  vendorData?: VendorPublicData;
  children: React.ReactNode;
}

export function VendorThemeProvider({ slug, vendorData, children }: VendorThemeProviderProps) {
  const { setTheme, resetTheme, applyToBrowser } = useVendorTheme();

  const { data: fetchedData } = useQuery<VendorPublicData>({
    queryKey: ['vendor-public', slug],
    queryFn: () => api.get(`/vendors/public/${slug}`).then((r) => r.data),
    enabled: !!slug && !vendorData,
    staleTime: 5 * 60 * 1000, // 5 min — vendor branding rarely changes
  });

  const data = vendorData ?? fetchedData;

  useEffect(() => {
    if (data) {
      setTheme({
        vendorId: data.id,
        slug: data.slug,
        nameAr: data.nameAr,
        primaryColor: data.primaryColor ?? '#1e3a8a',
        logoUrl: data.logoUrl,
        coverImageUrl: data.coverImageUrl,
        isActive: data.isActive ?? true,
      });
      applyToBrowser(data.primaryColor ?? '#1e3a8a', data.nameAr, data.slug);
    }

    return () => {
      resetTheme();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, data?.primaryColor]);

  return <>{children}</>;
}
