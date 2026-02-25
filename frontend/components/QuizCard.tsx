'use client';

import { useState, useEffect } from 'react';
import type { Scene } from './StoryBook';

interface QuizCardProps {
  scenes: Scene[];
  currentPageIndex: number;
  character: string;
  onAnswer: (isCorrect: boolean) => void;
  onFlip: () => void;
  canFlip: boolean;
  isLastPage: boolean;
}

export default function QuizCard({
  scenes,
  currentPageIndex,
  character,
  onAnswer,
  onFlip,
  canFlip,
  isLastPage,
}: QuizCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const currentScene = scenes[currentPageIndex];

  useEffect(() => {
    setSelectedAnswer(null);
    setAnswered(false);
    setIsCorrect(false);
  }, [currentPageIndex]);

  const handleAnswerSubmit = (optionIndex: number) => {
    if (answered) return;

    setSelectedAnswer(optionIndex);
    const correct = optionIndex === currentScene.correctAnswer;
    setIsCorrect(correct);
    setAnswered(true);
    onAnswer(correct);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between">
      {/* Audio Script — same style as NarrativePanel */}
      <div>
        <div className="relative">
          <span className="absolute -top-4 -left-2 text-6xl text-amber-300/40 font-serif leading-none select-none">"</span>
          <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/60 rounded-2xl p-6 border border-amber-200/50 shadow-inner">
            <p className="text-lg leading-relaxed text-[#3e2723] font-medium italic narrative-fade-in">
              {currentScene.dialogue}
            </p>
          </div>
          <span className="absolute -bottom-6 right-2 text-6xl text-amber-300/40 font-serif leading-none select-none rotate-180">"</span>
        </div>

        {/* Narrator label */}
        <div className="mt-8 flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
          <span className="text-sm font-semibold text-amber-600/80 tracking-wider uppercase">
            — {character}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
        </div>
      </div>

      {/* Quiz Section */}
      <div className="mt-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">{currentScene.question}</h3>

        {/* 2x2 Answer Grid */}
        <div className="grid grid-cols-2 gap-2">
          {currentScene.options?.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSubmit(index)}
              disabled={answered}
              className={`p-3 rounded-xl border-2 font-semibold text-sm text-left transition-all transform ${selectedAnswer === index
                ? isCorrect
                  ? 'border-green-500 bg-green-200 text-green-900 scale-105'
                  : 'border-red-500 bg-red-200 text-red-900 scale-105'
                : answered && index === currentScene.correctAnswer
                  ? 'border-green-500 bg-green-100 text-green-800'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                } ${answered ? 'cursor-default' : 'hover:cursor-pointer hover:scale-102'}`}
            >
              <div className="flex items-center">
                <div className="w-5 h-5 rounded-full border-2 border-current mr-2 flex items-center justify-center flex-shrink-0">
                  {selectedAnswer === index && <div className="w-2.5 h-2.5 rounded-full bg-current" />}
                </div>
                {option}
              </div>
            </button>
          ))}
        </div>

        {/* Feedback */}
        {answered && (
          <div className="mt-3">
            {isCorrect ? (
              <div className="p-3 bg-green-100 border-2 border-green-500 rounded-lg">
                <p className="text-green-800 font-bold">✅ Correct! Great job!</p>
              </div>
            ) : (
              <div className="p-3 bg-red-100 border-2 border-red-500 rounded-lg">
                <p className="text-red-800 font-bold text-sm">
                  Not quite right. The correct answer is: {currentScene.options?.[currentScene.correctAnswer ?? 0]}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-4 pt-4 border-t-2 border-gray-200">
        {!answered ? (
          <button
            disabled
            className="w-full py-3 px-6 rounded-xl bg-gray-300 text-gray-500 font-bold cursor-not-allowed"
          >
            Answer a question to continue
          </button>
        ) : isCorrect ? (
          <button
            onClick={onFlip}
            disabled={!canFlip}
            className={`w-full py-3 px-6 rounded-xl font-bold text-lg transition-all transform ${canFlip
              ? isLastPage
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:scale-[1.02] shadow-lg cursor-pointer'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 hover:scale-[1.02] shadow-lg cursor-pointer'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            {isLastPage ? '✨ Complete Story!' : 'Next Page →'}
          </button>
        ) : (
          <button
            onClick={() => {
              setSelectedAnswer(null);
              setAnswered(false);
            }}
            className="w-full py-3 px-6 rounded-xl border-2 border-orange-500 bg-orange-500 text-white hover:bg-orange-600 font-bold text-lg transition-all transform hover:scale-[1.02] cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
