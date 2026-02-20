const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = process.env.GHL_API_VERSION || "2021-04-15";

// Timezone utilities for dynamic EST/EDT handling
function getTimezoneOffset(date: Date, timezone: string = "America/New_York"): string {
  // Get the offset for the specific date (handles DST automatically)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset'
  });
  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find(p => p.type === 'timeZoneName');

  if (offsetPart) {
    // Convert "GMT-5" or "GMT-4" to "-05:00" or "-04:00"
    const match = offsetPart.value.match(/GMT([+-])(\d+)/);
    if (match) {
      const sign = match[1];
      const hours = match[2].padStart(2, '0');
      return `${sign}${hours}:00`;
    }
  }

  // Fallback: calculate offset manually
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const diffMinutes = (tzDate.getTime() - utcDate.getTime()) / 60000;
  const hours = Math.floor(Math.abs(diffMinutes) / 60);
  const minutes = Math.abs(diffMinutes) % 60;
  const sign = diffMinutes >= 0 ? '+' : '-';
  return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function formatDateTimeWithTimezone(dateStr: string, timeStr: string, timezone: string = "America/New_York"): string {
  // Parse the date and time
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Create a date object in the target timezone
  const date = new Date(year, month - 1, day, hours, minutes);
  const offset = getTimezoneOffset(date, timezone);

  // Format: 2024-01-27T12:00:00-05:00
  return `${dateStr}T${timeStr}:00${offset}`;
}

// Retry logic with exponential backoff
interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    retryableStatuses = [408, 429, 500, 502, 503, 504]
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      const status = error.status || error.statusCode;
      const isRetryable = !status || retryableStatuses.includes(status);

      if (attempt < maxRetries && isRetryable) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        console.log(`[GHL] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

export interface GHLSlotItem {
  startTime: string;
  endTime: string;
}

export interface GHLFreeSlotsResponse {
  slots?: GHLSlotItem[];
  [date: string]: any;
}

export interface GHLContact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  locationId: string;
}

export interface GHLAppointment {
  id: string;
  calendarId: string;
  contactId: string;
  startTime: string;
  endTime: string;
  title: string;
  status: string;
}

async function ghlFetch(
  endpoint: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${GHL_BASE_URL}${endpoint}`;
  const startTime = Date.now();

  console.log('[GHL API] Request:', {
    method: options.method || 'GET',
    endpoint,
    url
  });

  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Version": GHL_API_VERSION,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const duration = Date.now() - startTime;
  console.log('[GHL API] Response:', {
    endpoint,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    duration: `${duration}ms`
  });

  return response;
}

export async function testGHLConnection(apiKey: string, locationId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await ghlFetch(`/locations/${locationId}`, apiKey);
    
    if (response.ok) {
      return { success: true, message: "Connection successful" };
    } else {
      const error = await response.json().catch(() => ({}));
      return { 
        success: false, 
        message: error.message || `Connection failed: ${response.status}` 
      };
    }
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message || "Connection failed" 
    };
  }
}

export async function getGHLFreeSlots(
  apiKey: string,
  calendarId: string,
  startDate: Date,
  endDate: Date,
  timezone: string = "America/New_York"
): Promise<{ success: boolean; slots?: GHLSlotItem[]; message?: string }> {
  return withRetry(async () => {
    const startTimestamp = Math.floor(startDate.getTime());
    const endTimestamp = Math.floor(endDate.getTime());

    const params = new URLSearchParams({
      startDate: startTimestamp.toString(),
      endDate: endTimestamp.toString(),
      timezone,
    });

    const response = await ghlFetch(
      `/calendars/${calendarId}/free-slots?${params.toString()}`,
      apiKey
    );

    if (response.ok) {
      const data = await response.json();
      console.log('GHL raw API response:', JSON.stringify(data, null, 2));

      let slotsArray: GHLSlotItem[] = [];

      if (Array.isArray(data)) {
        slotsArray = data;
      } else if (data.slots && Array.isArray(data.slots)) {
        slotsArray = data.slots;
      } else if (data._embedded && data._embedded.slots) {
        slotsArray = data._embedded.slots;
      } else {
        // GHL returns slots grouped by date like: { "2026-01-09": { slots: [...] }, "2026-01-10": { slots: [...] } }
        // We need to iterate ALL dates and accumulate all slots
        for (const key of Object.keys(data)) {
          if (key !== 'traceId' && data[key]?.slots && Array.isArray(data[key].slots)) {
            const dateSlots = data[key].slots.map((s: string) => {
              const normalizedStart = typeof s === "string" && s.includes("T") ? s : `${key}T${s}`;
              return {
                startTime: normalizedStart,
                endTime: normalizedStart,
              };
            });
            slotsArray = slotsArray.concat(dateSlots);
          }
        }
      }

      return { success: true, slots: slotsArray };
    } else {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.message || `Failed to get slots: ${response.status}`);
      (err as any).status = response.status;
      throw err;
    }
  }, { maxRetries: 3 }).catch((error: any) => ({
    success: false,
    message: error.message || "Failed to fetch free slots"
  }));
}

export async function createGHLContact(
  apiKey: string,
  locationId: string,
  contact: {
    email?: string;
    firstName: string;
    lastName: string;
    phone: string;
    address?: string;
  }
): Promise<{ success: boolean; contactId?: string; message?: string }> {
  return withRetry(async () => {
    const response = await ghlFetch("/contacts/", apiKey, {
      method: "POST",
      body: JSON.stringify({
        locationId,
        ...(contact.email && { email: contact.email }),
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: normalizePhoneNumber(contact.phone),
        address1: contact.address,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, contactId: data.contact?.id };
    } else {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.message || `Failed to create contact: ${response.status}`);
      (err as any).status = response.status;
      throw err;
    }
  }, { maxRetries: 2 }).catch((error: any) => ({
    success: false,
    message: error.message || "Failed to create contact"
  }));
}

// Phone number normalization utilities
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Handle US numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Return with + prefix if not already there
  return digits.startsWith('+') ? phone : `+${digits}`;
}

function phoneNumbersMatch(phone1: string, phone2: string): boolean {
  // Normalize both phone numbers for comparison
  const digits1 = phone1.replace(/\D/g, '');
  const digits2 = phone2.replace(/\D/g, '');

  // Exact match
  if (digits1 === digits2) return true;

  // Match last 10 digits (US numbers without country code)
  const last10_1 = digits1.slice(-10);
  const last10_2 = digits2.slice(-10);

  if (last10_1.length === 10 && last10_2.length === 10 && last10_1 === last10_2) {
    return true;
  }

  return false;
}

export async function findGHLContactByEmail(
  apiKey: string,
  locationId: string,
  email: string
): Promise<{ success: boolean; contactId?: string; message?: string }> {
  return withRetry(async () => {
    const params = new URLSearchParams({
      locationId,
      query: email,
    });

    const response = await ghlFetch(`/contacts/?${params.toString()}`, apiKey);

    if (response.ok) {
      const data = await response.json();
      const contact = data.contacts?.find((c: any) =>
        c.email?.toLowerCase() === email.toLowerCase()
      );
      return { success: true, contactId: contact?.id };
    } else {
      const err = new Error(`Failed to search contact by email: ${response.status}`);
      (err as any).status = response.status;
      throw err;
    }
  }, { maxRetries: 2 }).catch((error: any) => ({
    success: false,
    message: error.message || "Failed to search contact by email"
  }));
}

export async function findGHLContactByPhone(
  apiKey: string,
  locationId: string,
  phone: string
): Promise<{ success: boolean; contactId?: string; message?: string }> {
  return withRetry(async () => {
    const searchDigits = phone.replace(/\D/g, '');

    const params = new URLSearchParams({
      locationId,
      query: searchDigits.slice(-10), // Search by last 10 digits
    });

    const response = await ghlFetch(`/contacts/?${params.toString()}`, apiKey);

    if (response.ok) {
      const data = await response.json();
      // Use strict phone matching
      const contact = data.contacts?.find((c: any) =>
        c.phone && phoneNumbersMatch(c.phone, phone)
      );
      return { success: true, contactId: contact?.id };
    } else {
      const err = new Error(`Failed to search contact by phone: ${response.status}`);
      (err as any).status = response.status;
      throw err;
    }
  }, { maxRetries: 2 }).catch((error: any) => ({
    success: false,
    message: error.message || "Failed to search contact by phone"
  }));
}

export async function createGHLAppointment(
  apiKey: string,
  calendarId: string,
  locationId: string,
  appointment: {
    contactId: string;
    startTime: string;
    endTime: string;
    title: string;
    address?: string;
    description?: string;
    toNotify?: boolean;
    ignoreFreeSlotValidation?: boolean;
  }
): Promise<{ success: boolean; appointmentId?: string; message?: string }> {
  return withRetry(async () => {
    console.log('[GHL] Creating appointment:', {
      calendarId,
      locationId,
      contactId: appointment.contactId,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      title: appointment.title,
      description: appointment.description
    });

    const response = await ghlFetch("/calendars/events/appointments", apiKey, {
      method: "POST",
      body: JSON.stringify({
        calendarId,
        locationId,
        contactId: appointment.contactId,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        title: appointment.title,
        address: appointment.address,
        description: appointment.description || appointment.title,
        appointmentStatus: "confirmed",
        meetingLocationType: appointment.address ? "address" : "custom",
        toNotify: appointment.toNotify ?? true,
        ignoreFreeSlotValidation: appointment.ignoreFreeSlotValidation ?? false,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[GHL] Appointment created successfully:', {
        appointmentId: data.id
      });
      return { success: true, appointmentId: data.id };
    } else {
      const error = await response.json().catch(() => ({}));
      console.error('[GHL] Appointment creation failed:', {
        status: response.status,
        statusText: response.statusText,
        error
      });
      const err = new Error(error.message || `Failed to create appointment: ${response.status}`);
      (err as any).status = response.status;
      throw err;
    }
  }, { maxRetries: 2 }).catch((error: any) => ({
    success: false,
    message: error.message || "Failed to create appointment"
  }));
}

function parseAddress(fullAddress: string): { street: string; city: string; state: string } {
  const parts = fullAddress.split(',').map(p => p.trim());
  
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1];
    const stateMatch = lastPart.match(/^([A-Z]{2})$/i);
    
    if (stateMatch) {
      const state = stateMatch[1].toUpperCase();
      const city = parts[parts.length - 2];
      const street = parts.slice(0, parts.length - 2).join(', ');
      return { street, city, state };
    }
  }
  
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const cityStateMatch = lastPart.match(/^(.+?)\s+([A-Z]{2})$/i);
    
    if (cityStateMatch) {
      const city = cityStateMatch[1].trim();
      const state = cityStateMatch[2].toUpperCase();
      const street = parts.slice(0, parts.length - 1).join(', ');
      return { street, city, state };
    }
  }
  
  return { street: fullAddress, city: '', state: '' };
}

export async function updateGHLContact(
  apiKey: string,
  contactId: string,
  updates: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
  }
): Promise<{ success: boolean; message?: string }> {
  return withRetry(async () => {
    const body: any = {};
    if (updates.email) body.email = updates.email;
    if (updates.firstName) body.firstName = updates.firstName;
    if (updates.lastName) body.lastName = updates.lastName;
    if (updates.phone) body.phone = normalizePhoneNumber(updates.phone);

    if (updates.address) {
      const parsed = parseAddress(updates.address);
      body.address1 = parsed.street;
      if (parsed.city) body.city = parsed.city;
      if (parsed.state) body.state = parsed.state;
      console.log(`Parsed address: street="${parsed.street}", city="${parsed.city}", state="${parsed.state}"`);
    }

    const response = await ghlFetch(`/contacts/${contactId}`, apiKey, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    if (response.ok) {
      console.log(`GHL contact ${contactId} updated successfully`);
      return { success: true };
    } else {
      const error = await response.json().catch(() => ({}));
      console.log(`GHL contact update failed: ${error.message || response.status}`);
      const err = new Error(error.message || `Failed to update contact: ${response.status}`);
      (err as any).status = response.status;
      throw err;
    }
  }, { maxRetries: 2 }).catch((error: any) => {
    console.log(`GHL contact update error: ${error.message}`);
    return {
      success: false,
      message: error.message || "Failed to update contact"
    };
  });
}

export async function getOrCreateGHLContact(
  apiKey: string,
  locationId: string,
  contact: {
    email?: string;
    firstName: string;
    lastName: string;
    phone: string;
    address?: string;
  }
): Promise<{ success: boolean; contactId?: string; message?: string }> {
  console.log('[GHL] getOrCreateGHLContact - Searching for contact:', {
    email: contact.email,
    phone: contact.phone,
    firstName: contact.firstName
  });

  if (contact.email) {
    const existingByEmail = await findGHLContactByEmail(apiKey, locationId, contact.email);

    if (existingByEmail.contactId) {
      console.log(`[GHL] Contact found by email: ${existingByEmail.contactId}`);
      if (contact.address) {
        console.log('[GHL] Updating contact address');
        await updateGHLContact(apiKey, existingByEmail.contactId, { address: contact.address });
      }
      return { success: true, contactId: existingByEmail.contactId };
    }
  }

  const existingByPhone = await findGHLContactByPhone(apiKey, locationId, contact.phone);

  if (existingByPhone.contactId) {
    console.log(`[GHL] Contact found by phone: ${existingByPhone.contactId}`);
    if (contact.address) {
      console.log('[GHL] Updating contact address');
      await updateGHLContact(apiKey, existingByPhone.contactId, { address: contact.address });
    }
    return { success: true, contactId: existingByPhone.contactId };
  }

  console.log('[GHL] Contact not found, creating new contact');
  const result = await createGHLContact(apiKey, locationId, contact);
  console.log('[GHL] Contact creation result:', {
    success: result.success,
    contactId: result.contactId,
    message: result.message
  });
  return result;
}
