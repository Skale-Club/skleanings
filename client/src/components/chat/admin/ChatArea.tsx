
import { format } from "date-fns";
import {
    Archive,
    ArrowLeft,
    Loader2,
    MessageSquare,
    MoreVertical,
    RotateCcw,
    Send,
    Trash2,
    User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { renderMarkdown } from "@/lib/markdown";
import { ConversationSummary, ConversationMessage, ChatSettingsData } from "./types";

interface ChatAreaProps {
    conversation: ConversationSummary | null;
    messages: ConversationMessage[];
    isLoading: boolean;
    settings?: ChatSettingsData;
    onSendMessage: (content: string) => Promise<void>;
    onStatusChange: (status: 'open' | 'closed') => void;
    onDelete: () => void;
    onClose: () => void; // For mobile back
}

export function ChatArea({
    conversation,
    messages,
    isLoading,
    settings,
    onSendMessage,
    onStatusChange,
    onDelete,
    onClose,
}: ChatAreaProps) {
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, conversation?.id]);

    const handleSend = async () => {
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            await onSendMessage(newMessage);
            setNewMessage("");
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!conversation) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground bg-muted/5">
                <MessageSquare className="h-12 w-12 opacity-20 mb-4" />
                <h3 className="text-lg font-semibold">No conversation selected</h3>
                <p>Select a conversation from the list to view details.</p>
            </div>
        );
    }

    const assistantName = settings?.agentName || "Assistant";
    const assistantAvatar = settings?.agentAvatarUrl;

    const filteredMessages = messages.filter(msg => showDebug || !msg.metadata?.internal);

    return (
        <div className="flex h-full flex-col bg-background w-full">
            {/* Header */}
            <div className="flex items-center justify-between border-b p-3 shadow-sm shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={onClose}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                            <AvatarFallback className="bg-primary/10 text-primary">
                                <User className="h-4 w-4" />
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold">{conversation.visitorName || "Guest"}</h2>
                                {conversation.status === 'closed' && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Archived</Badge>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <span>{conversation.visitorEmail || conversation.visitorPhone || "No contact info"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <div className="hidden sm:flex items-center text-xs text-muted-foreground mr-2">
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                            <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} className="accent-primary rounded-sm" />
                            Show debug
                        </label>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {conversation.status === 'open' ? (
                                <DropdownMenuItem onClick={() => onStatusChange('closed')}>
                                    <Archive className="mr-2 h-4 w-4" />
                                    Archive Conversation
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onClick={() => onStatusChange('open')}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Reopen Conversation
                                </DropdownMenuItem>
                            )}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Conversation
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to delete this conversation? All messages will be permanently removed.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 bg-muted/10 p-4" ref={scrollRef}>
                <div className="flex flex-col gap-4 max-w-3xl mx-auto pb-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredMessages.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                            No messages yet.
                        </div>
                    ) : (
                        filteredMessages.map((msg) => {
                            const isAssistant = msg.role === 'assistant';
                            const isInternal = msg.metadata?.internal === true;
                            // Improved rendering for different message types
                            if (isInternal) {
                                const isError = msg.metadata?.severity === 'error';
                                const isToolCall = msg.metadata?.type === 'tool_call';
                                const isToolResult = msg.metadata?.type === 'tool_result';

                                return (
                                    <div key={msg.id} className="flex justify-center my-2">
                                        <div className={cn(
                                            "text-[11px] font-mono px-3 py-2 rounded border max-w-[90%]",
                                            isError ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400" :
                                                isToolCall ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-400" :
                                                    isToolResult ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900 dark:text-green-400" :
                                                        "bg-secondary border-border text-muted-foreground"
                                        )}>
                                            <div className="flex items-center gap-2 mb-1 font-bold opacity-80">
                                                {isToolCall ? '🔧 Tool Call' : isToolResult ? '📤 Tool Result' : isError ? '⚠️ Error' : '⚙️ System'}
                                                {msg.metadata?.toolName && <Badge variant="outline" className="h-4 text-[9px] px-1">{msg.metadata.toolName}</Badge>}
                                            </div>
                                            <div className="whitespace-pre-wrap overflow-x-auto break-all">
                                                {msg.content}
                                            </div>
                                            {msg.metadata?.toolArgs && (
                                                <div className="mt-1 pt-1 border-t border-black/5 dark:border-white/5">
                                                    <span className="opacity-70">Args:</span> {JSON.stringify(msg.metadata.toolArgs)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex w-full items-end gap-2",
                                        isAssistant ? "justify-start" : "justify-end"
                                    )}
                                >
                                    {isAssistant && (
                                        <Avatar className="h-8 w-8 border bg-background shrink-0">
                                            {assistantAvatar ? (
                                                <AvatarImage src={assistantAvatar} alt={assistantName} className="object-cover" />
                                            ) : (
                                                <AvatarFallback><MessageSquare className="h-4 w-4" /></AvatarFallback>
                                            )}
                                        </Avatar>
                                    )}

                                    <div className={cn(
                                        "flex max-w-[80%] flex-col gap-1",
                                        isAssistant ? "items-start" : "items-end"
                                    )}>
                                        <div className={cn(
                                            "relative rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                                            isAssistant
                                                ? "bg-white dark:bg-slate-800 border text-foreground"
                                                : "bg-blue-600 text-white"
                                        )}>
                                            <div className="whitespace-pre-wrap leading-relaxed break-words">
                                                {renderMarkdown(msg.content)}
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground px-1">
                                            {format(new Date(msg.createdAt), "h:mm a")}
                                        </span>
                                    </div>

                                    {!isAssistant && (
                                        <Avatar className="h-8 w-8 bg-blue-100 text-blue-600 shrink-0 border-0">
                                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            {/* Input settings */}
            <div className="p-3 bg-background border-t shrink-0">
                <div className="relative flex items-end gap-2 max-w-3xl mx-auto">
                    <Textarea
                        ref={textareaRef}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="min-h-[44px] max-h-[150px] resize-none pr-12 py-3"
                        rows={1}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || isSending}
                        size="icon"
                        className="absolute right-1 bottom-1 h-9 w-9 mb-0.5 mr-0.5"
                    >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
                <div className="max-w-3xl mx-auto mt-2 flex justify-between items-center text-xs text-muted-foreground px-1">
                    <p>Press Enter to send, Shift+Enter for new line</p>
                </div>
            </div>
        </div>
    );
}
