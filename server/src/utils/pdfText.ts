/**
 * Sanitize a string so it can be drawn by pdf-lib's StandardFonts (WinAnsi).
 * Replaces common typographic characters with ASCII equivalents and strips
 * anything WinAnsi cannot encode (emojis, CJK, etc). Without this, a single
 * unencodable character throws "WinAnsi cannot encode ..." and aborts the
 * entire PDF generation.
 */
export function toWinAnsiSafe(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}
