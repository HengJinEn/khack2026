'use client';

import { useState } from 'react';
import CharacterSelection from './CharacterSelection';
import StoryBook from './StoryBook';

type AppState = 'selection' | 'storybook';

export default function App() {
  const [appState, setAppState] = useState<AppState>('selection');
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  const handleCreateStorybook = (character: string, subject: string) => {
    setSelectedCharacter(character);
    setSelectedSubject(subject);
    setAppState('storybook');
  };

  const handleBackToSelection = () => {
    setAppState('selection');
    setSelectedCharacter('');
    setSelectedSubject('');
  };

  return (
    <>
      {appState === 'selection' ? (
        <CharacterSelection onCreateStorybook={handleCreateStorybook} />
      ) : (
        <StoryBook
          character={selectedCharacter}
          subject={selectedSubject}
          onBack={handleBackToSelection}
        />
      )}
    </>
  );
}
