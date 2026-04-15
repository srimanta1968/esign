export type FieldType = 'signature' | 'initials' | 'date' | 'text';

export interface SignatureField {
  id: string;
  type: FieldType;
  page: number;
  /** X position as percentage of page width (0-100) */
  x: number;
  /** Y position as percentage of page height (0-100) */
  y: number;
  /** Width as percentage of page width */
  width: number;
  /** Height as percentage of page height */
  height: number;
  recipientIndex: number;
  required: boolean;
  /** Optional free-form label for text fields (e.g. "Email", "Address"). */
  label?: string | null;
  value?: string;
  completed?: boolean;
}

/** Preset labels the sender can pick from when placing a Text field. */
export const TEXT_FIELD_LABEL_PRESETS = [
  'Email',
  'Full Name',
  'Company',
  'Title',
  'Address',
  'Phone',
  'Custom',
] as const;

export const RECIPIENT_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700', ring: 'ring-blue-400', hex: '#3b82f6' },
  { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-700', ring: 'ring-green-400', hex: '#22c55e' },
  { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700', ring: 'ring-orange-400', hex: '#f97316' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-700', ring: 'ring-purple-400', hex: '#a855f7' },
  { bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-700', ring: 'ring-pink-400', hex: '#ec4899' },
  { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-700', ring: 'ring-teal-400', hex: '#14b8a6' },
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  signature: 'Sign Here',
  initials: 'Initials',
  date: 'Date',
  text: 'Text',
};

export const FIELD_TYPE_ICONS: Record<FieldType, string> = {
  signature: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  initials: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  date: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  text: 'M4 6h16M4 12h16m-7 6h7',
};

export const DEFAULT_FIELD_SIZE: Record<FieldType, { width: number; height: number }> = {
  signature: { width: 20, height: 6 },
  initials: { width: 10, height: 5 },
  date: { width: 15, height: 4 },
  text: { width: 20, height: 4 },
};
