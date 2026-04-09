import { useEffect } from 'react';
import { useCompanySettings } from '@/context/CompanySettingsContext';
import { useTheme } from '@/context/ThemeContext';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import {
  hexToHsl,
  contrastForeground,
  adjustLightnessForDark,
  contrastForegroundFromHsl,
} from '@/lib/colorUtils';
import type { HomepageContent } from '@shared/schema';

export function BrandColorInjector() {
  const { settings } = useCompanySettings();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const hc = settings?.homepageContent as HomepageContent | undefined;
    const colors = {
      ...DEFAULT_HOMEPAGE_CONTENT.brandColors,
      ...(hc?.brandColors || {}),
    };

    const primary = colors.primary || '#1C53A3';
    const secondary = colors.secondary || '#FFFF01';

    const primaryHsl = hexToHsl(primary);
    const secondaryHsl = hexToHsl(secondary);
    if (!primaryHsl || !secondaryHsl) return;

    const isDark = resolvedTheme === 'dark';

    // In dark mode, lighten colors that are too dark to read on dark backgrounds.
    const primaryFinal = isDark ? adjustLightnessForDark(primaryHsl) : primaryHsl;
    const secondaryFinal = isDark ? adjustLightnessForDark(secondaryHsl) : secondaryHsl;

    // Foreground is computed from the final (possibly adjusted) color so contrast is correct.
    const primaryFg = isDark
      ? contrastForegroundFromHsl(primaryFinal)
      : contrastForeground(primary);
    const secondaryFg = isDark
      ? contrastForegroundFromHsl(secondaryFinal)
      : contrastForeground(secondary);

    const root = document.documentElement;
    root.style.setProperty('--primary', primaryFinal);
    root.style.setProperty('--primary-foreground', primaryFg);
    root.style.setProperty('--ring', primaryFinal);
    root.style.setProperty('--secondary', secondaryFinal);
    root.style.setProperty('--secondary-foreground', secondaryFg);
    root.style.setProperty('--accent', secondaryFinal);
    root.style.setProperty('--accent-foreground', secondaryFg);
  }, [settings, resolvedTheme]);

  return null;
}
