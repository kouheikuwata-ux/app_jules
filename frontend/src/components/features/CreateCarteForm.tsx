import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Play, Square, Loader2 } from "lucide-react";
import { fetchWithRetry } from "@/lib/apiClient";

// Web Speech APIの型定義 (ブラウザ環境に依存するため)
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((this: SpeechRecognition, ev: any) => any) | null;
    onerror: ((this: SpeechRecognition, ev: any) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}
declare var SpeechRecognition: { prototype: SpeechRecognition; new(): SpeechRecognition; };
declare var webkitSpeechRecognition: { prototype: SpeechRecognition; new(): SpeechRecognition; };


export function CreateCarteForm() {
  // --- STATE ---
  const [customerName, setCustomerName] = useState('');
  const [customerNameKana, setCustomerNameKana] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- REFS ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognizerRef = useRef<SpeechRecognition | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- LIFECYCLE ---
  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Recognition) {
        const recognizer = new Recognition();
        recognizer.continuous = true;
        recognizer.interimResults = true;
        recognizer.lang = 'ja-JP';

        recognizer.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
              setTranscript(prev => prev + finalTranscript);
            }
        };

        recognizer.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setError(`音声認識エラー: ${event.error}`);
        };

        speechRecognizerRef.current = recognizer;
    } else {
        console.warn("Speech Recognition API is not supported in this browser.");
        setError("お使いのブラウザは音声認識に対応していません。");
    }

    return () => {
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        speechRecognizerRef.current?.stop();
        if(recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  // --- FUNCTIONS ---
  const resetForm = () => {
    setCustomerName('');
    setCustomerNameKana('');
    setPhoneNumber('');
    setEmail('');
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setTranscript('');
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setIsSaving(false);
    setError(null);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const startRecording = async () => {
    resetForm(); // Start fresh
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = recorder;

        const audioChunks: Blob[] = [];
        recorder.ondataavailable = (event) => audioChunks.push(event.data);
        recorder.onstop = () => setAudioBlob(new Blob(audioChunks, { type: 'audio/webm' }));

        recorder.start();
        speechRecognizerRef.current?.start();
        setIsRecording(true);

        recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
        console.error("Error starting recording:", err);
        setError("マイクへのアクセスが拒否されたか、エラーが発生しました。");
        toast.error("マイクへのアクセスに失敗しました。");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    speechRecognizerRef.current?.stop();
    if(recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
  };

  const handleAnalyze = async () => {
    if (!audioBlob) {
        toast.error("分析する音声がありません。");
        return;
    }
    setIsAnalyzing(true);
    setError(null);
    const toastId = toast.loading("AIによる分析を開始します...");

    const formData = new FormData();
    formData.append('audio', audioBlob, 'counseling.webm');

    try {
        const response = await fetchWithRetry('http://localhost:5000/api/v2/analyze-audio', { method: 'POST', body: formData });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'AI分析に失敗しました。');
        }
        const result = await response.json();
        setAnalysisResult(result.analysis);
        setTranscript(result.transcription);
        toast.success("AI分析が完了しました。", { id: toastId });
    } catch (err: any) {
        console.error("AI analysis error:", err);
        setError(err.message);
        // The fetchWithRetry function will show a generic error toast on final failure
        toast.error(`分析エラー: ${err.message}`, { id: toastId });
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleSaveCarte = async () => {
    if (!customerName) {
        toast.error("顧客名は必須です。");
        return;
    }
    setIsSaving(true);
    const toastId = toast.loading("カルテを保存しています...");

    const carteData = {
        customer_name: customerName,
        customer_name_kana: customerNameKana,
        phone_number: phoneNumber,
        email,
        counseling_content: transcript,
        ai_analysis: analysisResult,
        photos: [],
    };

    try {
        const response = await fetchWithRetry('http://localhost:5000/api/cartes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(carteData),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'カルテの保存に失敗しました。');
        }
        toast.success("カルテが正常に保存されました。", { id: toastId });
        resetForm(); // Clear form for next entry
    } catch (err: any) {
        console.error("Save carte error:", err);
        toast.error(`保存エラー: ${err.message}`, { id: toastId });
    } finally {
        setIsSaving(false);
    }
  };

  // --- RENDER ---
  return (
    <Card>
      <CardHeader>
        <CardTitle>新規カルテ作成</CardTitle>
        <CardDescription>顧客の新しいカウンセリング記録を作成します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Customer Info */}
        <div className="space-y-4">
            <h3 className="text-lg font-medium">1. 顧客情報</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="customer-name">お名前 *</Label><Input id="customer-name" placeholder="山田 花子" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="customer-name-kana">フリガナ</Label><Input id="customer-name-kana" placeholder="ヤマダ ハナコ" value={customerNameKana} onChange={(e) => setCustomerNameKana(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="phone-number">電話番号</Label><Input id="phone-number" placeholder="090-1234-5678" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="email">メールアドレス</Label><Input id="email" type="email" placeholder="hanako.yamada@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
        </div>

        {/* Counseling Recording */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">2. カウンセリング音声</h3>
          <div className="flex items-center gap-4 flex-wrap">
            {!isRecording ? (
                <Button onClick={startRecording}><Mic className="mr-2 h-4 w-4" />録音開始</Button>
            ) : (
                <Button onClick={stopRecording} variant="destructive"><MicOff className="mr-2 h-4 w-4" />録音停止</Button>
            )}
            <div className="flex items-center text-sm text-muted-foreground w-24">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2" style={{ display: isRecording ? 'block' : 'none' }}></div>
                {new Date(recordingTime * 1000).toISOString().substr(14, 5)}
            </div>
            {audioBlob && <audio ref={audioPlayerRef} src={URL.createObjectURL(audioBlob)} controls className="h-10"/>}
          </div>
          <Textarea placeholder="ここにカウンセリング内容がリアルタイムで文字起こしされます..." value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={6} />
        </div>

        {/* AI Analysis */}
        <div className="space-y-4">
            <h3 className="text-lg font-medium">3. AI分析</h3>
            <Button onClick={handleAnalyze} disabled={!audioBlob || isAnalyzing || isRecording}>
                {isAnalyzing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />分析中...</>) : ("AI分析を実行")}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {analysisResult && (
                <Card className="bg-muted/50">
                    <CardHeader><CardTitle className="text-base">AI分析結果</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p><strong>顧客の要望:</strong> {analysisResult.customer_requests}</p>
                        <p><strong>髪の状態:</strong> {analysisResult.hair_condition}</p>
                        <p><strong>スタイリストの提案:</strong> {analysisResult.stylist_suggestions}</p>
                        <p><strong>決定したスタイル:</strong> {analysisResult.chosen_style}</p>
                        <p><strong>信頼度スコア:</strong> {analysisResult.confidence_score?.toFixed(2)}</p>
                    </CardContent>
                </Card>
            )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={handleSaveCarte} size="lg" disabled={isSaving || !customerName}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            カルテを保存
        </Button>
      </CardFooter>
    </Card>
  );
}
