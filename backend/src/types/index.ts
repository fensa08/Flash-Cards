export interface Deck {
  id: number;
  name: string;
  created_at: Date;
  card_count?: number;
}

export interface Card {
  id: number;
  deck_id: number;
  question: string;
  weight: number;
  times_seen: number;
  created_at: Date;
}

export interface CreateDeckRequest {
  name: string;
}

export interface BulkImportRequest {
  deck_id: number;
  questions: string[];
}

export interface AnswerRequest {
  card_id: number;
  response: 'know' | 'uncertain' | 'dont_know';
}

export interface StudySession {
  deck_id: number;
  excluded_card_ids: number[];
}

