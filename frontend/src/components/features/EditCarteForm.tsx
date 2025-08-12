import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { fetchWithRetry } from "@/lib/apiClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

interface Carte {
    id: number;
    customer_name: string;
    customer_name_kana: string;
    phone_number: string;
    email: string;
    counseling_content: string;
    ai_analysis: {
        customer_requests: string;
        hair_condition: string;
        stylist_suggestions: string;
        chosen_style: string;
        confidence_score: number;
    } | null;
    photos: string[];
}

interface EditCarteFormProps {
    carte: Carte;
    onSave: () => void;
    onCancel: () => void;
}

export function EditCarteForm({ carte, onSave, onCancel }: EditCarteFormProps) {
    const [formData, setFormData] = useState(carte);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setFormData(carte);
    }, [carte]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdate = async () => {
        setIsSaving(true);
        const toastId = toast.loading("カルテを更新しています...");
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/cartes/${carte.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '更新に失敗しました。');
            }
            toast.success("カルテを更新しました。", { id: toastId });
            onSave(); // Trigger refresh and close dialog
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "An unknown error occurred.";
            console.error("Update error:", err);
            toast.error(`更新エラー: ${message}`, { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="customer_name">お名前 *</Label>
                    <Input id="customer_name" name="customer_name" value={formData.customer_name} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="customer_name_kana">フリガナ</Label>
                    <Input id="customer_name_kana" name="customer_name_kana" value={formData.customer_name_kana} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone_number">電話番号</Label>
                    <Input id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">メールアドレス</Label>
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="counseling_content">カウンセリング内容</Label>
                <Textarea id="counseling_content" name="counseling_content" value={formData.counseling_content} onChange={handleChange} rows={8} />
            </div>
             {/* Note: Photo editing (add/remove) is not implemented in this version for simplicity */}
            <DialogFooter>
                <Button variant="outline" onClick={onCancel} disabled={isSaving}>キャンセル</Button>
                <Button onClick={handleUpdate} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    更新
                </Button>
            </DialogFooter>
        </div>
    );
}
