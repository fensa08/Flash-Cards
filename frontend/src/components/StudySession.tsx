import { useState, useEffect, useCallback } from 'react';
import type { Deck, Card, ResponseType } from '../api/client';
import { getNextCard, submitAnswer, resetDeckWeights } from '../api/client';
import FlashCard from './FlashCard';

interface StudySessionProps {
  deck: Deck;
  onExit: () => void;
}

export default function StudySession({ deck, onExit }: StudySessionProps) {
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [excludedIds, setExcludedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnswering, setIsAnswering] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [stats, setStats] = useState({ known: 0, uncertain: 0, dontKnow: 0 });
  const [error, setError] = useState<string | null>(null);

  const loadNextCard = useCallback(async (excluded: number[]) => {
    try {
      setLoading(true);
      setError(null);
      const response = await getNextCard(deck.id, excluded);
      
      if (response.card === null) {
        setSessionComplete(true);
        setCurrentCard(null);
      } else {
        setCurrentCard(response.card);
        setRemaining(response.remaining);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card');
    } finally {
      setLoading(false);
    }
  }, [deck.id]);

  useEffect(() => {
    loadNextCard([]);
  }, [loadNextCard]);

  const handleAnswer = async (response: ResponseType) => {
    if (!currentCard || isAnswering) return;

    setIsAnswering(true);
    try {
      const result = await submitAnswer(deck.id, currentCard.id, response);
      
      // Update stats
      setStats(prev => ({
        known: prev.known + (response === 'know' ? 1 : 0),
        uncertain: prev.uncertain + (response === 'uncertain' ? 1 : 0),
        dontKnow: prev.dontKnow + (response === 'dont_know' ? 1 : 0)
      }));

      // If user knows the card, exclude it from this session
      let newExcluded = excludedIds;
      if (result.exclude) {
        newExcluded = [...excludedIds, currentCard.id];
        setExcludedIds(newExcluded);
      }

      // Load next card
      await loadNextCard(newExcluded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setIsAnswering(false);
    }
  };

  const handleRestart = async () => {
    setExcludedIds([]);
    setSessionComplete(false);
    setStats({ known: 0, uncertain: 0, dontKnow: 0 });
    await loadNextCard([]);
  };

  const handleResetWeights = async () => {
    if (!confirm('Reset all card weights in this deck? This will reset the spaced repetition progress.')) return;
    
    try {
      await resetDeckWeights(deck.id);
      await handleRestart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset weights');
    }
  };

  // Session Complete Screen
  if (sessionComplete) {
    const total = stats.known + stats.uncertain + stats.dontKnow;
    
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg text-center">
          <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
            {/* Celebration Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h2 className="font-display text-3xl font-bold text-slate-100 mb-2">
              Session Complete!
            </h2>
            <p className="text-slate-400 mb-8">
              You've reviewed all cards in this session
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <p className="text-3xl font-bold text-emerald-400">{stats.known}</p>
                <p className="text-sm text-emerald-400/70">Knew</p>
              </div>
              <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <p className="text-3xl font-bold text-amber-400">{stats.uncertain}</p>
                <p className="text-sm text-amber-400/70">Uncertain</p>
              </div>
              <div className="p-4 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <p className="text-3xl font-bold text-rose-400">{stats.dontKnow}</p>
                <p className="text-sm text-rose-400/70">Didn't Know</p>
              </div>
            </div>

            {total > 0 && (
              <p className="text-slate-400 mb-8">
                Success rate: <span className="text-emerald-400 font-semibold">{Math.round((stats.known / total) * 100)}%</span>
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleRestart}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25"
              >
                Study Again
              </button>
              <button
                onClick={onExit}
                className="w-full py-3 bg-slate-700/80 hover:bg-slate-600/80 text-slate-200 font-semibold rounded-xl transition-all duration-200"
              >
                Back to Decks
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading && !currentCard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 font-medium">Loading card...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">Exit</span>
        </button>

        <div className="text-center">
          <h2 className="font-display text-xl font-semibold text-slate-200">{deck.name}</h2>
          <p className="text-sm text-slate-500">{remaining} cards remaining in session</p>
        </div>

        <button
          onClick={handleResetWeights}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          title="Reset card weights"
        >
          Reset
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-2xl mx-auto mb-8">
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${((stats.known + stats.uncertain + stats.dontKnow) / deck.card_count) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>{stats.known + stats.uncertain + stats.dontKnow} reviewed</span>
          <span>{deck.card_count} total</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="w-full max-w-2xl mx-auto mb-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-center">
          {error}
        </div>
      )}

      {/* Flash Card */}
      <div className="flex-1 flex items-center justify-center">
        {currentCard && (
          <FlashCard
            card={currentCard}
            onAnswer={handleAnswer}
            isAnswering={isAnswering}
          />
        )}
      </div>

      {/* Session Stats */}
      <div className="flex justify-center gap-6 mt-8">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm text-slate-400">Know: {stats.known}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm text-slate-400">Uncertain: {stats.uncertain}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500" />
          <span className="text-sm text-slate-400">Don't know: {stats.dontKnow}</span>
        </div>
      </div>
    </div>
  );
}

