import { useState, useEffect } from 'react';
import type { Deck } from '../api/client';
import { getDecks, createDeck, deleteDeck } from '../api/client';
import DeckCard from './DeckCard';
import BulkImportModal from './BulkImportModal';

interface DeckListProps {
  onStudy: (deck: Deck) => void;
}

export default function DeckList({ onStudy }: DeckListProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDeckName, setNewDeckName] = useState('');
  const [creating, setCreating] = useState(false);
  const [managingDeck, setManagingDeck] = useState<Deck | null>(null);

  const loadDecks = async () => {
    try {
      setError(null);
      const data = await getDecks();
      setDecks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load decks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDecks();
  }, []);

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim() || creating) return;

    setCreating(true);
    try {
      await createDeck(newDeckName.trim());
      setNewDeckName('');
      await loadDecks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deck');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDeck = async (deck: Deck) => {
    if (!confirm(`Delete "${deck.name}" and all its cards?`)) return;

    try {
      await deleteDeck(deck.id);
      await loadDecks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deck');
    }
  };

  const handleImportComplete = () => {
    setManagingDeck(null);
    loadDecks();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 font-medium">Loading decks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="font-display text-5xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
          Flash Cards
        </h1>
        <p className="text-slate-400 text-lg">Master your knowledge with spaced repetition</p>
      </div>

      {/* Create Deck Form */}
      <form onSubmit={handleCreateDeck} className="mb-10">
        <div className="flex gap-3 max-w-xl mx-auto">
          <input
            type="text"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            placeholder="New deck name..."
            className="flex-1 px-5 py-3.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          <button
            type="submit"
            disabled={!newDeckName.trim() || creating}
            className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25"
          >
            {creating ? 'Creating...' : 'Create Deck'}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-center">
          {error}
        </div>
      )}

      {/* Deck Grid */}
      {decks.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-300 mb-2">No decks yet</h3>
          <p className="text-slate-500">Create your first deck to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onStudy={onStudy}
              onManage={setManagingDeck}
              onDelete={handleDeleteDeck}
            />
          ))}
        </div>
      )}

      {/* Bulk Import Modal */}
      {managingDeck && (
        <BulkImportModal
          deck={managingDeck}
          onClose={() => setManagingDeck(null)}
          onImportComplete={handleImportComplete}
        />
      )}
    </div>
  );
}
