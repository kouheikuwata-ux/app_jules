import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchWithRetry } from '@/lib/apiClient';
import { Loader2, BarChart, Users, Calendar } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

interface Stats {
    total_cartes: number;
    recent_cartes: number;
    top_styles: { style: string; count: number }[];
}

export function Dashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetchWithRetry(`${API_BASE_URL}/stats`);
                if (!response.ok) {
                    throw new Error('統計データの取得に失敗しました。');
                }
                const data = await response.json();
                setStats(data);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "An unknown error occurred.";
                setError(message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
        return <div className="text-destructive p-8 text-center"><p>{error}</p></div>;
    }

    if (!stats) {
        return <div className="text-center text-muted-foreground py-8"><p>統計データを表示できません。</p></div>;
    }

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">総カルテ数</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total_cartes}</div>
                        <p className="text-xs text-muted-foreground">これまでに作成されたカルテの総数</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">直近30日間のカルテ数</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.recent_cartes}</div>
                        <p className="text-xs text-muted-foreground">過去30日間に作成されたカルテ</p>
                    </CardContent>
                </Card>
            </div>
            <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <BarChart className="mr-2 h-5 w-5 text-muted-foreground" />
                        人気スタイル Top 3
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {stats.top_styles.length > 0 ? (
                            stats.top_styles.map((item, index) => (
                                <div key={index} className="flex justify-between items-center">
                                    <span className="font-medium">{index + 1}. {item.style}</span>
                                    <span className="text-sm text-muted-foreground">{item.count}件</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">分析データがまだありません。</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
