'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createSpeechRecognition, isSpeechRecognitionSupported, SpeechRecognitionEvent } from '@/lib/speech';
import { saveTranscription } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';
import { Mic, MicOff, Save, Trash2 } from 'lucide-react';

export function AudioRecorder() {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition>>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  const startRecording = useCallback(() => {
    const recognition = createSpeechRecognition();
    if (!recognition) return;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) setFinalText((prev) => prev + final);
      setInterimText(interim);
    };

    recognition.onerror = () => {
      isRecordingRef.current = false;
      setIsRecording(false);
    };

    recognition.onend = () => {
      setInterimText('');
      if (isRecordingRef.current && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { /* already started */ }
      }
    };

    recognitionRef.current = recognition;
    isRecordingRef.current = true;
    recognition.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setInterimText('');
  }, []);

  const handleSave = async () => {
    if (!user || !finalText.trim()) return;
    setIsSaving(true);
    try {
      const title = finalText.slice(0, 30) + (finalText.length > 30 ? '...' : '');
      await saveTranscription(user.uid, finalText, title);
      setSavedMessage('保存しました');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch {
      setSavedMessage('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
        このブラウザは Web Speech API に対応していません。Chrome または Edge をご利用ください。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={isRecording ? stopRecording : startRecording} variant={isRecording ? 'destructive' : 'default'} size="lg" className="gap-2">
          {isRecording ? <><MicOff className="h-5 w-5" />録音停止</> : <><Mic className="h-5 w-5" />録音開始</>}
        </Button>
        {isRecording && (
          <span className="flex items-center gap-2 text-sm font-medium text-red-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />録音中
          </span>
        )}
      </div>
      <div className="min-h-[200px] rounded-lg border bg-gray-50 p-4 text-gray-800 leading-relaxed whitespace-pre-wrap">
        {finalText}
        {interimText && <span className="text-gray-400">{interimText}</span>}
        {!finalText && !interimText && <span className="text-gray-400">録音を開始すると、ここに文字起こし結果が表示されます...</span>}
      </div>
      {(finalText || interimText) && (
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={!finalText.trim() || isSaving} variant="outline" className="gap-2">
            <Save className="h-4 w-4" />{isSaving ? '保存中...' : '保存'}
          </Button>
          <Button onClick={() => { setFinalText(''); setInterimText(''); }} variant="ghost" className="gap-2 text-gray-500">
            <Trash2 className="h-4 w-4" />クリア
          </Button>
          {savedMessage && <span className="text-sm font-medium text-green-600">{savedMessage}</span>}
        </div>
      )}
    </div>
  );
}
