'use client';

import { useState } from 'react';
import QuizCard from './QuizCard';
import NarrativePanel from './NarrativePanel';

export interface Scene {
  id: string;
  videoUrl: string;
  videoId: string;
  dialogue: string;
  interaction: boolean;
  question?: string;
  options?: string[];
  correctAnswer?: number;
}

interface StoryBookProps {
  character: string;
  subject: string;
  onBack: () => void;
}

export default function StoryBook({ character, subject, onBack }: StoryBookProps) {
  // Mock scene data - replace with API call to backend later
  // Scenes 1,3,5,7,8 = non-interactive (dialogue only)
  // Scenes 2,4,6 = interactive (dialogue + quiz)
  const mockScenes: Scene[] = [
    {
      id: '1',
      videoUrl: '',
      videoId: 'scene1_intro',
      dialogue: 'Oh no… this little plant is tired. Have you ever wondered how plants make their food?',
      interaction: false,
    },
    {
      id: '2',
      videoUrl: '',
      videoId: 'scene2_quiz',
      dialogue: 'Plants need three things to make their food. Do you remember what sunlight does?',
      interaction: true,
      question: 'What does sunlight help plants do?',
      options: ['Make food', 'Take a nap', 'Hide from bugs', 'Drink water'],
      correctAnswer: 0,
    },
    {
      id: '3',
      videoUrl: '',
      videoId: 'scene3_deepen',
      dialogue: 'That\'s right! Sunlight gives plants energy. But they also need water from the soil and air from around them.',
      interaction: false,
    },
    {
      id: '4',
      videoUrl: '',
      videoId: 'scene4_quiz',
      dialogue: 'Plants drink water through their roots. Where do plant roots grow?',
      interaction: true,
      question: 'Where do plant roots grow?',
      options: ['In the sky', 'In the soil', 'On the leaves', 'Inside flowers'],
      correctAnswer: 1,
    },
    {
      id: '5',
      videoUrl: '',
      videoId: 'scene5_expand',
      dialogue: 'Plants also breathe in a special gas called carbon dioxide from the air. They use it along with water and sunlight!',
      interaction: false,
    },
    {
      id: '6',
      videoUrl: '',
      videoId: 'scene6_quiz',
      dialogue: 'When plants make food, they release something wonderful into the air for us to breathe!',
      interaction: true,
      question: 'What do plants release into the air?',
      options: ['Smoke', 'Oxygen', 'Dust', 'Water'],
      correctAnswer: 1,
    },
    {
      id: '7',
      videoUrl: '',
      videoId: 'scene7_realworld',
      dialogue: 'That\'s why trees and plants are so important! They give us the oxygen we need to breathe every day.',
      interaction: false,
    },
    {
      id: '8',
      videoUrl: '',
      videoId: 'scene8_celebrate',
      dialogue: 'Amazing job! You learned that plants use sunlight, water, and carbon dioxide to make food — and they share oxygen with us! 🌿',
      interaction: false,
    },
  ];

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageFlips, setPageFlips] = useState<{ [key: number]: boolean }>({});
  const [isFlipping, setIsFlipping] = useState(false);

  const currentScene = mockScenes[currentPageIndex];

  // Sound effect for page flip
  const playFlipSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;

      // Create oscillator for flip sound
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.connect(gain);
      gain.connect(audioContext.destination);

      // Flip sound: decreasing pitch (whoosh effect)
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.type = 'sine';
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (error) {
      // Silently fail if audio API is not available
      console.log('Audio context not available');
    }
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (isCorrect) {
      setPageFlips((prev) => ({
        ...prev,
        [currentPageIndex]: true,
      }));
    }
  };

  const handleFlip = () => {
    if (currentPageIndex < mockScenes.length - 1 && !isFlipping) {
      playFlipSound();
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPageIndex(currentPageIndex + 1);
        setIsFlipping(false);
      }, 800);
    } else if (currentPageIndex === mockScenes.length - 1) {
      // Storybook complete
      handleComplete();
    }
  };

  const handleComplete = () => {
    alert('Congratulations! You completed the story!');
    onBack();
  };

  // Non-interactive scenes can always flip; interactive scenes require correct answer
  const canFlip = !currentScene.interaction || pageFlips[currentPageIndex] === true;
  const isLastPage = currentPageIndex === mockScenes.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-200 via-purple-100 to-pink-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800">
              {character}'s Learning Adventure
            </h1>
            <p className="text-xl text-gray-600 mt-2">Subject: {subject}</p>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
          >
            Exit
          </button>
        </div>

        {/* Book Container with Flip Animation */}

        <div className="relative bg-[#fdfaf1] rounded-lg shadow-2xl border-8 border-[#5d4037] min-h-[650px] flex">
          <div className="flex-1 p-10 flex flex-col justify-center border-r border-gray-300 shadow-[inset_-15px_0_20px_-5px_rgba(0,0,0,0.1)]">
            {/* Video Frame */}
            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg border-4 border-[#d7ccc8]">
              {currentScene.videoUrl ? (
                <video
                  key={currentScene.id}
                  src={currentScene.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black text-white text-center p-4">
                  <div>
                    <p className="text-sm opacity-50 mb-1">Illustration for Video ID:</p>
                    <code className="text-xs">{currentScene.videoId}</code>
                  </div>
                </div>
              )}
              {/* Subtle page fold shadow over the video */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />
            </div>
          </div>
          {/* THE SPINE */}
          <div className="w-6 bg-gradient-to-r from-gray-400/20 via-gray-100 to-gray-400/20 shadow-inner z-20" />

          {/* RIGHT PAGE: Conditionally render based on scene type */}
          <div className={`flex-1 p-10 bg-white/40 shadow-[inset_15px_0_20px_-5px_rgba(0,0,0,0.1)] relative z-10 ${isFlipping ? 'page-flip-out' : 'page-flip-in'
            }`}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {currentScene.interaction ? (
              <QuizCard
                scenes={mockScenes}
                currentPageIndex={currentPageIndex}
                character={character}
                onAnswer={handleAnswer}
                onFlip={handleFlip}
                canFlip={canFlip}
                isLastPage={isLastPage}
              />
            ) : (
              <NarrativePanel
                scene={currentScene}
                chapterNumber={currentPageIndex + 1}
                character={character}
                onFlip={handleFlip}
                canFlip={canFlip}
                isLastPage={isLastPage}
              />
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-700 font-semibold">
              Chapter {currentPageIndex + 1} of {mockScenes.length}
            </p>
            <p className="text-gray-600 text-sm">
              {isLastPage && canFlip
                ? 'Final chapter - Complete to finish!'
                : currentScene.interaction
                  ? 'Answer correctly to flip the page'
                  : 'Read the story, then flip to the next page'}
            </p>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300"
              style={{
                width: `${((currentPageIndex + 1) / mockScenes.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
