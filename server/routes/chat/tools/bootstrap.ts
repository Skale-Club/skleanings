import { registerTool } from './registry';
import { addServiceTool } from './add-service';
import { createBookingTool } from './create-booking';
import { getBusinessPoliciesTool } from './get-business-policies';
import { getServiceDetailsTool } from './get-service-details';
import { listServicesTool } from './list-services';
import { searchFaqsTool } from './search-faqs';
import { suggestBookingDatesTool } from './suggest-booking-dates';
import { updateContactTool } from './update-contact';
import { updateMemoryTool } from './update-memory';
import { viewCartTool } from './view-cart';

let initialized = false;

export function initializeChatToolRegistry(): void {
    if (initialized) {
        return;
    }

    registerTool(listServicesTool);
    registerTool(getServiceDetailsTool);
    registerTool(suggestBookingDatesTool);
    registerTool(getBusinessPoliciesTool);
    registerTool(searchFaqsTool);
    registerTool(updateContactTool);
    registerTool(updateMemoryTool);
    registerTool(addServiceTool);
    registerTool(viewCartTool);
    registerTool(createBookingTool);

    initialized = true;
}
