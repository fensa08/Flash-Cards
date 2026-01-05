import type { Deck } from '../api/client';

interface DeckCardProps {
  deck: Deck;
  onStudy: (deck: Deck) => void;
  onManage: (deck: Deck) => void;
  onDelete: (deck: Deck) => void;
}

export default function DeckCard({ deck, onStudy, onManage, onDelete }: DeckCardProps) {
  return (
    <div className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10">
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-display text-xl font-semibold text-slate-100 truncate pr-4">
            {deck.name}
          </h3>
          <button
            onClick={() => onDelete(deck)}
            className="text-slate-500 hover:text-rose-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
            title="Delete deck"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
            <span className="text-sm font-medium text-slate-300">
              {deck.card_count} {deck.card_count === 1 ? 'card' : 'cards'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onStudy(deck)}
            disabled={deck.card_count === 0}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
          >
            Study
          </button>
          <button
            onClick={() => onManage(deck)}
            className="py-2.5 px-4 bg-slate-700/80 hover:bg-slate-600/80 text-slate-200 font-medium rounded-xl transition-all duration-200"
          >
            Manage
          </button>
        </div>
      </div>
    </div>
  );
}
