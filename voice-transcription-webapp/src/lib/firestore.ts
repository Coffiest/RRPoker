import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Transcription {
  id: string;
  title: string;
  text: string;
  createdAt: Timestamp;
}

export async function saveTranscription(
  userId: string,
  text: string,
  title: string
): Promise<string> {
  const ref = await addDoc(collection(db, 'users', userId, 'transcriptions'), {
    text,
    title,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function getTranscriptions(userId: string): Promise<Transcription[]> {
  const q = query(
    collection(db, 'users', userId, 'transcriptions'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Transcription, 'id'>),
  }));
}

export async function deleteTranscription(
  userId: string,
  transcriptionId: string
): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'transcriptions', transcriptionId));
}
