/**
 * view_cart tool (get_cart)
 * 
 * Get current services in the customer's cart with total price
 */

import { CHAT_TOOL } from '../constants';
import { chatDeps } from '../dependencies';
import type { ToolHandler } from './registry';
import { type ViewCartInput } from './schemas';
import { requireConversation, requireConversationId } from './shared';

/**
 * Handler for view_cart tool
 */
export const viewCartHandler: ToolHandler<ViewCartInput> = async (
    _args,
    conversationId
) => {
    const resolvedConversationId = requireConversationId(conversationId);
    const conversation = await requireConversation(resolvedConversationId);

    const currentMemory = (conversation.memory as any) || { cart: [] };
    const cart = currentMemory.cart || [];
    const serviceIds = cart.map((item: any) => Number(item.serviceId)).filter(Boolean);
    const services = serviceIds.length > 0 ? await chatDeps.storage.getServices(undefined, undefined, false) : [];
    const serviceMap = new Map(services.map((service) => [service.id, service]));
    const categories = await chatDeps.storage.getCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

    // Normalize cart items with full details
    const normalizedCart = cart.map((item: any) => {
        const quantity = Number(item.quantity) || 1;
        const unitPrice = Number(item.unitPrice) || (Number(item.price) / quantity) || 0;
        const lineTotal = Number(item.price) || unitPrice * quantity;
        const service = serviceMap.get(Number(item.serviceId));
        const categoryName = service?.categoryId ? categoryMap.get(service.categoryId) : undefined;
        return {
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            quantity,
            unitPrice,
            lineTotal,
            categoryName,
        };
    });

    const total = normalizedCart.reduce((sum: number, item: any) => sum + Number(item.lineTotal || 0), 0);

    return {
        success: true,
        cart: normalizedCart,
        total,
        serviceIds,
        isEmpty: normalizedCart.length === 0
    };
};

// Tool definition
export const viewCartTool = {
    name: CHAT_TOOL.VIEW_CART,
    description: "Get current services in the customer's cart with total price",
    inputSchema: {
        type: 'object' as const,
        properties: {},
        additionalProperties: false,
    },
    handler: viewCartHandler,
    requiresConversationId: true,
};
