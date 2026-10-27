// The shared document: a trip plan in three sections. Its contents live only
// in the browsers that have it open; a real app saves them in its database.

export const DOC_PREFIX = 'presence-plan-';

export function newCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function validCode(code: string): boolean {
  return /^[A-Z0-9]{5}$/.test(code);
}

export interface Field {
  id: string;
  label: string;
  multiline?: boolean;
}

export const SECTIONS: { id: string; label: string; fields: Field[] }[] = [
  {
    id: 'trip',
    label: 'Trip',
    fields: [
      { id: 'title', label: 'Trip name' },
      { id: 'destination', label: 'Destination' },
      { id: 'dates', label: 'Dates' },
    ],
  },
  {
    id: 'budget',
    label: 'Budget',
    fields: [
      { id: 'flights', label: 'Flights' },
      { id: 'hotel', label: 'Hotel' },
      { id: 'food', label: 'Food and fun' },
    ],
  },
  {
    id: 'notes',
    label: 'Notes',
    fields: [
      { id: 'packing', label: 'Packing list', multiline: true },
      { id: 'ideas', label: 'Ideas', multiline: true },
    ],
  },
];

export const COLORS = ['#e5484d', '#f76b15', '#ffc53d', '#30a46c', '#0090ff', '#8e4ec6', '#d6409f', '#12a594'];
