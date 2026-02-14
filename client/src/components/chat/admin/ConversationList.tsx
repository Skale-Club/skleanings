
import { format } from "date-fns";
import { Archive, Loader2, RotateCcw, Search, Trash2, User } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";
import { ConversationSummary } from "./types";

interface ConversationListProps {
    conversations: ConversationSummary[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onArchive: (id: string) => void;
    onReopen: (id: string) => void;
    onDelete: (id: string) => void;
    isLoading: boolean;
}

export function ConversationList({
    conversations,
    selectedId,
    onSelect,
    onArchive,
    onReopen,
    onDelete,
    isLoading,
}: ConversationListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("open");

    const filteredConversations = conversations.filter((conv) => {
        const matchesSearch =
            conv.visitorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            conv.visitorEmail?.toLowerCase().includes(searchQuery.toLowerCase());

        if (activeTab === "all") return matchesSearch;
        if (activeTab === "archived") return matchesSearch && conv.status === "closed";
        return matchesSearch && conv.status === "open";
    });

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col border-r bg-muted/10">
            <div className="p-4 space-y-4">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search conversations..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="open">Open</TabsTrigger>
                        <TabsTrigger value="archived">Archived</TabsTrigger>
                        <TabsTrigger value="all">All</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-1 p-2">
                    {filteredConversations.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            No conversations found.
                        </div>
                    ) : (
                        filteredConversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={cn(
                                    "flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition-all hover:bg-accent",
                                    selectedId === conv.id ? "bg-accent border-primary/20" : "bg-card border-transparent"
                                )}
                                onClick={() => onSelect(conv.id)}
                            >
                                <div className="flex w-full flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{conv.visitorName || "Guest"}</span>
                                            {conv.status === 'closed' && (
                                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Archived</Badge>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), "MMM d, h:mm a") : ""}
                                        </span>
                                    </div>

                                    <div className="line-clamp-2 text-xs text-muted-foreground">
                                        {conv.lastMessage || "No messages yet"}
                                    </div>

                                    {selectedId === conv.id && (
                                        <div className="mt-2 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            {conv.status === 'open' ? (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                    title="Archive"
                                                    onClick={() => onArchive(conv.id)}
                                                >
                                                    <Archive className="h-3.5 w-3.5" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                    title="Reopen"
                                                    onClick={() => onReopen(conv.id)}
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                </Button>
                                            )}

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to delete this conversation? This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => onDelete(conv.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
