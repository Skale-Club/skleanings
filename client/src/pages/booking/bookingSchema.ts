import { z } from 'zod';

export const bookingFormSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Invalid email"),
  customerPhone: z.string().min(10, "Valid phone number required"),
  customerStreet: z.string().min(5, "Street address is required"),
  customerUnit: z.string().optional(),
  customerCity: z.string().min(2, "City is required"),
  customerState: z.string().min(2, "State is required"),
  paymentMethod: z.enum(["site", "online"]),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;
