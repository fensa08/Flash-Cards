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

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getErrorMessage(statusCode: number, defaultMessage: string): string {
  switch (statusCode) {
    case 400:
      return `Bad Request: ${defaultMessage}`;
    case 401:
      return 'Unauthorized: Please log in again';
    case 403:
      return 'Forbidden: You do not have permission to perform this action';
    case 404:
      return 'Not Found: The requested resource does not exist';
    case 500:
      // Check if this is likely a proxy error (backend not running)
      if (defaultMessage === 'Request failed' || !defaultMessage) {
        return 'Cannot connect to backend server. Please ensure the backend is running (npm run dev in backend folder)';
      }
      return `Server Error: ${defaultMessage}`;
    case 502:
      return 'Backend server is not running. Please start it with: cd backend && npm run dev';
    case 503:
      return 'Service Unavailable: The server is overloaded or under maintenance';
    default:
      return defaultMessage || `Request failed with status ${statusCode}`;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = getErrorMessage(
      response.status,
      errorData.error || errorData.message || 'Request failed'
    );
    throw new ApiError(message, response.status);
  }
  return response.json();
}

async function fetchWithErrorHandling(url: string, options?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    // Network errors (backend not running, no internet, etc.)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        'Unable to connect to the server. Please ensure the backend is running on port 3001.',
        undefined,
        true
      );
    }
    throw new ApiError(
      `Network error: ${error instanceof Error ? error.message : 'Connection failed'}`,
      undefined,
      true
    );
  }
}

// Deck API
export async function getDecks(): Promise<Deck[]> {
  const response = await fetchWithErrorHandling(`${API_BASE}/decks`);
  return handleResponse<Deck[]>(response);
}

export async function getDeck(id: number): Promise<Deck> {
  const response = await fetchWithErrorHandling(`${API_BASE}/decks/${id}`);
  return handleResponse<Deck>(response);
}

export async function createDeck(name: string): Promise<Deck> {
  const response = await fetchWithErrorHandling(`${API_BASE}/decks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return handleResponse<Deck>(response);
}

export async function deleteDeck(id: number): Promise<void> {
  const response = await fetchWithErrorHandling(`${API_BASE}/decks/${id}`, {
    method: 'DELETE'
  });
  await handleResponse(response);
}

export async function getDeckCards(deckId: number): Promise<Card[]> {
  const response = await fetchWithErrorHandling(`${API_BASE}/decks/${deckId}/cards`);
  return handleResponse<Card[]>(response);
}

// Card API
export async function bulkImportCards(deckId: number, questions: string[]): Promise<{ count: number }> {
  const response = await fetchWithErrorHandling(`${API_BASE}/cards/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deck_id: deckId, questions })
  });
  return handleResponse<{ count: number }>(response);
}

export async function deleteCard(id: number): Promise<void> {
  const response = await fetchWithErrorHandling(`${API_BASE}/cards/${id}`, {
    method: 'DELETE'
  });
  await handleResponse(response);
}

// Study API
export async function getNextCard(deckId: number, excludedIds: number[]): Promise<StudyResponse> {
  const params = excludedIds.length > 0 ? `?excluded=${excludedIds.join(',')}` : '';
  const response = await fetchWithErrorHandling(`${API_BASE}/study/${deckId}/next${params}`);
  return handleResponse<StudyResponse>(response);
}

export async function submitAnswer(deckId: number, cardId: number, responseType: ResponseType): Promise<AnswerResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE}/study/${deckId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id: cardId, response: responseType })
  });
  return handleResponse<AnswerResponse>(response);
}

export async function resetDeckWeights(deckId: number): Promise<void> {
  const response = await fetchWithErrorHandling(`${API_BASE}/study/${deckId}/reset`, {
    method: 'POST'
  });
  await handleResponse(response);
}
