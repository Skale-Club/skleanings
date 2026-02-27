
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Camera,
    Check,
    Loader2,
    MessageSquare,
    Plus,
    Trash2,
    X,
} from "lucide-react";
import { useRef } from "react";

// Define locally if not exported, or import if it is. 
// Assuming it keeps the same structure as in Admin.tsx
export type UrlRule = {
    pattern: string;
    match: 'contains' | 'starts_with' | 'equals';
};

interface ChatGeneralSettingsProps {
    settingsDraft: any; // We'll refine this type based on usages
    updateField: (field: string, value: any) => void;
    isSaving: boolean;
    lastSaved: boolean;
    loadingSettings: boolean;
    handleToggleChat: (checked: boolean) => void;
    assistantAvatar: string | null;
    assistantName: string;
    isUploadingAvatar: boolean;
    handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    addRule: () => void;
    updateRule: (index: number, field: keyof UrlRule, value: any) => void;
    removeRule: (index: number) => void;
    companyName: string;
}

export function ChatGeneralSettings({
    settingsDraft,
    updateField,
    isSaving,
    lastSaved,
    loadingSettings,
    handleToggleChat,
    assistantAvatar,
    assistantName,
    isUploadingAvatar,
    handleAvatarUpload,
    addRule,
    updateRule,
    removeRule,
    companyName,
}: ChatGeneralSettingsProps) {
    const avatarFileInputRef = useRef<HTMLInputElement>(null);

    return (
        <Card className="border-0 bg-muted dark:bg-slate-800/60 shadow-none">
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <CardTitle>General Settings</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : lastSaved ? (
                                <>
                                    <Check className="h-4 w-4 text-green-500" />
                                    <span>Auto-saved</span>
                                </>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Label className="text-sm text-foreground/80 font-medium">
                                Chat Enabled
                            </Label>
                            <Switch
                                checked={settingsDraft.enabled}
                                onCheckedChange={handleToggleChat}
                                disabled={loadingSettings || isSaving}
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
                                disabled={loadingSettings || isSaving}
                            />
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Agent Identity Section */}
                <div className="bg-card rounded-lg border border-border/70 dark:bg-slate-900/80 dark:border-slate-800/70 p-6">
                    <h3 className="font-medium text-sm mb-4">Agent Identity</h3>
                    <div className="flex flex-col sm:flex-row gap-6">
                        {/* Avatar Upload */}
                        <div className="flex flex-col gap-2 items-center shrink-0">
                            <div
                                className="relative group cursor-pointer"
                                onClick={() => avatarFileInputRef.current?.click()}
                            >
                                <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-border bg-muted shadow-sm transition-all group-hover:border-primary">
                                    {assistantAvatar ? (
                                        <img
                                            src={assistantAvatar}
                                            alt={assistantName}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center bg-secondary text-secondary-foreground">
                                            <MessageSquare className="w-10 h-10 opacity-50" />
                                        </div>
                                    )}
                                </div>

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                                    {isUploadingAvatar ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>
                                            <Camera className="w-6 h-6 mb-1" />
                                            <span className="text-[10px] font-medium">Change</span>
                                        </>
                                    )}
                                </div>

                                <input
                                    ref={avatarFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                />
                            </div>
                        </div>

                        {/* Agent Name & Avatar URL */}
                        <div className="flex-1 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="agent-name">Agent Name</Label>
                                <Input
                                    id="agent-name"
                                    value={settingsDraft.agentName}
                                    onChange={(e) => updateField("agentName", e.target.value)}
                                    placeholder={companyName || "Assistant"}
                                    className="max-w-md"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    This name will be displayed to visitors in the chat widget.
                                </p>
                            </div>

                            <Collapsible>
                                <CollapsibleTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 text-xs text-muted-foreground hover:underline"
                                    >
                                        Use image URL instead
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-2">
                                    <Input
                                        id="agent-avatar-url"
                                        value={settingsDraft.agentAvatarUrl || ""}
                                        onChange={(e) =>
                                            updateField("agentAvatarUrl", e.target.value)
                                        }
                                        placeholder="https://example.com/avatar.png"
                                        className="max-w-md h-8 text-xs"
                                    />
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    </div>
                </div>

                {/* Welcome Message */}
                <div className="space-y-2">
                    <Label htmlFor="welcome-message">Welcome message</Label>
                    <Textarea
                        id="welcome-message"
                        value={settingsDraft.welcomeMessage}
                        onChange={(e) => updateField("welcomeMessage", e.target.value)}
                        rows={2}
                        className="resize-none"
                    />
                </div>

                {/* URL Exclusions */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>URL Exclusions</Label>
                            <p className="text-xs text-muted-foreground">
                                Hide the widget on specific paths
                            </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={addRule}>
                            <Plus className="w-4 h-4 mr-1" /> Add Rule
                        </Button>
                    </div>
                    {(!settingsDraft.excludedUrlRules ||
                        settingsDraft.excludedUrlRules.length === 0) && (
                            <div className="text-sm text-muted-foreground bg-card/80 dark:bg-slate-900/70 border border-border/60 dark:border-slate-800/60 rounded-md p-3">
                                No rules yet.
                            </div>
                        )}
                    <div className="space-y-3">
                        {(settingsDraft.excludedUrlRules || []).map(
                            (rule: UrlRule, idx: number) => (
                                <div
                                    key={`url-rule-${idx}`}
                                    className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto] items-center"
                                >
                                    <Input
                                        placeholder="/admin"
                                        value={rule.pattern || ""}
                                        onChange={(e) =>
                                            updateRule(idx, "pattern", e.target.value)
                                        }
                                    />
                                    <Select
                                        value={rule.match || "starts_with"}
                                        onValueChange={(val) =>
                                            updateRule(idx, "match", val as UrlRule["match"])
                                        }
                                    >
                                        <SelectTrigger>
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
                                        className="h-9 w-9 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                        onClick={() => removeRule(idx)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
