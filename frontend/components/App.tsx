'use client';

import { useState } from 'react';
import LandingPage from './LandingPage';
import CharacterSelection from './CharacterSelection';
import StoryBook from './StoryBook';

type AppState = 'landing' | 'selection' | 'storybook';

export default function App() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [episodeId, setEpisodeId] = useState<string>('');

  const handleGetStarted = () => {
    setAppState('selection');
  };

  const handleCreateStorybook = (character: string, subject: string, epId: string) => {
    setSelectedCharacter(character);
    setSelectedSubject(subject);
    setEpisodeId(epId);
    setAppState('storybook');
  };

  const handleBackToSelection = () => {
    setAppState('selection');
    setSelectedCharacter('');
    setSelectedSubject('');
    setEpisodeId('');
  };

  return (
    <>
      {appState === 'landing' && (
        <LandingPage onGetStarted={handleGetStarted} />
      )}
      {appState === 'selection' && (
        <CharacterSelection onCreateStorybook={handleCreateStorybook} />
      )}
      {appState === 'storybook' && (
        <StoryBook
          character={selectedCharacter}
          subject={selectedSubject}
          episodeId={episodeId}
          onBack={handleBackToSelection}
        />
      )}
    </>
  );
}
