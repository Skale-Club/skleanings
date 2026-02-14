
export interface ConversationSummary {
    id: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    lastMessageAt?: string | null;
    firstPageUrl?: string | null;
    visitorName?: string | null;
    visitorEmail?: string | null;
    visitorPhone?: string | null;
    lastMessage?: string;
    lastMessageRole?: string | null;
    messageCount?: number;
}

export interface ConversationMessage {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    createdAt: string;
    metadata?: Record<string, any> | null;
}

export interface ChatSettingsData {
    enabled: boolean;
    agentName: string;
    agentAvatarUrl?: string;
    welcomeMessage: string;
    avgResponseTime?: string;
    calendarProvider?: string;
    calendarId?: string;
    calendarStaff?: { name: string; calendarId: string }[];
    intakeObjectives?: IntakeObjective[];
    excludedUrlRules: UrlRule[];
    useFaqs?: boolean;
}

export type UrlRule = {
    pattern: string;
    match: 'contains' | 'starts_with' | 'equals';
};

export type IntakeObjective = {
    id: 'zipcode' | 'name' | 'phone' | 'serviceType' | 'serviceDetails' | 'date' | 'address';
    label: string;
    description: string;
    enabled: boolean;
};

export const DEFAULT_CHAT_OBJECTIVES: IntakeObjective[] = [
    { id: 'zipcode', label: 'Zip Code', description: 'Ask for zip code first to check service area', enabled: true },
    { id: 'serviceType', label: 'Service Type', description: 'Ask what kind of service they need', enabled: true },
    { id: 'serviceDetails', label: 'Details', description: 'Ask for specific details about the job', enabled: true },
    { id: 'date', label: 'Preferred Date', description: 'Ask when they would like the service', enabled: true },
    { id: 'name', label: 'Name', description: 'Ask for their name', enabled: true },
    { id: 'phone', label: 'Phone Number', description: 'Ask for phone number to contact them', enabled: true },
    { id: 'address', label: 'Address', description: 'Ask for full service address', enabled: false },
];
