/**
 * Chat Tool Schemas - Zod schemas for all tool inputs
 * 
 * This file contains type-safe schemas for all chat tool inputs
 * Using Zod for validation and TypeScript type inference
 */

import { z } from 'zod';

// ===========================================
// Tool Input Schemas
// ===========================================

export const listServicesSchema = z.object({
    query: z.string().optional().describe('Search by size/type (e.g. "7 seater", "sectional", "large")'),
});

export const getServiceDetailsSchema = z.object({
    service_id: z.number().int().positive().describe('ID of the service'),
});

export const suggestBookingDatesSchema = z.object({
    service_id: z.number().int().positive().describe('ID of the service to determine duration'),
    specific_date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('Optional specific date to check (YYYY-MM-DD). If provided, will check this date and surrounding dates.'),
    max_suggestions: z.number().int().min(1).max(5).default(3)
        .optional()
        .describe('Maximum number of date suggestions to return (default 3, max 5)'),
});

export const serviceItemSchema = z.object({
    service_id: z.number().int().positive(),
    quantity: z.number().int().positive().default(1),
    area_size: z.string().optional(),
    area_value: z.number().positive().optional(),
    selected_options: z.array(z.object({
        option_id: z.number().int().positive(),
        quantity: z.number().int().positive().default(1),
    })).optional(),
    selected_frequency_id: z.number().int().positive().optional(),
    customer_notes: z.string().optional(),
});

export const createBookingSchema = z.object({
    service_ids: z.array(z.number().int().positive()).optional()
        .describe('IDs of services to book (for simple fixed pricing)'),
    service_items: z.array(serviceItemSchema).optional()
        .describe('Detailed service items for non-fixed pricing types'),
    booking_date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe('Booking date in YYYY-MM-DD (business timezone)'),
    start_time: z.string()
        .regex(/^\d{2}:\d{2}$/)
        .describe('Start time in HH:mm (24h, business timezone)'),
    customer_name: z.string().min(1).optional().describe('Customer full name'),
    customer_email: z.string().email().optional().describe('Customer email (only if provided)'),
    customer_phone: z.string().min(1).optional().describe('Customer phone'),
    customer_address: z.string().min(1).optional().describe('Full address with street, city, state, and unit if applicable'),
    payment_method: z.enum(['site', 'online']).default('site').optional()
        .describe('Payment method; defaults to site'),
    notes: z.string().optional().nullable().describe('Any additional notes from the customer'),
});

export const updateContactSchema = z.object({
    name: z.string().optional().describe('Visitor name'),
    email: z.string().email().optional().describe('Visitor email'),
    phone: z.string().optional().describe('Visitor phone'),
});

export const updateMemorySchema = z.object({
    selected_service: z.object({
        id: z.number().optional(),
        name: z.string().optional(),
        price: z.string().optional(),
    }).optional().describe('DEPRECATED: Use add_service tool instead'),
    zipcode: z.string().optional().describe("Customer's ZIP code"),
    service_type: z.string().optional().describe('Type of service selected'),
    service_details: z.string().optional().describe('Service details (size, material, notes)'),
    preferred_date: z.string().optional().describe("Customer's preferred date"),
    selected_date: z.string().optional().describe('Confirmed booking date (YYYY-MM-DD)'),
    selected_time: z.string().optional().describe('Confirmed booking time (HH:mm)'),
    name: z.string().optional().describe('Customer name'),
    phone: z.string().optional().describe('Customer phone'),
    email: z.string().optional().describe('Customer email'),
    address: z.string().optional().describe('Customer full address'),
    current_step: z.string().optional().describe('Current step in the intake flow'),
    completed_step: z.string().optional().describe('Step that was just completed'),
});

export const addServiceSchema = z.object({
    service_id: z.number().int().positive().describe('ID of the service from list_services'),
    service_name: z.string().min(1).describe('Name of the service'),
    price: z.number().positive().describe('Price of the service'),
    quantity: z.number().int().positive().default(1).describe('Quantity of the service (default 1)'),
});

export const viewCartSchema = z.object({});

export const getBusinessPoliciesSchema = z.object({});

export const searchFaqsSchema = z.object({
    query: z.string().optional().describe('Search keywords to filter FAQs'),
});

// ===========================================
// Type exports
// ===========================================

export type ListServicesInput = z.infer<typeof listServicesSchema>;
export type GetServiceDetailsInput = z.infer<typeof getServiceDetailsSchema>;
export type SuggestBookingDatesInput = z.infer<typeof suggestBookingDatesSchema>;
export type ServiceItemInput = z.infer<typeof serviceItemSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
export type AddServiceInput = z.infer<typeof addServiceSchema>;
export type ViewCartInput = z.infer<typeof viewCartSchema>;
export type GetBusinessPoliciesInput = z.infer<typeof getBusinessPoliciesSchema>;
export type SearchFaqsInput = z.infer<typeof searchFaqsSchema>;
