/**
 * add_service tool
 * 
 * Add a service to the customer's cart.
 * Call this IMMEDIATELY after customer confirms each service.
 */

import { ChatError } from '../../../lib/chat-errors';
import { CHAT_TOOL } from '../constants';
import { chatDeps } from '../dependencies';
import { getCachedServices } from './cache';
import { normalizeServiceName, requireConversation, requireConversationId } from './shared';
import type { ToolHandler } from './registry';
import { type AddServiceInput } from './schemas';

/**
 * Handler for add_service tool
 */
export const addServiceHandler: ToolHandler<AddServiceInput> = async (
    args,
    conversationId,
    options
) => {
    const resolvedConversationId = requireConversationId(conversationId);

    let serviceId = Number(args?.service_id);
    const serviceName = (args?.service_name as string) || '';
    const price = Number(args?.price);
    const quantityArg = Math.max(Number(args?.quantity) || 1, 1);

    if (!serviceName) {
        throw new ChatError('bad_request:tool', 'Missing service_name');
    }

    // Resolve service by ID or name
    let service = serviceId ? await chatDeps.storage.getService(serviceId) : undefined;
    const normalizedName = normalizeServiceName(serviceName);

    // Check if ID and name match
    if (service && normalizeServiceName(service.name || '') !== normalizedName) {
        service = undefined;
    }

    // Try to find by name if not found by ID
    if (!service) {
        const allServices = await getCachedServices();
        const exactMatch = allServices.find((s) => normalizeServiceName(s.name || '') === normalizedName);
        if (exactMatch) {
            service = exactMatch;
            serviceId = exactMatch.id;
        } else {
            // Try partial match
            const candidates = allServices.filter((s) => {
                const candidateName = normalizeServiceName(s.name || '');
                return candidateName.includes(normalizedName) || normalizedName.includes(candidateName);
            });
            if (candidates.length > 0) {
                candidates.sort((a, b) => normalizeServiceName(b.name || '').length - normalizeServiceName(a.name || '').length);
                const bestMatch = candidates[0];
                service = bestMatch;
                serviceId = bestMatch.id;
            }
        }
    }

    if (!service || !serviceId) {
        throw new ChatError('service:not_found', 'Service not found for provided name');
    }

    const resolvedUnitPrice = Number(service.price);
    const unitPrice = Number.isNaN(resolvedUnitPrice) ? price : resolvedUnitPrice;

    // Get current conversation to update cart
    const conversation = await requireConversation(resolvedConversationId);

    const currentMemory = (conversation.memory as any) || { collectedData: {}, completedSteps: [], cart: [] };
    const cart = currentMemory.cart || [];
    const autoAddedServices = Array.isArray(currentMemory.autoAddedServices) ? currentMemory.autoAddedServices : [];
    const autoAddedServiceIds = Array.isArray(currentMemory.autoAddedServiceIds)
        ? currentMemory.autoAddedServiceIds.map((id: any) => Number(id)).filter(Boolean)
        : [];
    const autoAddedMessageId = currentMemory.autoAddedMessageId;

    // Check for duplicate in same turn (auto-added)
    if (
        autoAddedMessageId &&
        options?.userMessageId &&
        autoAddedMessageId === options.userMessageId &&
        (autoAddedServices.includes(normalizedName) || autoAddedServiceIds.includes(serviceId))
    ) {
        const total = cart.reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);
        return {
            success: true,
            deduplicated: true,
            cart,
            total,
            message: `Already added ${service.name || serviceName} to cart.`,
        };
    }

    // Check if service already in cart
    const existingIndex = cart.findIndex((item: any) => {
        const itemName = normalizeServiceName(item.serviceName || '');
        return item.serviceId === serviceId || itemName === normalizedName;
    });

    if (existingIndex >= 0) {
        // Update quantity
        const existing = cart[existingIndex];
        const existingQty = Number(existing.quantity) || 1;
        const nextQty = existingQty + quantityArg;
        const existingUnitPrice = Number(existing.unitPrice) || Number(existing.price) || unitPrice;
        cart[existingIndex] = {
            ...existing,
            serviceId,
            serviceName: service.name || serviceName,
            unitPrice: existingUnitPrice,
            quantity: nextQty,
            price: Number(existingUnitPrice) * nextQty,
        };
        currentMemory.cart = cart;
        await chatDeps.storage.updateConversation(resolvedConversationId, { memory: currentMemory });

        const total = cart.reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);
        return {
            success: true,
            message: `Updated ${service.name || serviceName} quantity to ${nextQty}`,
            cart,
            total
        };
    }

    // Add to cart
    cart.push({
        serviceId,
        serviceName: service.name || serviceName,
        unitPrice,
        quantity: quantityArg,
        price: unitPrice * quantityArg,
    });
    currentMemory.cart = cart;

    // Update collected data
    currentMemory.collectedData = {
        ...currentMemory.collectedData,
        serviceType: currentMemory.collectedData?.serviceType || service.name || serviceName,
        serviceDetails: currentMemory.collectedData?.serviceDetails || service.name || serviceName,
    };
    currentMemory.completedSteps = currentMemory.completedSteps || [];
    if (!currentMemory.completedSteps.includes('serviceType')) {
        currentMemory.completedSteps.push('serviceType');
    }
    if (!currentMemory.completedSteps.includes('serviceDetails')) {
        currentMemory.completedSteps.push('serviceDetails');
    }

    await chatDeps.storage.updateConversation(resolvedConversationId, { memory: currentMemory });

    const total = cart.reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);

    return {
        success: true,
        added: { serviceId, serviceName: service.name || serviceName, price: unitPrice * quantityArg, quantity: quantityArg, unitPrice },
        cart,
        total,
        message: `Added ${service.name || serviceName} (${quantityArg} x $${unitPrice}) to cart. Total: $${total}`
    };
};

// Tool definition
export const addServiceTool = {
    name: CHAT_TOOL.ADD_SERVICE,
    description: "Add a service to the customer's cart. Call this IMMEDIATELY after customer confirms each service. This tracks all services for the final booking.",
    inputSchema: {
        type: 'object' as const,
        properties: {
            service_id: { type: 'number', description: 'ID of the service from list_services' },
            service_name: { type: 'string', description: 'Name of the service' },
            price: { type: 'number', description: 'Price of the service' },
            quantity: { type: 'number', description: 'Quantity of the service (default 1)' },
        },
        required: ['service_id', 'service_name', 'price'],
        additionalProperties: false,
    },
    handler: addServiceHandler,
    requiresConversationId: true,
};
