/**
 * update_memory tool
 * 
 * Update the conversation memory with collected information.
 * Call this after collecting each piece of information to track progress.
 */

import { CHAT_TOOL } from '../constants';
import { chatDeps } from '../dependencies';
import type { ToolHandler } from './registry';
import { type UpdateMemoryInput } from './schemas';
import { requireConversation, requireConversationId } from './shared';

/**
 * Handler for update_memory tool
 */
export const updateMemoryHandler: ToolHandler<UpdateMemoryInput> = async (
    args,
    conversationId
) => {
    const resolvedConversationId = requireConversationId(conversationId);
    const conversation = await requireConversation(resolvedConversationId);

    const currentMemory = (conversation.memory as any) || { collectedData: {}, completedSteps: [] };
    const collectedData = currentMemory.collectedData || {};
    const completedSteps = currentMemory.completedSteps || [];

    // Update service info (deprecated but kept for backward compatibility)
    if (args?.selected_service) {
        currentMemory.selectedService = args.selected_service;
    }

    // Validate time slot if provided
    let slotValidationWarning: string | null = null;
    let selectedDateArg = (args?.selected_date as string | undefined)?.trim();
    let selectedTimeArg = (args?.selected_time as string | undefined)?.trim();
    const suggestedOptions = Array.isArray(currentMemory.lastSuggestedOptions) ? currentMemory.lastSuggestedOptions : [];
    const lastSuggestedDate = typeof currentMemory.lastSuggestedDate === 'string' ? currentMemory.lastSuggestedDate : undefined;
    const lastSuggestedSlots = Array.isArray(currentMemory.lastSuggestedSlots) ? currentMemory.lastSuggestedSlots : [];

    if (selectedTimeArg) {
        const dateForValidation = selectedDateArg || lastSuggestedDate;
        if (dateForValidation) {
            const suggestionForDate = suggestedOptions.find((item: any) => item?.date === dateForValidation);
            const validSlots = Array.isArray(suggestionForDate?.availableSlots)
                ? suggestionForDate.availableSlots
                : (dateForValidation === lastSuggestedDate ? lastSuggestedSlots : []);
            if (validSlots.length > 0 && !validSlots.includes(selectedTimeArg)) {
                slotValidationWarning = `Selected time ${selectedTimeArg} is not in suggested slots for ${dateForValidation}`;
                selectedTimeArg = undefined;
            }
        }
    }

    // Update collected data fields
    if (args?.zipcode) collectedData.zipcode = args.zipcode;
    if (args?.service_type) collectedData.serviceType = args.service_type;
    if (args?.service_details) collectedData.serviceDetails = args.service_details;
    if (args?.preferred_date) collectedData.preferredDate = args.preferred_date;
    if (selectedDateArg) collectedData.selectedDate = selectedDateArg;
    if (selectedTimeArg) collectedData.selectedTime = selectedTimeArg;
    if (args?.name) collectedData.name = args.name;
    if (args?.phone) collectedData.phone = args.phone;
    if (args?.email) collectedData.email = args.email;
    if (args?.address) collectedData.address = args.address;

    // Update current step
    if (args?.current_step) {
        currentMemory.currentStep = args.current_step;
    }

    // Mark completed step
    if (args?.completed_step && !completedSteps.includes(args.completed_step)) {
        completedSteps.push(args.completed_step);
    }

    currentMemory.collectedData = collectedData;
    currentMemory.completedSteps = completedSteps;

    // Also update conversation fields for backward compatibility
    const conversationUpdates: any = { memory: currentMemory };
    if (args?.zipcode) conversationUpdates.visitorZipcode = args.zipcode;
    if (args?.address) conversationUpdates.visitorAddress = args.address;
    if (args?.name) conversationUpdates.visitorName = args.name;
    if (args?.phone) conversationUpdates.visitorPhone = args.phone;
    if (args?.email) conversationUpdates.visitorEmail = args.email;

    await chatDeps.storage.updateConversation(resolvedConversationId, conversationUpdates);

    return {
        success: true,
        memory: currentMemory,
        warning: slotValidationWarning || undefined,
    };
};

// Tool definition
export const updateMemoryTool = {
    name: CHAT_TOOL.UPDATE_MEMORY,
    description: 'Update the conversation memory with collected information. Call this after collecting each piece of information to track progress. IMPORTANT: Use add_service to add services to the cart instead of selected_service.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            selected_service: {
                type: 'object',
                description: 'DEPRECATED: Use add_service tool instead',
                properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    price: { type: 'string' },
                },
            },
            zipcode: { type: 'string', description: "Customer's ZIP code" },
            service_type: { type: 'string', description: 'Type of service selected (e.g., "3-seater sofa cleaning")' },
            service_details: { type: 'string', description: 'Service details (size, material, notes)' },
            preferred_date: { type: 'string', description: "Customer's preferred date" },
            selected_date: { type: 'string', description: 'Confirmed booking date (YYYY-MM-DD)' },
            selected_time: { type: 'string', description: 'Confirmed booking time (HH:mm)' },
            name: { type: 'string', description: 'Customer name' },
            phone: { type: 'string', description: 'Customer phone' },
            email: { type: 'string', description: 'Customer email' },
            address: { type: 'string', description: 'Customer full address' },
            current_step: { type: 'string', description: 'Current step in the intake flow' },
            completed_step: { type: 'string', description: 'Step that was just completed' },
        },
        additionalProperties: false,
    },
    handler: updateMemoryHandler,
    requiresConversationId: true,
};
