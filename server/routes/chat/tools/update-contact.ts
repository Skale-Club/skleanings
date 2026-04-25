/**
 * update_contact tool
 * 
 * Save visitor contact info (name/email/phone) to the conversation
 * as soon as it is provided.
 */

import { CHAT_TOOL } from '../constants';
import { chatDeps } from '../dependencies';
import { ChatError } from '../../../lib/chat-errors';
import { addInternalConversationMessage, requireConversation, requireConversationId } from './shared';
import type { ToolHandler } from './registry';
import { type UpdateContactInput } from './schemas';
import { logNotification } from '../../../lib/notification-logger';

/**
 * Handler for update_contact tool
 */
export const updateContactHandler: ToolHandler<UpdateContactInput> = async (
    args,
    conversationId,
    options
) => {
    const name = (args?.name as string | undefined)?.trim();
    const email = (args?.email as string | undefined)?.trim();
    const phone = (args?.phone as string | undefined)?.trim();
    const resolvedConversationId = requireConversationId(conversationId);

    if (!name && !email && !phone) {
        throw new ChatError('bad_request:tool', 'Provide at least one of name, email, or phone');
    }

    const existingConversation = await requireConversation(resolvedConversationId);

    const existingMemory = (existingConversation.memory as any) || {};
    const requestedFields = [
        ...(name ? ['name'] : []),
        ...(email ? ['email'] : []),
        ...(phone ? ['phone'] : []),
    ];

    // Check for duplicate update in same turn
    const lastContactUpdateMessageId = existingMemory.lastContactUpdateMessageId as string | undefined;
    const lastContactUpdateFields = Array.isArray(existingMemory.lastContactUpdateFields)
        ? existingMemory.lastContactUpdateFields as string[]
        : [];
    const isDuplicateSameTurn =
        !!options?.userMessageId &&
        lastContactUpdateMessageId === options.userMessageId &&
        requestedFields.length > 0 &&
        requestedFields.every((field) => lastContactUpdateFields.includes(field));

    if (isDuplicateSameTurn) {
        return {
            success: true,
            deduplicated: true,
            visitorName: existingConversation.visitorName,
            visitorEmail: existingConversation.visitorEmail,
            visitorPhone: existingConversation.visitorPhone,
        };
    }

    // Build updates
    const updates: any = {};
    if (name && name !== existingConversation.visitorName) updates.visitorName = name;
    if (email && email !== existingConversation.visitorEmail) updates.visitorEmail = email;
    if (phone && phone !== existingConversation.visitorPhone) updates.visitorPhone = phone;

    const updated = Object.keys(updates).length > 0
        ? await chatDeps.storage.updateConversation(resolvedConversationId, updates)
        : existingConversation;

    // Check GHL integration
    const chatSettings = await chatDeps.storage.getChatSettings();
    const ghlSettings = await chatDeps.storage.getIntegrationSettings('gohighlevel');
    const calendarProvider = chatSettings?.calendarProvider || 'gohighlevel';
    const requiresGhl = calendarProvider === 'gohighlevel';
    const canSyncGhl = !!(ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.locationId);
    let contactId: string | undefined;

    if (requiresGhl && !canSyncGhl) {
        throw new ChatError(
            'provider:unavailable',
            'GoHighLevel integration is required to sync contacts. Please configure GHL.'
        );
    }

    // Sync to GHL if configured
    if (canSyncGhl && ghlSettings?.apiKey && ghlSettings?.locationId) {
        const contactName = updated?.visitorName || name || '';
        const nameParts = contactName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const contactEmail = updated?.visitorEmail || email || '';
        const contactPhone = updated?.visitorPhone || phone || '';

        if (contactEmail || contactPhone) {
            const contactResult = await chatDeps.ghl.getOrCreateGHLContact(
                ghlSettings.apiKey,
                ghlSettings.locationId,
                {
                    email: contactEmail || '',
                    firstName,
                    lastName,
                    phone: contactPhone || '',
                    address: undefined,
                }
            );

            await logNotification({
                channel: "ghl",
                trigger: "new_chat",
                recipient: contactEmail || contactPhone,
                preview: `Contact: ${contactName || 'Unknown'} (${contactPhone || contactEmail})`,
                status: contactResult.success && contactResult.contactId ? "sent" : "failed",
                providerMessageId: contactResult.contactId,
                errorMessage: contactResult.success ? undefined : contactResult.message,
                conversationId: resolvedConversationId,
            });

            if (!contactResult.success || !contactResult.contactId) {
                console.error(`[update_contact] GHL contact creation failed:`, contactResult.message);
                await addInternalConversationMessage(
                    resolvedConversationId,
                    `[WARNING] GHL contact sync failed: ${contactResult.message || 'Unknown error'}. Contact saved locally only.`,
                    {
                        type: 'ghl_contact_error',
                        severity: 'warning',
                        error: contactResult.message,
                        requiresManualSync: true,
                    }
                );
            } else {
                contactId = contactResult.contactId;
                await addInternalConversationMessage(
                    resolvedConversationId,
                    `GHL contact synced: ${contactName || 'Unknown'} | ${contactEmail || 'no email'} | ${contactPhone || 'no phone'} | ID ${contactId}`,
                    {
                        type: 'ghl_contact',
                        ghlContactId: contactId,
                        name: contactName || undefined,
                        email: contactEmail || undefined,
                        phone: contactPhone || undefined,
                    }
                );
            }
        }
    }

    // Update memory with last contact update info
    if (options?.userMessageId) {
        const refreshedConversation = await chatDeps.storage.getConversation(resolvedConversationId);
        const refreshedMemory = (refreshedConversation?.memory as any) || {};
        refreshedMemory.lastContactUpdateMessageId = options.userMessageId;
        refreshedMemory.lastContactUpdateFields = requestedFields;
        await chatDeps.storage.updateConversation(resolvedConversationId, { memory: refreshedMemory });
    }

    return {
        success: true,
        visitorName: updated?.visitorName,
        visitorEmail: updated?.visitorEmail,
        visitorPhone: updated?.visitorPhone,
        ghlContactId: contactId,
    };
};

// Tool definition
export const updateContactTool = {
    name: CHAT_TOOL.UPDATE_CONTACT,
    description: 'Save visitor contact info (name/email/phone) to the conversation as soon as it is provided',
    inputSchema: {
        type: 'object' as const,
        properties: {
            name: { type: 'string', description: 'Visitor name' },
            email: { type: 'string', description: 'Visitor email' },
            phone: { type: 'string', description: 'Visitor phone' },
        },
        additionalProperties: false,
    },
    handler: updateContactHandler,
    requiresConversationId: true,
};
