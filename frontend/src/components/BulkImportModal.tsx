import { useState, useEffect } from 'react';
import type { Deck, Card } from '../api/client';
import { bulkImportCards, getDeckCards, deleteCard } from '../api/client';

interface BulkImportModalProps {
  deck: Deck;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function BulkImportModal({ deck, onClose, onImportComplete }: BulkImportModalProps) {
  const [questions, setQuestions] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);

  useEffect(() => {
    loadCards();
  }, [deck.id]);

  const loadCards = async () => {
    try {
      const data = await getDeckCards(deck.id);
      setCards(data);
    } catch {
      // Silently fail, cards list is optional
    } finally {
      setLoadingCards(false);
    }
  };

  const handleImport = async () => {
    const lines = questions
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      setError('Please enter at least one question');
      return;
    }

    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await bulkImportCards(deck.id, lines);
      setSuccess(`Successfully imported ${result.count} cards!`);
      setQuestions('');
      await loadCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import cards');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteCard = async (card: Card) => {
    if (!confirm('Delete this card?')) return;

    try {
      await deleteCard(card.id);
      setCards(cards.filter(c => c.id !== card.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete card');
    }
  };

  const questionCount = questions
    .split('\n')
    .filter(line => line.trim().length > 0).length;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-slate-700/50 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-100">
              Manage Deck
            </h2>
            <p className="text-slate-400 mt-1">{deck.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Bulk Import Section */}
          <div className="mb-8">
            <h3 className="font-display text-lg font-semibold text-slate-200 mb-3">
              Bulk Import Questions
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Paste your questions below, one per line. Each line will become a separate flash card.
            </p>
            
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="What is the capital of France?&#10;Who wrote Romeo and Juliet?&#10;What year did World War II end?&#10;..."
              className="w-full h-48 px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none font-mono text-sm"
            />

            <div className="flex items-center justify-between mt-4">
              <span className="text-slate-500 text-sm">
                {questionCount} {questionCount === 1 ? 'question' : 'questions'} ready to import
              </span>
              <button
                onClick={handleImport}
                disabled={importing || questionCount === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25"
              >
                {importing ? 'Importing...' : 'Import Cards'}
              </button>
            </div>

            {/* Messages */}
            {error && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
                {success}
              </div>
            )}
          </div>

          {/* Existing Cards Section */}
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-200 mb-3">
              Existing Cards ({cards.length})
            </h3>
            
            {loadingCards ? (
              <div className="text-center py-8 text-slate-500">Loading cards...</div>
            ) : cards.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No cards in this deck yet</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between gap-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30 group"
                  >
                    <p className="text-slate-300 text-sm flex-1 truncate">{card.question}</p>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-500 px-2 py-1 bg-slate-700/50 rounded-full">
                        weight: {card.weight}
                      </span>
                      <button
                        onClick={() => handleDeleteCard(card)}
                        className="text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete card"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700/50 flex justify-end">
          <button
            onClick={onImportComplete}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
