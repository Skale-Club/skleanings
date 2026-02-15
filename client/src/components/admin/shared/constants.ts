import type { BusinessHours } from './types';
export { DEFAULT_CHAT_OBJECTIVES } from '@/components/chat/admin/types';

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { isOpen: true, start: '08:00', end: '18:00' },
  tuesday: { isOpen: true, start: '08:00', end: '18:00' },
  wednesday: { isOpen: true, start: '08:00', end: '18:00' },
  thursday: { isOpen: true, start: '08:00', end: '18:00' },
  friday: { isOpen: true, start: '08:00', end: '18:00' },
  saturday: { isOpen: false, start: '09:00', end: '14:00' },
  sunday: { isOpen: false, start: '09:00', end: '14:00' },
};

export const INDUSTRY_OPTIONS = [
  'Cleaning',
  'Barbershop',
  'Beauty Salon',
  'Hairdresser',
  'Spa',
  'Fitness',
  'Home Services',
  'Automotive',
  'Other',
] as const;
