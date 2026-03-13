/**
 * get_service_details tool
 * 
 * Get details for a specific service by ID
 */

import { ChatError } from '../../../lib/chat-errors';
import { CHAT_TOOL } from '../constants';
import { formatServiceForTool, requireService } from './shared';
import type { ToolHandler } from './registry';
import { type GetServiceDetailsInput } from './schemas';

/**
 * Handler for get_service_details tool
 */
export const getServiceDetailsHandler: ToolHandler<GetServiceDetailsInput> = async (args) => {
    const serviceId = Number(args?.service_id);

    if (!serviceId) {
        throw new ChatError('bad_request:tool', 'Service ID is required');
    }

    const service = await requireService(serviceId);

    return { service: formatServiceForTool(service) };
};

// Tool definition
export const getServiceDetailsTool = {
    name: CHAT_TOOL.GET_SERVICE_DETAILS,
    description: 'Get details for a specific service',
    inputSchema: {
        type: 'object' as const,
        properties: {
            service_id: {
                type: 'number',
                description: 'ID of the service',
            },
        },
        required: ['service_id'],
        additionalProperties: false,
    },
    handler: getServiceDetailsHandler,
};
