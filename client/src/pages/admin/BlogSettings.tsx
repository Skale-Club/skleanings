import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Loader2, Play, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface BlogSettings {
    enabled: boolean;
    postsPerDay: number;
    lastRunAt: string | null;
    seoKeywords: string;
    promptStyle: string;
    enableTrendAnalysis: boolean;
}

export default function BlogSettings() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isGenerating, setIsGenerating] = useState(false);

    const { data: settings, isLoading } = useQuery<BlogSettings>({
        queryKey: ["/api/blog/settings"],
    });

    const [formData, setFormData] = useState<BlogSettings>({
        enabled: false,
        postsPerDay: 1,
        lastRunAt: null,
        seoKeywords: "",
        promptStyle: "",
        enableTrendAnalysis: true,
    });

    useEffect(() => {
        if (settings) {
            setFormData(settings);
        }
    }, [settings]);

    const updateSettingsMutation = useMutation({
        mutationFn: async (data: BlogSettings) => {
            const res = await apiRequest("PUT", "/api/blog/settings", data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/blog/settings"] });
            toast({
                title: "Settings saved",
                description: "Blog automation settings have been updated.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error saving settings",
                description: (error as Error).message,
                variant: "destructive",
            });
        },
    });

    const generateNowMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/blog/generate", { manual: true });
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["/api/blog/posts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/blog/settings"] });
            toast({
                title: "Blog post generated",
                description: `Successfully created: ${data.post?.title}`,
            });
        },
        onError: (error) => {
            toast({
                title: "Generation failed",
                description: (error as Error).message,
                variant: "destructive",
            });
        },
    });

    const handleSave = () => {
        updateSettingsMutation.mutate(formData);
    };

    const handleGenerateNow = async () => {
        setIsGenerating(true);
        try {
            await generateNowMutation.mutateAsync();
        } finally {
            setIsGenerating(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Automation Settings</CardTitle>
                    <CardDescription>Configure how the AI generates blog posts automatically.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    <div className="flex items-center justify-between space-x-2">
                        <div className="flex flex-col space-y-1">
                            <Label htmlFor="enabled">Enable Automated Posting</Label>
                            <span className="text-sm text-muted-foreground">
                                When enabled, the system will verify the schedule and generate posts.
                            </span>
                        </div>
                        <Switch
                            id="enabled"
                            checked={formData.enabled}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Posts Frequency (per day)</Label>
                        <div className="flex items-center space-x-4">
                            <Slider
                                value={[formData.postsPerDay]}
                                min={0}
                                max={4}
                                step={1}
                                onValueChange={(vals) => setFormData(prev => ({ ...prev, postsPerDay: vals[0] }))}
                                className="flex-1"
                            />
                            <span className="w-12 text-center font-bold border rounded p-1">
                                {formData.postsPerDay}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Set to 0 to disable automatic scheduling while keeping settings active.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="seoKeywords">Target SEO Keywords</Label>
                        <Input
                            id="seoKeywords"
                            placeholder="cleaning, home organization, maid service"
                            value={formData.seoKeywords || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, seoKeywords: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Comma-separated keywords to prioritize in generated content.
                        </p>
                    </div>

                    <div className="flex items-center justify-between space-x-2">
                        <div className="flex flex-col space-y-1">
                            <Label htmlFor="trendAnalysis">Enable Trend Analysis</Label>
                            <span className="text-sm text-muted-foreground">
                                AI will try to detect seasonal trends and relevant topics.
                            </span>
                        </div>
                        <Switch
                            id="trendAnalysis"
                            checked={formData.enableTrendAnalysis}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableTrendAnalysis: checked }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="promptStyle">Custom Style/Tone Instructions</Label>
                        <Textarea
                            id="promptStyle"
                            placeholder="e.g. Professional yet friendly, focus on eco-friendly solutions..."
                            value={formData.promptStyle || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, promptStyle: e.target.value }))}
                        />
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            {formData.lastRunAt ? `Last run: ${new Date(formData.lastRunAt).toLocaleString()}` : "Never run"}
                        </div>
                        <div className="space-x-2">
                            <Button
                                variant="outline"
                                onClick={handleGenerateNow}
                                disabled={isGenerating}
                            >
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                Generate Now
                            </Button>
                            <Button onClick={handleSave} disabled={updateSettingsMutation.isPending}>
                                {updateSettingsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {!updateSettingsMutation.isPending && <Save className="mr-2 h-4 w-4" />}
                                Save Settings
                            </Button>
                        </div>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
