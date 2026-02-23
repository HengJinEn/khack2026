'use client';

import { useState } from 'react';
import QuizCard, { QuizQuestion } from './QuizCard';

interface StoryBookProps {
  character: string;
  subject: string;
  onBack: () => void;
}

export default function StoryBook({ character, subject, onBack }: StoryBookProps) {
  // Mock questions data - replace with API call to backend later
  const mockQuestions: QuizQuestion[] = [
    {
      id: '1',
      videoUrl: '',
      videoId: 'hiswehbvbhwrvbiwbvwnVWV',
      question: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: 1,
    },
    {
      id: '2',
      videoUrl: '',
      videoId: 'JHBvivbwIV',
      question: 'What is the capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 2,
    },
    {
      id: '3',
      videoUrl: '',
      videoId: 'hiswehbvbhwrvbiwbvwnVWV',
      question: 'What is the square root of 16?',
      options: ['2', '3', '4', '5'],
      correctAnswer: 2,
    },
    {
      id: '4',
      videoUrl: '',
      videoId: 'JHBvivbwIV',
      question: 'Which planet is closest to the Sun?',
      options: ['Venus', 'Mercury', 'Mars', 'Earth'],
      correctAnswer: 1,
    },
    {
      id: '5',
      videoUrl: '',
      videoId: 'hiswehbvbhwrvbiwbvwnVWV',
      question: 'What is 5 × 6?',
      options: ['25', '30', '35', '40'],
      correctAnswer: 1,
    },
    {
      id: '6',
      videoUrl: '',
      videoId: 'JHBvivbwIV',
      question: 'What does HTML stand for?',
      options: ['Hyper Text Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language', 'Hyperlinks and Text Markup Language'],
      correctAnswer: 0,
    },
    {
      id: '7',
      videoUrl: '',
      videoId: 'hiswehbvbhwrvbiwbvwnVWV',
      question: 'What is the chemical symbol for Gold?',
      options: ['Go', 'Gd', 'Au', 'Ag'],
      correctAnswer: 2,
    },
    {
      id: '8',
      videoUrl: '',
      videoId: 'JHBvivbwIV',
      question: 'What year did World War II end?',
      options: ['1943', '1944', '1945', '1946'],
      correctAnswer: 2,
    },
  ];

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageFlips, setPageFlips] = useState<{ [key: number]: boolean }>({});
  const [isFlipping, setIsFlipping] = useState(false);

  const currentQuestion = mockQuestions[currentPageIndex];

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
    if (currentPageIndex < mockQuestions.length - 1 && !isFlipping) {
      playFlipSound();
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPageIndex(currentPageIndex + 1);
        setIsFlipping(false);
      }, 800);
    } else if (currentPageIndex === mockQuestions.length - 1) {
      // Storybook complete
      handleComplete();
    }
  };

  const handleComplete = () => {
    alert('Congratulations! You completed the story!');
    onBack();
  };

  const canFlip = pageFlips[currentPageIndex] === true;
  const isLastPage = currentPageIndex === mockQuestions.length - 1;

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
            <div className="flex-1 p-10 flex flex-col border-r border-gray-300 shadow-[inset_-15px_0_20px_-5px_rgba(0,0,0,0.1)]">
             <h2 className="text-2xl font-bold text-[#3e2723] mb-6 opacity-60 italic">
                {character}'s Adventure: Chapter {currentPageIndex + 1}
             </h2>
             
             {/* Video Frame */}
             <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg border-4 border-[#d7ccc8]">
                {currentQuestion.videoUrl ? (
                  <video 
                    key={currentQuestion.id} // Forces video to reload on new page
                    src={currentQuestion.videoUrl} 
                    controls 
                    autoPlay 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black text-white text-center p-4">
                    <div>
                        <p className="text-sm opacity-50 mb-1">Illustration for Video ID:</p>
                        <code className="text-xs">{currentQuestion.videoId}</code>
                    </div>
                  </div>
                )}
                {/* Subtle page fold shadow over the video */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />
             </div>
            </div>
            {/* THE SPINE */}
            <div className="w-6 bg-gradient-to-r from-gray-400/20 via-gray-100 to-gray-400/20 shadow-inner z-20" />

            {/* 2. RIGHT PAGE: Update z-index and styles */}
            <div className={`flex-1 p-10 bg-white/40 shadow-[inset_15px_0_20px_-5px_rgba(0,0,0,0.1)] relative z-10 ${
                isFlipping ? 'page-flip-out' : 'page-flip-in'
            }`}
            style={{ transformStyle: 'preserve-3d' }} // Required for 3D rotations
            >
                <QuizCard
                    questions={mockQuestions}
                    currentPageIndex={currentPageIndex}
                    onAnswer={handleAnswer}
                    onFlip={handleFlip}
                    canFlip={canFlip}
                />
            </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-700 font-semibold">
              Chapter {currentPageIndex + 1} of {mockQuestions.length}
            </p>
            <p className="text-gray-600 text-sm">
              {isLastPage && canFlip ? 'Final chapter - Complete to finish!' : 'Answer correctly to flip the page'}
            </p>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300"
              style={{
                width: `${((currentPageIndex + 1) / mockQuestions.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
