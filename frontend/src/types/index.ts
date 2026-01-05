export interface Deck {
  id: number;
  name: string;
  created_at: string;
  card_count: number;
}

export interface Card {
  id: number;
  deck_id: number;
  question: string;
  weight: number;
  times_seen: number;
  created_at: string;
}

export type ResponseType = 'know' | 'uncertain' | 'dont_know';

export interface StudyResponse {
  card: Card | null;
  remaining: number;
}

export interface AnswerResponse {
  card: Card;
  exclude: boolean;
}
