
import {
    Check,
    ChevronDown,
    GripVertical,
    Loader2,
    MessageSquare,
    Plus,
    Trash2,
    AlertCircle
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChatSettingsData, DEFAULT_CHAT_OBJECTIVES, IntakeObjective, UrlRule } from "./types";
import { cn } from "@/lib/utils";

interface ChatSettingsProps {
    settings: ChatSettingsData;
    onSave: (settings: Partial<ChatSettingsData>) => Promise<void>;
    isLoading: boolean;
    companyName?: string;
    companyLogo?: string;
    openaiEnabled: boolean;
    openaiHasKey: boolean;
    getAccessToken: () => Promise<string | null>;
    authenticatedRequest: (method: string, url: string, token: string, body?: any) => Promise<Response>;
}

function ObjectiveRow({ objective, onToggle }: { objective: IntakeObjective; onToggle: (id: IntakeObjective['id'], enabled: boolean) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: objective.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-slate-800 dark:border-slate-700"
        >
            <button
                type="button"
                className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-slate-400"
                {...attributes}
                {...listeners}
                aria-label="Drag to reorder"
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex-1">
                <p className="text-sm font-medium dark:text-slate-200">{objective.label}</p>
                <p className="text-xs text-muted-foreground">{objective.description}</p>
            </div>
            <Switch checked={objective.enabled} onCheckedChange={(checked) => onToggle(objective.id, checked)} />
        </div>
    );
}

export function ChatSettings({
    settings,
    onSave,
    isLoading,
    companyName,
    companyLogo,
    openaiEnabled,
    openaiHasKey,
    getAccessToken,
    authenticatedRequest
}: ChatSettingsProps) {
    const { toast } = useToast();
    const [settingsDraft, setSettingsDraft] = useState<ChatSettingsData>(settings);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

    const objectivesSensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleSave = useCallback(async (dataToSave: Partial<ChatSettingsData>) => {
        setIsSaving(true);
        try {
            await onSave(dataToSave);
            setLastSaved(new Date());
        } finally {
            setIsSaving(false);
        }
    }, [onSave]);

    const updateField = useCallback(<K extends keyof ChatSettingsData>(field: K, value: ChatSettingsData[K]) => {
        setSettingsDraft(prev => ({ ...prev, [field]: value }));

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            handleSave({ [field]: value });
        }, 800);
    }, [handleSave]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingAvatar(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                toast({ title: 'Upload failed', description: 'Authentication required', variant: 'destructive' });
                return;
            }

            // Using the authenticatedRequest passed from props or a direct fetch if consistent
            // The original code used authenticatedRequest for POST /api/upload
            const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
            const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

            await fetch(uploadURL, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type },
            });

            setSettingsDraft(prev => ({ ...prev, agentAvatarUrl: objectPath }));
            await handleSave({ agentAvatarUrl: objectPath });
            toast({ title: 'Avatar uploaded', description: 'Chat assistant avatar updated.' });
        } catch (error: any) {
            toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsUploadingAvatar(false);
            if (avatarFileInputRef.current) {
                avatarFileInputRef.current.value = '';
            }
        }
    };

    const addRule = () => {
        const currentRules = settingsDraft.excludedUrlRules || [];
        const newRules = [...currentRules, { pattern: '', match: 'starts_with' as const }];
        setSettingsDraft(prev => ({ ...prev, excludedUrlRules: newRules }));
        handleSave({ excludedUrlRules: newRules });
    };

    const updateRule = (index: number, field: keyof UrlRule, value: string) => {
        const currentRules = settingsDraft.excludedUrlRules || [];
        if (index < 0 || index >= currentRules.length) return;

        const rules = [...currentRules];
        rules[index] = { ...rules[index], [field]: value } as UrlRule;
        setSettingsDraft(prev => ({ ...prev, excludedUrlRules: rules }));

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            handleSave({ excludedUrlRules: rules });
        }, 800);
    };

    const removeRule = (index: number) => {
        const currentRules = settingsDraft.excludedUrlRules || [];
        if (index < 0 || index >= currentRules.length) return;

        const newRules = currentRules.filter((_, i) => i !== index);
        setSettingsDraft(prev => ({ ...prev, excludedUrlRules: newRules }));
        handleSave({ excludedUrlRules: newRules });
    };

    const handleObjectivesDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const items = settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES;
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(items, oldIndex, newIndex);
        setSettingsDraft((prev) => ({ ...prev, intakeObjectives: reordered }));
        handleSave({ intakeObjectives: reordered });
    };

    const toggleObjective = (id: IntakeObjective['id'], enabled: boolean) => {
        const items = settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES;
        const updated = items.map((item) => item.id === id ? { ...item, enabled } : item);
        setSettingsDraft((prev) => ({ ...prev, intakeObjectives: updated }));
        handleSave({ intakeObjectives: updated });
    };

    const assistantName = settingsDraft.agentName || companyName || 'Assistant';
    const assistantAvatar = (settingsDraft.agentAvatarUrl && settingsDraft.agentAvatarUrl.trim())
        ? settingsDraft.agentAvatarUrl
        : (companyLogo || '/favicon.png');

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Chat Settings</h3>
                    <p className="text-sm text-muted-foreground">Configure your assistant's behavior and appearance.</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isSaving ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Saving...</span>
                        </>
                    ) : lastSaved ? (
                        <>
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Saved</span>
                        </>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <CardTitle>General</CardTitle>
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm">
                                        {settingsDraft.enabled ? 'Enabled' : 'Disabled'}
                                    </Label>
                                    <Switch
                                        checked={settingsDraft.enabled}
                                        onCheckedChange={(checked) => updateField('enabled', checked)}
                                        disabled={isLoading || isSaving}
                                    />
                                </div>
                                <div className="flex items-center gap-3 pl-6 border-l border-border/50">
                                    <div className="flex flex-col gap-0.5">
                                        <Label className="text-sm text-foreground/80 font-medium whitespace-nowrap">
                                            Show in Production
                                        </Label>
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">If off, chat only shows on localhost</span>
                                    </div>
                                    <Switch
                                        checked={!!settingsDraft.showInProd}
                                        onCheckedChange={(c) => updateField("showInProd", c)}
                                        disabled={isLoading || isSaving}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/40">
                                <div className="relative h-16 w-16 rounded-full overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center border cursor-pointer group">
                                    {assistantAvatar ? (
                                        <img src={assistantAvatar} alt={assistantName} className="h-full w-full object-cover" />
                                    ) : (
                                        <MessageSquare className="w-6 h-6 text-muted-foreground" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Plus className="w-5 h-5 text-white" />
                                    </div>
                                    <input
                                        ref={avatarFileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="opacity-0 absolute inset-0 cursor-pointer"
                                        onChange={handleAvatarUpload}
                                    />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <h4 className="font-semibold">{assistantName}</h4>
                                    <p className="text-xs text-muted-foreground">This is how your assistant appears to visitors.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Agent Name</Label>
                                <Input
                                    value={settingsDraft.agentName}
                                    onChange={(e) => updateField('agentName', e.target.value)}
                                    placeholder={companyName || "Assistant"}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Welcome Message</Label>
                                <Textarea
                                    value={settingsDraft.welcomeMessage}
                                    onChange={(e) => updateField('welcomeMessage', e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>URL Exclusions</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">Hide the chat widget on specific pages.</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={addRule}>
                                <Plus className="w-4 h-4 mr-1" /> Add Rule
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {(!settingsDraft.excludedUrlRules || settingsDraft.excludedUrlRules.length === 0) && (
                            <div className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-lg">
                                No exclusion rules. The chat widget will appear on all pages.
                            </div>
                        )}
                        {settingsDraft.excludedUrlRules?.map((rule, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <Input
                                    value={rule.pattern}
                                    onChange={(e) => updateRule(idx, 'pattern', e.target.value)}
                                    placeholder="/admin"
                                    className="flex-1"
                                />
                                <Select
                                    value={rule.match}
                                    onValueChange={(val) => updateRule(idx, 'match', val as UrlRule['match'])}
                                >
                                    <SelectTrigger className="w-[130px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="contains">Contains</SelectItem>
                                        <SelectItem value="starts_with">Starts with</SelectItem>
                                        <SelectItem value="equals">Equals</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => removeRule(idx)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {(!openaiEnabled || !openaiHasKey) && (
                    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                        <CardContent className="pt-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-amber-800 dark:text-amber-200">OpenAI not configured</p>
                                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                        {!openaiHasKey
                                            ? 'Add your OpenAI API key in Integrations to enable AI responses.'
                                            : 'Enable the OpenAI integration in Integrations.'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Intake Questions</CardTitle>
                        <p className="text-sm text-muted-foreground">Drag to reorder the questions asked before connecting to a human.</p>
                    </CardHeader>
                    <CardContent>
                        <DndContext sensors={objectivesSensors} collisionDetection={closestCenter} onDragEnd={handleObjectivesDragEnd}>
                            <SortableContext
                                items={(settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES).map((o) => o.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {(settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES).map((objective) => (
                                        <ObjectiveRow
                                            key={objective.id}
                                            objective={objective}
                                            onToggle={toggleObjective}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
