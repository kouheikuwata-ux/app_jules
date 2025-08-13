import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Eye, RefreshCw, Search, Pencil, FileDown } from "lucide-react";
import { fetchWithRetry } from "@/lib/apiClient";
import { useDebounce } from "@/hooks/useDebounce";
import { EditCarteForm } from "./EditCarteForm";
import jsPDF from 'jspdf';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

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
    const [editingCarte, setEditingCarte] = useState<Carte | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchCartes = useCallback(async (query: string, sDate: string, eDate: string, showToast = false) => {
        setIsLoading(true);
        setError(null);
        const toastId = showToast ? toast.loading("一覧を更新中...") : undefined;
        try {
            const params = new URLSearchParams();
            if (query) params.append('q', query);
            if (sDate) params.append('startDate', sDate);
            if (eDate) params.append('endDate', eDate);

            const url = `${API_BASE_URL}/cartes?${params.toString()}`;
            const response = await fetchWithRetry(url);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'カルテの取得に失敗しました。' }));
                throw new Error(errorData.error);
            }
            const data = await response.json();
            setCartes(data);
            if (showToast) toast.success("一覧を更新しました。", { id: toastId });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(message);
            if (toastId) toast.error(message, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Fetch cartes whenever the debounced search query or dates change.
        fetchCartes(debouncedSearchQuery, startDate, endDate);
    }, [debouncedSearchQuery, startDate, endDate, fetchCartes]);

    const handleDelete = async (carteId: number) => {
        const toastId = toast.loading("カルテを削除しています...");
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/cartes/${carteId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '削除に失敗しました。' }));
                throw new Error(errorData.error);
            }
            toast.success("カルテを削除しました。", { id: toastId });
            setCartes(prevCartes => prevCartes.filter(c => c.id !== carteId));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "An unknown error occurred.";
            toast.error(`削除エラー: ${message}`, { id: toastId });
        }
    };

    const handlePdfExport = (carte: Carte) => {
        try {
            const doc = new jsPDF();
            doc.setFont('helvetica', 'normal');

            doc.setFontSize(20);
            doc.text('Counseling Carte', 14, 22);

            doc.setFontSize(12);
            doc.text(`Customer: ${carte.customer_name}`, 14, 32);
            doc.text(`Date: ${new Date(carte.created_at).toLocaleString('ja-JP')}`, 14, 38);
            doc.line(14, 42, 196, 42);

            let y = 50;
            doc.setFontSize(14);
            doc.text('Counseling Content', 14, y);
            y += 6;
            doc.setFontSize(10);
            const counselingLines = doc.splitTextToSize(carte.counseling_content || 'N/A', 182);
            doc.text(counselingLines, 14, y);
            y += counselingLines.length * 4 + 6;

            doc.line(14, y, 196, y);
            y += 10;

            doc.setFontSize(14);
            doc.text('AI Analysis', 14, y);
            y += 6;
            doc.setFontSize(10);

            if (carte.ai_analysis) {
                const analysisText = `Customer Requests: ${carte.ai_analysis.customer_requests}\n\nHair Condition: ${carte.ai_analysis.hair_condition}\n\nStylist Suggestions: ${carte.ai_analysis.stylist_suggestions}\n\nChosen Style: ${carte.ai_analysis.chosen_style}\n\nConfidence: ${carte.ai_analysis.confidence_score?.toFixed(2)}`;
                const analysisLines = doc.splitTextToSize(analysisText, 182);
                doc.text(analysisLines, 14, y);
            } else {
                doc.text('No AI analysis available.', 14, y);
            }

            doc.save(`carte_${carte.id}_${carte.customer_name}.pdf`);
            toast.success("PDFのダウンロードを開始しました。");
        } catch (e) {
            console.error("Failed to generate PDF", e);
            toast.error("PDFの生成に失敗しました。");
        }
    };

    if (error && cartes.length === 0) {
        return (
             <div className="text-destructive p-8 text-center">
                <p>{error}</p>
                <Button onClick={() => fetchCartes(debouncedSearchQuery, startDate, endDate, true)} className="mt-4">再試行</Button>
            </div>
        );
    }

    return (
        <>
            <Dialog open={!!editingCarte} onOpenChange={(isOpen) => { if (!isOpen) setEditingCarte(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>カルテ編集: {editingCarte?.customer_name}</DialogTitle>
                        <DialogDescription>カルテの内容を編集します。変更後は更新ボタンを押してください。</DialogDescription>
                    </DialogHeader>
                    {editingCarte && (
                        <EditCarteForm
                            carte={editingCarte}
                            onSave={() => {
                                setEditingCarte(null);
                                fetchCartes(debouncedSearchQuery, startDate, endDate, true);
                            }}
                            onCancel={() => setEditingCarte(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle>カルテ一覧</CardTitle>
                        <CardDescription>保存されているカウンセリング記録の一覧です。({cartes.length}件)</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                         <div className="relative w-full max-w-xs">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="顧客名で検索..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-auto"
                        />
                        <span className="text-muted-foreground">-</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-auto"
                        />
                        <Button variant="outline" size="icon" onClick={() => fetchCartes(debouncedSearchQuery, startDate, endDate, true)} disabled={isLoading}>
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
                                    <Button variant="secondary" size="sm" onClick={() => setEditingCarte(carte)}><Pencil className="mr-2 h-4 w-4"/>編集</Button>
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
                                                <hr/><h4 className="font-semibold">関連写真</h4>
                                                {carte.photos && carte.photos.length > 0 ? (
                                                    <div className="flex flex-wrap gap-4">
                                                        {carte.photos.map((url, index) => (
                                                            <a href={url} target="_blank" rel="noopener noreferrer" key={index}>
                                                                <img
                                                                    src={url}
                                                                    alt={`photo ${index + 1}`}
                                                                    className="h-24 w-24 object-cover rounded-md border hover:opacity-75 transition-opacity"
                                                                />
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : <p>関連写真はありません。</p>}
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => handlePdfExport(carte)}><FileDown className="mr-2 h-4 w-4"/>PDF出力</Button>
                                            </DialogFooter>
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
        </>
    );
}
