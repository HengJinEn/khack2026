'use client';

import { useState, useEffect } from 'react';

export interface QuizQuestion {
  id: string;
  videoUrl: string;
  videoId: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface QuizCardProps {
  questions: QuizQuestion[];
  currentPageIndex: number;
  onAnswer: (isCorrect: boolean) => void;
  onFlip: () => void;
  canFlip: boolean;
}

export default function QuizCard({
  questions,
  currentPageIndex,
  onAnswer,
  onFlip,
  canFlip,
}: QuizCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const currentQuestion = questions[currentPageIndex];

  useEffect(() => {
    // Reset state when moving to new question
    setSelectedAnswer(null);
    setAnswered(false);
    setIsCorrect(false);
  }, [currentPageIndex]);

  const handleAnswerSubmit = (optionIndex: number) => {
    if (answered) return;

    setSelectedAnswer(optionIndex);
    const correct = optionIndex === currentQuestion.correctAnswer;
    setIsCorrect(correct);
    setAnswered(true);
    onAnswer(correct);
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-8 p-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl shadow-2xl">

      {/* Quiz Section */}
      <div className="flex-1 flex flex-col justify-between">
        {/* Question */}
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-6">{currentQuestion.question}</h3>

          {/* Answer Options */}
          <div className="grid grid-cols-1 gap-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSubmit(index)}
                disabled={answered}
                className={`p-4 rounded-xl border-3 font-semibold text-left transition-all transform ${
                  selectedAnswer === index
                    ? isCorrect
                      ? 'border-green-500 bg-green-200 text-green-900 scale-105'
                      : 'border-red-500 bg-red-200 text-red-900 scale-105'
                    : answered && index === currentQuestion.correctAnswer
                    ? 'border-green-500 bg-green-100 text-green-800'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                } ${answered ? 'cursor-default' : 'hover:cursor-pointer hover:scale-102'}`}
              >
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full border-2 border-current mr-3 flex items-center justify-center">
                    {selectedAnswer === index && <div className="w-3 h-3 rounded-full bg-current" />}
                  </div>
                  {option}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Feedback and Action Buttons */}
        <div className="mt-8 pt-6 border-t-2 border-gray-300">
          {answered && (
            <div className="mb-4">
              {isCorrect ? (
                <div className="p-4 bg-green-100 border-2 border-green-500 rounded-lg">
                  <p className="text-green-800 font-bold text-lg">Correct! Great job!</p>
                </div>
              ) : (
                <div className="p-4 bg-red-100 border-2 border-red-500 rounded-lg">
                  <p className="text-red-800 font-bold text-lg">
                    Not quite right. The correct answer is: {currentQuestion.options[currentQuestion.correctAnswer]}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            {!answered ? (
              <button
                disabled
                className="flex-1 py-3 px-6 rounded-xl bg-gray-300 text-gray-600 font-bold cursor-not-allowed"
              >
                Answer a question to continue
              </button>
            ) : isCorrect ? (
              <button
                onClick={onFlip}
                disabled={!canFlip}
                className={`flex-1 py-3 px-6 rounded-xl font-bold text-lg transition-all transform ${
                  canFlip
                    ? 'border-2 border-blue-500 bg-blue-500 text-white hover:bg-blue-600 hover:scale-105 cursor-pointer'
                    : 'border-2 border-gray-400 bg-gray-300 text-gray-600 cursor-not-allowed'
                }`}
              >
                Flip
              </button>
            ) : (
              <button
                onClick={() => {
                  setSelectedAnswer(null);
                  setAnswered(false);
                }}
                className="flex-1 py-3 px-6 rounded-xl border-2 border-orange-500 bg-orange-500 text-white hover:bg-orange-600 font-bold text-lg transition-all transform hover:scale-105 cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
