import { themeQuartz } from 'ag-grid-enterprise';

/**
 * ظاهر یکسان همه‌ی جدول‌های ag-grid، متصل به توکن‌های طراحی (src/styles/tokens.css).
 * چون مقادیر var(--mm-*) هستند، با تغییر حالت روشن/تیره خودکار عوض می‌شوند.
 */
export const appGridTheme = themeQuartz.withParams({
  fontFamily: ['Vazirmatn FD', 'Vazirmatn', 'Sahel', 'Tahoma', 'sans-serif'],
  headerFontFamily: ['Vazirmatn FD', 'Vazirmatn', 'Sahel', 'Tahoma', 'sans-serif'],
  cellFontFamily: ['Vazirmatn FD', 'Vazirmatn', 'Sahel', 'Tahoma', 'sans-serif'],
  fontSize: 13,
  headerFontSize: 13,
  headerFontWeight: 700,
  accentColor: 'var(--mm-primary)',
  backgroundColor: 'var(--mm-surface)',
  foregroundColor: 'var(--mm-text)',
  textColor: 'var(--mm-text)',
  borderColor: 'var(--mm-border)',
  chromeBackgroundColor: 'var(--mm-surface-2)',
  headerBackgroundColor: 'var(--mm-surface-2)',
  headerTextColor: 'var(--mm-muted)',
  oddRowBackgroundColor: 'var(--mm-surface)',
  rowHoverColor: 'var(--mm-primary-50)',
  selectedRowBackgroundColor: 'var(--mm-primary-100)',
  columnHoverColor: 'transparent',
  rangeSelectionBorderColor: 'var(--mm-primary)',
  inputFocusBorder: { color: 'var(--mm-primary)' },
  borderRadius: 8,
  wrapperBorderRadius: 16,
  rowHeight: 46,
  headerHeight: 46,
  spacing: 7,
  wrapperBorder: { color: 'var(--mm-border)' },
  rowBorder: { color: 'var(--mm-border)' },
  headerRowBorder: { color: 'var(--mm-border)' },
  columnBorder: false,
  iconSize: 15,
  menuBackgroundColor: 'var(--mm-surface)',
  menuBorder: { color: 'var(--mm-border)' },
  menuShadow: { radius: 24, spread: 0, color: 'rgba(15, 27, 45, .18)', offsetY: 12 },
});
