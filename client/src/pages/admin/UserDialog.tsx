import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, authenticatedRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/context/AuthContext";
import { User, insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { UppyFile } from "@uppy/core";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type UserDialogProps = {
    user?: User;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

// Use the insert schema but make some fields optional/required as needed for the form
const formSchema = insertUserSchema.extend({
    // Add specific validations if needed, schema is generated from drizzle-zod
});

type FormValues = z.infer<typeof formSchema>;

export function UserDialog({ user, open, onOpenChange }: UserDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { getAccessToken } = useAdminAuth();
    const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>({});

    const getUploadParameters = async (file: UppyFile<Record<string, unknown>, Record<string, unknown>>) => {
        const token = await getAccessToken();
        if (!token) throw new Error("No access token available");

        const response = await fetch("/upload", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                name: file.name,
                size: file.size,
                contentType: file.type || "application/octet-stream",
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to get upload URL");
        }

        const data = await response.json();
        setUploadedUrls(prev => ({ ...prev, [file.id]: data.objectPath }));

        return {
            method: "PUT" as const,
            url: data.uploadURL,
            headers: {
                "Content-Type": file.type || "application/octet-stream"
            }
        };
    };

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: user?.email || "",
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
            profileImageUrl: user?.profileImageUrl || "",
            isAdmin: user?.isAdmin || false,
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                email: user?.email || "",
                firstName: user?.firstName || "",
                lastName: user?.lastName || "",
                profileImageUrl: user?.profileImageUrl || "",
                isAdmin: user?.isAdmin || false,
            });
        }
    }, [user, open, form]);

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            const token = await getAccessToken();
            if (!token) throw new Error("No access token available");
            const method = user ? "PATCH" : "POST";
            const url = user ? `/api/users/${user.id}` : "/api/users";
            const res = await authenticatedRequest(method, url, token, values);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({
                title: user ? "User updated" : "User created",
            });
            onOpenChange(false);
            form.reset();
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    function onSubmit(values: FormValues) {
        mutation.mutate(values);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{user ? "Edit User" : "Create User"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="email@example.com" {...field} value={field.value || ''} disabled={!!user} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="firstName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>First Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="John" {...field} value={field.value || ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="lastName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Last Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Doe" {...field} value={field.value || ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="profileImageUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Profile Image</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-16 w-16">
                                                <AvatarImage src={field.value || undefined} />
                                                <AvatarFallback>
                                                    {form.getValues("firstName")?.[0]}
                                                    {form.getValues("lastName")?.[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col gap-2">
                                                <ObjectUploader
                                                    maxFileSize={1048576} // 1MB
                                                    onGetUploadParameters={getUploadParameters}
                                                    onComplete={(result) => {
                                                        const file = result.successful?.[0];
                                                        if (file) {
                                                            const url = uploadedUrls[file.id];
                                                            if (url) {
                                                                field.onChange(url);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    Upload Photo
                                                </ObjectUploader>
                                                <p className="text-xs text-muted-foreground">
                                                    Max size: 1MB. Formats: JPG, PNG.
                                                </p>
                                            </div>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="isAdmin"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Admin Access</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value || false}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end">
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
