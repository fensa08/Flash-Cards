import { useState } from 'react';
import type { Deck } from './api/client';
import DeckList from './components/DeckList';
import StudySession from './components/StudySession';

function App() {
  const [studyingDeck, setStudyingDeck] = useState<Deck | null>(null);

  if (studyingDeck) {
    return (
      <StudySession
        deck={studyingDeck}
        onExit={() => setStudyingDeck(null)}
      />
    );
  }

  return <DeckList onStudy={setStudyingDeck} />;
}

export default App;
