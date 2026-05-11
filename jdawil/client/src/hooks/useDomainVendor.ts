// On app load, checks if current domain is a vendor domain
// If yes: auto-loads vendor theme and redirects to /store/:slug
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useVendorTheme } from '../store/vendorTheme';

export function useDomainVendor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { applyToBrowser } = useVendorTheme();

  useEffect(() => {
    axios.get('/api/domain/detect').then(({ data }) => {
      if (data.vendorSlug && !location.pathname.startsWith('/store/')) {
        navigate(`/store/${data.vendorSlug}`, { replace: true });
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
