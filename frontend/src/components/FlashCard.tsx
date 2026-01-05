import type { Card, ResponseType } from '../api/client';

interface FlashCardProps {
  card: Card;
  onAnswer: (response: ResponseType) => void;
  isAnswering: boolean;
}

export default function FlashCard({ card, onAnswer, isAnswering }: FlashCardProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Card */}
      <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-slate-700/50 shadow-2xl shadow-black/20 min-h-[300px] flex flex-col">
        {/* Decorative elements */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-indigo-500/30 rounded-tl-lg" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-indigo-500/30 rounded-br-lg" />
        
        {/* Card Stats */}
        <div className="flex items-center gap-3 mb-6">
          <span className="px-3 py-1 bg-slate-700/50 rounded-full text-xs text-slate-400">
            Seen {card.times_seen} {card.times_seen === 1 ? 'time' : 'times'}
          </span>
          <span className="px-3 py-1 bg-indigo-500/20 rounded-full text-xs text-indigo-400">
            Weight: {card.weight}
          </span>
        </div>

        {/* Question */}
        <div className="flex-1 flex items-center justify-center">
          <p className="font-display text-2xl md:text-3xl text-center text-slate-100 leading-relaxed">
            {card.question}
          </p>
        </div>
      </div>

      {/* Answer Buttons */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <button
          onClick={() => onAnswer('dont_know')}
          disabled={isAnswering}
          className="group relative py-4 px-4 bg-gradient-to-br from-rose-600/90 to-rose-700/90 hover:from-rose-500 hover:to-rose-600 disabled:from-slate-700 disabled:to-slate-700 rounded-2xl transition-all duration-200 shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40 hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex flex-col items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-rose-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="font-semibold text-rose-100">Don't Know</span>
            <span className="text-xs text-rose-300/70">+3 weight</span>
          </div>
        </button>

        <button
          onClick={() => onAnswer('uncertain')}
          disabled={isAnswering}
          className="group relative py-4 px-4 bg-gradient-to-br from-amber-600/90 to-amber-700/90 hover:from-amber-500 hover:to-amber-600 disabled:from-slate-700 disabled:to-slate-700 rounded-2xl transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex flex-col items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold text-amber-100">Not Sure</span>
            <span className="text-xs text-amber-300/70">+1 weight</span>
          </div>
        </button>

        <button
          onClick={() => onAnswer('know')}
          disabled={isAnswering}
          className="group relative py-4 px-4 bg-gradient-to-br from-emerald-600/90 to-emerald-700/90 hover:from-emerald-500 hover:to-emerald-600 disabled:from-slate-700 disabled:to-slate-700 rounded-2xl transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex flex-col items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold text-emerald-100">I Know</span>
            <span className="text-xs text-emerald-300/70">Remove from session</span>
          </div>
        </button>
      </div>
    </div>
  );
}

