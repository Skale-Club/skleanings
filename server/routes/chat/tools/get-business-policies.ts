/**
 * get_business_policies tool
 * 
 * Get business hours and any minimum booking rules
 */

import { CHAT_TOOL } from '../constants';
import { chatDeps } from '../dependencies';
import { formatBusinessHoursSummary } from '../utils';
import type { ToolHandler } from './registry';
import { type GetBusinessPoliciesInput } from './schemas';

/**
 * Handler for get_business_policies tool
 */
export const getBusinessPoliciesHandler: ToolHandler<GetBusinessPoliciesInput> = async () => {
    const company = await chatDeps.storage.getCompanySettings();
    const businessHours = await chatDeps.storage.getBusinessHours();

    return {
        businessName: company?.companyName || 'the business',
        email: company?.companyEmail,
        phone: company?.companyPhone,
        address: company?.companyAddress,
        minimumBookingValue: company?.minimumBookingValue,
        businessHours: formatBusinessHoursSummary(businessHours),
    };
};

// Tool definition
export const getBusinessPoliciesTool = {
    name: CHAT_TOOL.GET_BUSINESS_POLICIES,
    description: 'Get business hours and any minimum booking rules',
    inputSchema: {
        type: 'object' as const,
        properties: {},
        additionalProperties: false,
    },
    handler: getBusinessPoliciesHandler,
};
