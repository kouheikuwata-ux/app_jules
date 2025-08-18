import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Eye, RefreshCw, Search } from "lucide-react";
import { fetchWithRetry, API_BASE_URL } from "@/lib/apiClient";
import { useDebounce } from "@/hooks/useDebounce";

// Define the type for a single carte record
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
    created_at: string;
    updated_at: string;
}

export function CarteList() {
    const [cartes, setCartes] = useState<Carte[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    const fetchCartes = useCallback(async (query: string, showToast = false) => {
        setIsLoading(true);
        setError(null);
        const toastId = showToast ? toast.loading("一覧を更新中...") : undefined;
        try {
            const url = `${API_BASE_URL}/api/cartes?q=${encodeURIComponent(query)}`;
            const response = await fetchWithRetry(url);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'カルテの取得に失敗しました。' }));
                throw new Error(errorData.error);
            }
            const data = await response.json();
            setCartes(data);
            if (showToast) toast.success("一覧を更新しました。", { id: toastId });
        } catch (err: any) {
            setError(err.message);
            if (toastId) toast.error(err.message, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Fetch cartes whenever the debounced search query changes.
        fetchCartes(debouncedSearchQuery);
    }, [debouncedSearchQuery, fetchCartes]);

    const handleDelete = async (carteId: number) => {
        const toastId = toast.loading("カルテを削除しています...");
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/api/cartes/${carteId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '削除に失敗しました。' }));
                throw new Error(errorData.error);
            }
            toast.success("カルテを削除しました。", { id: toastId });
            setCartes(prevCartes => prevCartes.filter(c => c.id !== carteId));
        } catch (err: any) {
            toast.error(`削除エラー: ${err.message}`, { id: toastId });
        }
    };

    if (error && cartes.length === 0) {
        return (
             <div className="text-destructive p-8 text-center">
                <p>{error}</p>
                <Button onClick={() => fetchCartes(debouncedSearchQuery, true)} className="mt-4">再試行</Button>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle>カルテ一覧</CardTitle>
                        <CardDescription>保存されているカウンセリング記録の一覧です。({cartes.length}件)</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                         <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="顧客名で検索..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={() => fetchCartes(debouncedSearchQuery, true)} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 {isLoading && cartes.length === 0 ? (
                    <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                 ) : cartes.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        <p>{searchQuery ? `「${searchQuery}」に一致するカルテはありません。` : "保存されているカルテはありません。"}</p>
                    </div>
                ) : (
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {cartes.map((carte) => (
                            <Card key={carte.id} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle className="text-lg">{carte.customer_name}</CardTitle>
                                    <CardDescription>{new Date(carte.created_at).toLocaleString('ja-JP')}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                        {carte.counseling_content || "カウンセリング内容がありません。"}
                                    </p>
                                </CardContent>
                                <CardFooter className="flex justify-end gap-2">
                                    <Dialog>
                                        <DialogTrigger asChild><Button variant="outline" size="sm"><Eye className="mr-2 h-4 w-4"/>詳細</Button></DialogTrigger>
                                        <DialogContent className="max-w-3xl">
                                            <DialogHeader>
                                                <DialogTitle>カルテ詳細: {carte.customer_name}</DialogTitle>
                                                <DialogDescription>作成日時: {new Date(carte.created_at).toLocaleString('ja-JP')}</DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 max-h-[70vh] overflow-y-auto p-4">
                                                <h4 className="font-semibold">顧客情報</h4>
                                                <p><strong>フリガナ:</strong> {carte.customer_name_kana || '未登録'}</p>
                                                <p><strong>電話番号:</strong> {carte.phone_number || '未登録'}</p>
                                                <p><strong>メール:</strong> {carte.email || '未登録'}</p>
                                                <hr/><h4 className="font-semibold">カウンセリング内容</h4>
                                                <p className="whitespace-pre-wrap text-sm bg-muted p-2 rounded-md">{carte.counseling_content || '未登録'}</p>
                                                <hr/><h4 className="font-semibold">AI分析結果</h4>
                                                {carte.ai_analysis ? (
                                                    <div className="text-sm space-y-1">
                                                        <p><strong>顧客の要望:</strong> {carte.ai_analysis.customer_requests}</p>
                                                        <p><strong>髪の状態:</strong> {carte.ai_analysis.hair_condition}</p>
                                                        <p><strong>スタイリストの提案:</strong> {carte.ai_analysis.stylist_suggestions}</p>
                                                        <p><strong>決定したスタイル:</strong> {carte.ai_analysis.chosen_style}</p>
                                                        <p><strong>信頼度スコア:</strong> {carte.ai_analysis.confidence_score?.toFixed(2)}</p>
                                                    </div>
                                                ) : <p>AI分析結果はありません。</p>}
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4"/>削除</Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
                                                <AlertDialogDescription>顧客「{carte.customer_name}」のカルテを完全に削除します。この操作は元に戻せません。</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(carte.id)}>削除する</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
