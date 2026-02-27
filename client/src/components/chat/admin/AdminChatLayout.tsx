
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ConversationList } from "./ConversationList";
import { ChatArea } from "./ChatArea";
import { ChatSettings } from "./ChatSettings";
import { ChatSettingsData, ConversationSummary, ConversationMessage } from "./types";
import { authenticatedRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface AdminChatLayoutProps {
    getAccessToken: () => Promise<string | null>;
}

export function AdminChatLayout({ getAccessToken }: AdminChatLayoutProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [isMessagesLoading, setIsMessagesLoading] = useState(false);
    const [isMobileListVisible, setIsMobileListVisible] = useState(true);
    const [settingsPanelWidth, setSettingsPanelWidth] = useState(600);
    const [isResizing, setIsResizing] = useState(false);

    // Queries
    const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations } = useQuery<ConversationSummary[]>({
        queryKey: ['/api/chat/conversations'],
        queryFn: async () => {
            const token = await getAccessToken();
            if (!token) return [];
            const res = await fetch('/api/chat/conversations', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to fetch conversations');
            return res.json();
        },
        refetchInterval: 10000,
    });

    const { data: settings, isLoading: loadingSettings } = useQuery<ChatSettingsData>({
        queryKey: ['/api/chat/settings'],
        queryFn: async () => {
            const token = await getAccessToken();
            if (!token) throw new Error("No token");
            const res = await fetch('/api/chat/settings', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to fetch chat settings');
            return res.json();
        },
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    });

    const { data: companySettings } = useQuery<any>({
        queryKey: ['/api/company-settings'],
    });

    const { data: openaiSettings } = useQuery<any>({
        queryKey: ['/api/integrations/openai'],
        queryFn: async () => {
            const token = await getAccessToken();
            if (!token) return null;
            const res = await fetch('/api/integrations/openai', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to fetch OpenAI settings');
            return res.json();
        }
    });

    // Derived state
    const selectedConversation = conversations?.find(c => c.id === selectedConversationId) || null;

    // Effects
    useEffect(() => {
        if (selectedConversationId) {
            loadMessages(selectedConversationId);
            setIsMobileListVisible(false);
        } else {
            setMessages([]);
            setIsMobileListVisible(true);
        }
    }, [selectedConversationId]);

    // Real-time updates (SSE)
    useEffect(() => {
        if (!selectedConversationId) return;

        const eventSource = new EventSource(`/api/chat/conversations/${selectedConversationId}/stream`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'new_message' && data.message) {
                    setMessages((prev) => {
                        if (prev.some((m) => m.id === data.message.id)) return prev;
                        return [...prev, data.message];
                    });
                    // Update conversation in list if needed (e.g. lastMessage)
                    queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
                }
            } catch (err) {
                console.error('SSE parse error:', err);
            }
        };

        return () => eventSource.close();
    }, [selectedConversationId, queryClient]);


    // Actions
    const loadMessages = async (id: string) => {
        setIsMessagesLoading(true);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error("Authentication required");
            const url = `/api/chat/conversations/${id}/messages?includeInternal=true`;
            const res = await authenticatedRequest('GET', url, token);
            const data = await res.json();
            setMessages(data.messages || []);
        } catch (error: any) {
            toast({ title: 'Failed to load conversation', description: error.message, variant: 'destructive' });
        } finally {
            setIsMessagesLoading(false);
        }
    };

    const handleSendMessage = async (content: string) => {
        if (!selectedConversationId) return;
        const token = await getAccessToken();
        if (!token) return;

        // Optimistic update
        const tempId = Date.now().toString();
        const tempMsg: ConversationMessage = {
            id: tempId,
            conversationId: selectedConversationId,
            role: 'assistant',
            content: content,
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, tempMsg]);

        try {
            await authenticatedRequest(
                'POST',
                `/api/chat/conversations/${selectedConversationId}/messages`,
                token,
                { content, role: 'assistant' }
            );
            // Real message will come via SSE or next fetch, but we can invalidate to be sure
            queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
        } catch (error: any) {
            setMessages(prev => prev.filter(m => m.id !== tempId)); // Rollback
            toast({ title: 'Failed to send message', description: error.message, variant: 'destructive' });
        }
    };

    const handleStatusChange = async (id: string, status: 'open' | 'closed') => {
        try {
            const token = await getAccessToken();
            if (!token) return;
            await authenticatedRequest('POST', `/api/chat/conversations/${id}/status`, token, { status });
            queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });

            if (selectedConversationId === id) {
                // Optimistically update local state if selected
                // But query invalidation should handle it
            }
        } catch (error: any) {
            toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const token = await getAccessToken();
            if (!token) throw new Error("Authentication required");
            await authenticatedRequest('DELETE', `/api/chat/conversations/${id}`, token);
            queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
            if (selectedConversationId === id) {
                setSelectedConversationId(null);
            }
            toast({ title: 'Conversation deleted' });
        } catch (error: any) {
            toast({ title: 'Failed to delete conversation', description: error.message, variant: 'destructive' });
        }
    };

    const handleSaveSettings = async (newSettings: Partial<ChatSettingsData>) => {
        try {
            const token = await getAccessToken();
            if (!token) throw new Error("Authentication required");

            const response = await authenticatedRequest('PUT', '/api/chat/settings', token, newSettings);
            const updated = await response.json();
            queryClient.setQueryData(['/api/chat/settings'], updated);
            toast({ title: 'Settings saved' });
        } catch (error: any) {
            toast({ title: 'Failed to save settings', description: error.message, variant: 'destructive' });
            throw error; // Re-throw for component to handle state
        }
    };

    // Resize handlers for settings panel
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Mouse down on resize handle');
        setIsResizing(true);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            const newWidth = window.innerWidth - e.clientX;
            console.log('Mouse move, new width:', newWidth);
            // Constrain between 400px and 1000px
            if (newWidth >= 400 && newWidth <= 1000) {
                setSettingsPanelWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            console.log('Mouse up, stopping resize');
            setIsResizing(false);
        };

        if (isResizing) {
            console.log('Resizing started, adding event listeners');
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);

    return (
        <div className="flex h-[calc(100vh-theme(spacing.16))] w-full flex-col overflow-hidden bg-background md:h-screen md:flex-row">
            {/* Mobile Settings Trigger - floating or in header? putting it in sidebar usually but here we are full screen */}
            <div className="md:hidden flex items-center justify-between p-4 border-b bg-background z-10">
                <h2 className="font-semibold text-lg">Inbox</h2>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button>
                    </SheetTrigger>
                    <SheetContent
                        side="right"
                        className="w-full p-0 overflow-hidden flex sm:max-w-none"
                        style={{ width: window.innerWidth < 640 ? '100%' : `${settingsPanelWidth}px` }}
                    >
                        {/* Resize handle (hidden on mobile) */}
                        <div
                            onMouseDown={handleMouseDown}
                            className={cn(
                                "hidden sm:block w-1.5 hover:w-2 bg-border hover:bg-primary transition-all cursor-ew-resize shrink-0 relative z-50",
                                isResizing && "w-2 bg-primary"
                            )}
                            style={{
                                pointerEvents: 'auto',
                                touchAction: 'none'
                            }}
                            title="Drag to resize"
                        />

                        {/* Content area */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <ChatSettings
                                settings={settings || {} as ChatSettingsData}
                                onSave={handleSaveSettings}
                                isLoading={loadingSettings}
                                companyName={companySettings?.companyName}
                                companyLogo={companySettings?.logoIcon}
                                openaiEnabled={openaiSettings?.enabled}
                                openaiHasKey={openaiSettings?.hasKey}
                                getAccessToken={getAccessToken}
                                authenticatedRequest={authenticatedRequest}
                            />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex h-full w-full">
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="min-w-[280px]">
                        <div className="flex h-full flex-col border-r">
                            <div className="p-3 border-b flex justify-between items-center">
                                <h2 className="font-semibold">Conversations</h2>
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button variant="ghost" size="icon" title="Chat Settings">
                                            <Settings className="h-4 w-4" />
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent
                                        side="right"
                                        className="p-0 overflow-hidden flex"
                                        style={{ width: `${settingsPanelWidth}px` }}
                                    >
                                        {/* Resize handle */}
                                        <div
                                            onMouseDown={handleMouseDown}
                                            className={cn(
                                                "w-1.5 hover:w-2 bg-border hover:bg-primary transition-all cursor-ew-resize shrink-0 relative z-50",
                                                isResizing && "w-2 bg-primary"
                                            )}
                                            style={{
                                                pointerEvents: 'auto',
                                                touchAction: 'none'
                                            }}
                                            title="Drag to resize"
                                        />

                                        {/* Content area */}
                                        <div className="flex-1 overflow-y-auto p-6">
                                            <ChatSettings
                                                settings={settings || {} as ChatSettingsData}
                                                onSave={handleSaveSettings}
                                                isLoading={loadingSettings}
                                                companyName={companySettings?.companyName}
                                                companyLogo={companySettings?.logoIcon}
                                                openaiEnabled={openaiSettings?.enabled}
                                                openaiHasKey={openaiSettings?.hasKey}
                                                getAccessToken={getAccessToken}
                                                authenticatedRequest={authenticatedRequest}
                                            />
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </div>
                            <ConversationList
                                conversations={conversations || []}
                                selectedId={selectedConversationId}
                                onSelect={setSelectedConversationId}
                                isLoading={loadingConversations}
                                onArchive={(id) => handleStatusChange(id, 'closed')}
                                onReopen={(id) => handleStatusChange(id, 'open')}
                                onDelete={handleDelete}
                            />
                        </div>
                    </ResizablePanel>

                    <ResizableHandle />

                    <ResizablePanel defaultSize={75}>
                        <ChatArea
                            conversation={selectedConversation}
                            messages={messages}
                            isLoading={isMessagesLoading}
                            settings={settings}
                            onSendMessage={handleSendMessage}
                            onStatusChange={(status) => selectedConversationId && handleStatusChange(selectedConversationId, status)}
                            onDelete={() => selectedConversationId && handleDelete(selectedConversationId)}
                            onClose={() => setSelectedConversationId(null)}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden flex-1 relative overflow-hidden">
                {/* List View */}
                <div className={cn(
                    "absolute inset-0 transition-transform duration-300 ease-in-out bg-background z-0",
                    isMobileListVisible ? "translate-x-0" : "-translate-x-full"
                )}>
                    <ConversationList
                        conversations={conversations || []}
                        selectedId={selectedConversationId}
                        onSelect={setSelectedConversationId}
                        isLoading={loadingConversations}
                        onArchive={(id) => handleStatusChange(id, 'closed')}
                        onReopen={(id) => handleStatusChange(id, 'open')}
                        onDelete={handleDelete}
                    />
                </div>

                {/* Chat/Detail View */}
                <div className={cn(
                    "absolute inset-0 transition-transform duration-300 ease-in-out bg-background z-10",
                    isMobileListVisible ? "translate-x-full" : "translate-x-0"
                )}>
                    <ChatArea
                        conversation={selectedConversation}
                        messages={messages}
                        isLoading={isMessagesLoading}
                        settings={settings}
                        onSendMessage={handleSendMessage}
                        onStatusChange={(status) => selectedConversationId && handleStatusChange(selectedConversationId, status)}
                        onDelete={() => selectedConversationId && handleDelete(selectedConversationId)}
                        onClose={() => {
                            setSelectedConversationId(null);
                            setIsMobileListVisible(true);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
