'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTranscriptions, deleteTranscription, Transcription } from '@/lib/firestore';
import { Button } from './ui/button';
import { Download, Trash2, FileText } from 'lucide-react';

export function TranscriptionHistory() {
  const { user } = useAuth();
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getTranscriptions(user.uid).then(setTranscriptions).finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteTranscription(user.uid, id);
    setTranscriptions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDownload = (t: Transcription) => {
    const blob = new Blob([t.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.title || '文字起こし'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="py-8 text-center text-sm text-gray-500">読み込み中...</div>;

  if (transcriptions.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        <FileText className="mx-auto mb-3 h-12 w-12 text-gray-300" />
        <p className="font-medium">保存された文字起こしはありません</p>
        <p className="mt-1 text-sm">録音ページで音声を録音して保存してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transcriptions.map((t) => (
        <div key={t.id} className="rounded-lg border p-4 transition-colors hover:bg-gray-50">
          <div className="flex items-start justify-between gap-3">
            <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-900">{t.title}</p>
              <p className="mt-0.5 text-xs text-gray-400">{t.createdAt.toDate().toLocaleString('ja-JP')}</p>
            </button>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleDownload(t)} className="h-auto p-1.5 text-gray-500 hover:text-blue-600" title="ダウンロード">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="h-auto p-1.5 text-gray-500 hover:text-red-600" title="削除">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {expandedId === t.id && (
            <div className="mt-3 border-t pt-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{t.text}</div>
          )}
        </div>
      ))}
    </div>
  );
}
