'use client';

import { useState } from 'react';
import CatImg from '../assets/Cat.jpg';
import DogImg from '../assets/Dog.jpg';
import PandaImg from '../assets/Panda.jpg';
import BearImg from '../assets/Bear.jpg';
import BunnyImg from '../assets/Bunny.jpg';
import TapirImg from '../assets/Tapir.jpg';
import FoxImg from '../assets/Fox.jpg';
import SheepImg from '../assets/Sheep.png';

interface CharacterSelectionProps {
  onCreateStorybook: (character: string, subject: string) => void;
}

const CHARACTERS = [
  { id: 'Cat', name: 'Lumi', img: CatImg },
  { id: 'Dog', name: 'Coco', img: DogImg },
  { id: 'Panda', name: 'Mochi', img: PandaImg },
  { id: 'Bear', name: 'Bruno', img: BearImg },
  { id: 'Bunny', name: 'Bun Bun', img: BunnyImg },
  { id: 'Tapir', name: 'Tappy', img: TapirImg },
  { id: 'Fox', name: 'Foxy', img: FoxImg },
  { id: 'Sheep', name: 'Woolly', img: SheepImg },
];

const QUICK_TOPICS = [
  { label: 'How Plants Grow', color: 'bg-red-500' },
  { label: 'The Water Cycle', color: 'bg-blue-500' },
  { label: 'Pollination', color: 'bg-green-500' },
  { label: 'Animal Habitats', color: 'bg-purple-500' },
  { label: 'Life Cycles', color: 'bg-gray-500' },
  { label: 'Weather Wonders', color: 'bg-indigo-500' },
  { label: 'Seasons on Earth', color: 'bg-red-400' },
  { label: 'Food Chains', color: 'bg-green-600' },
  { label: 'Ocean Ecosystems', color: 'bg-blue-600' },
  { label: 'The Power of Sunlight', color: 'bg-teal-500' },
  { label: 'My Five Senses', color: 'bg-emerald-500' },
  { label: 'What Floats? What Sinks?', color: 'bg-cyan-600' },
  { label: 'Warm vs Cold', color: 'bg-rose-500' },
  { label: 'Day and Night', color: 'bg-amber-500' },
  { label: 'Rainy vs Sunny', color: 'bg-red-400' },
  { label: 'Wind at Work', color: 'bg-sky-500' },
  { label: 'Shadows and Light', color: 'bg-violet-500' },
  { label: 'Growing Things', color: 'bg-lime-600' },
  { label: 'Healthy Food Choices', color: 'bg-teal-600' },
  { label: 'Recycling Heroes', color: 'bg-blue-500' },
  { label: 'Saving Energy', color: 'bg-green-500' },
  { label: 'Growing a Garden', color: 'bg-emerald-600' },
  { label: 'Smart Shopping', color: 'bg-pink-500' },
  { label: 'Community Helpers', color: 'bg-blue-400' },
  { label: 'Safety Smarts', color: 'bg-green-400' },
  { label: 'Caring for the Earth', color: 'bg-teal-500' },
  { label: 'Fraction Fun', color: 'bg-rose-500' },
  { label: 'Shape Explorers', color: 'bg-red-500' },
  { label: 'Counting Adventures', color: 'bg-indigo-500' },
  { label: 'Symmetry Studio', color: 'bg-gray-500' },
  { label: 'Geometry Builders', color: 'bg-cyan-500' },
];

export default function CharacterSelection({ onCreateStorybook }: CharacterSelectionProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCharacter, setSelectedCharacter] = useState<typeof CHARACTERS[0] | null>(null);
  const [topicText, setTopicText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleNextStep = () => {
    if (selectedCharacter) {
      setStep(2);
    }
  };

  const handlePreviousStep = () => {
    setStep(1);
  };

  const handleCreateStorybook = async () => {
    if (!selectedCharacter || !topicText.trim()) {
      alert('Please select a character and enter a topic');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      onCreateStorybook(selectedCharacter.name, topicText.trim());
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-purple-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Step 1: Character Selection */}
        {step === 1 && (
          <div className="fade-in-up">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-800">Select Your Character</h2>
              <span className="text-gray-500 font-medium">Step 1 of 2</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {CHARACTERS.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharacter(char)}
                  className={`group relative overflow-hidden aspect-square px-4 rounded-2xl border font-bold text-lg transition-all transform hover:scale-105 ${selectedCharacter?.id === char.id
                    ? 'border-4 border-blue-800 bg-blue-50 shadow-lg scale-105'
                    : 'border-blue-100 bg-white text-slate-800 hover:border-blue-400'
                    }`}
                >
                  {/* The Background Image */}
                  <img
                    src={char.img.src}
                    alt={char.name}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-40"
                  />

                  <div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
                    <div className="bg-gradient-to-t from-blue-500/80 via-blue-500/40 to-transparent w-full pb-5 pt-16 px-2 text-center">
                      <span className="inline-block bg-blue-700 rounded-full px-4 py-2 text-white text-xs font-black drop-shadow-lg">
                        {char.name}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Next Button */}
            <div className="flex justify-center">
              <button
                onClick={handleNextStep}
                disabled={!selectedCharacter}
                className={`px-12 py-4 rounded-2xl border font-bold text-xl transition-all transform hover:scale-105 ${!selectedCharacter
                  ? 'border-gray-400 bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
                  }`}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Episode Topic Selection */}
        {step === 2 && (
          <div className="fade-in-up">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-800">Episode Setup</h2>
              <span className="text-gray-500 font-medium">Step 2 of 2</span>
            </div>

            {/* Topic Input */}
            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-800 mb-2">
                Episode Topic <span className="text-red-500">*</span>
              </label>
              <textarea
                value={topicText}
                onChange={(e) => setTopicText(e.target.value)}
                placeholder="e.g. All about healthy foods and vegetables"
                className="w-full p-4 rounded-xl border-2 border-gray-300 bg-white text-gray-800 text-base resize-none focus:outline-none focus:border-blue-500 transition-colors"
                rows={3}
              />
            </div>

            {/* Quick Select Topics */}
            <div className="mb-8">
              <p className="text-lg font-bold text-gray-800 mb-4">Quick Select Topics</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_TOPICS.map((topic) => (
                  <button
                    key={topic.label}
                    onClick={() => setTopicText(topic.label)}
                    className={`${topic.color} text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-80 transition-all transform hover:scale-105 cursor-pointer shadow-sm`}
                  >
                    {topic.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between gap-4">
              <button
                onClick={handlePreviousStep}
                className="px-8 py-4 rounded-2xl border border-gray-500 bg-gray-400 text-gray-900 font-bold text-lg transition-all transform hover:scale-105 hover:bg-gray-500 shadow-lg"
              >
                ← Back
              </button>

              <button
                onClick={handleCreateStorybook}
                disabled={!topicText.trim() || isLoading}
                className={`flex-1 px-12 py-4 rounded-2xl border font-bold text-lg transition-all transform hover:scale-105 ml-4 ${!topicText.trim() || isLoading
                  ? 'border-gray-400 bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
                  }`}
              >
                {isLoading ? 'Creating...' : 'Generate VidiBook'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
