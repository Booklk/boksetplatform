import { create } from 'zustand';

interface VendorTheme {
  vendorId: number | null;
  slug: string | null;
  nameAr: string;
  primaryColor: string; // hex e.g. "#1e3a8a"
  logoUrl: string | null;
  coverImageUrl: string | null;
  isActive: boolean;
}

interface VendorThemeStore extends VendorTheme {
  setTheme: (theme: Partial<VendorTheme>) => void;
  resetTheme: () => void;
  applyToBrowser: (color: string, vendorName?: string, slug?: string) => void;
}

const DEFAULT_COLOR = '#1e3a8a';
const DEFAULT_TITLE = 'احجز الآن';

const defaultState: VendorTheme = {
  vendorId: null,
  slug: null,
  nameAr: '',
  primaryColor: DEFAULT_COLOR,
  logoUrl: null,
  coverImageUrl: null,
  isActive: false,
};

// ─── Hex color utilities ──────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Tint: blend toward white by `amount` (0–1) */
function tint(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

/** Shade: blend toward black by `amount` (0–1) */
function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useVendorTheme = create<VendorThemeStore>((set) => ({
  ...defaultState,

  setTheme: (theme) => set((state) => ({ ...state, ...theme })),

  resetTheme: () => {
    applyColorToBrowser(DEFAULT_COLOR, undefined, undefined);
    document.title = DEFAULT_TITLE;
    set({ ...defaultState });
  },

  applyToBrowser: (color, vendorName, slug) => {
    applyColorToBrowser(color, vendorName, slug);
  },
}));

// ─── DOM mutation (extracted so resetTheme can call it too) ──────────────────

function applyColorToBrowser(color: string, vendorName?: string, slug?: string) {
  const [r, g, b] = hexToRgb(color);
  const lightColor = tint(color, 0.2);
  const darkColor = shade(color, 0.2);

  const root = document.documentElement;
  root.style.setProperty('--color-primary', color);
  root.style.setProperty('--color-primary-light', lightColor);
  root.style.setProperty('--color-primary-dark', darkColor);
  root.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`);

  // Update <meta name="theme-color">
  let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.name = 'theme-color';
    document.head.appendChild(metaThemeColor);
  }
  metaThemeColor.content = color;

  // Update document title
  if (vendorName) {
    document.title = vendorName;
  }

  // Update manifest link for vendor PWA
  const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (manifestLink && slug) {
    manifestLink.href = `/api/manifest/${slug}.json`;
  }

  // Add smooth transition temporarily
  const styleId = 'vendor-theme-transition';
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = '* { transition: background-color 0.3s ease, border-color 0.3s ease; }';
  setTimeout(() => {
    if (style) style.textContent = '';
  }, 500);
}
