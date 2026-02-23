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

const CHARACTERS = ['Cat', 'Dog', 'Panda', 'Bear', 'Bunny', 'Tapir', 'Fox', 'Sheep'];
const SUBJECTS = ['Math', 'Science', 'English', 'Moral'];

const CHARACTER_IMAGES: Record<string, any> = {
  Cat: CatImg,
  Dog: DogImg,
  Panda: PandaImg,
  Bear: BearImg,
  Bunny: BunnyImg,
  Tapir: TapirImg,
  Fox: FoxImg,
  Sheep: SheepImg,
};

export default function CharacterSelection({ onCreateStorybook }: CharacterSelectionProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
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
    if (!selectedCharacter || !selectedSubject) {
      alert('Please select both a character and a subject');
      return;
    }

    setIsLoading(true);
    // Simulate API call - replace with actual backend call later
    setTimeout(() => {
      onCreateStorybook(selectedCharacter, selectedSubject);
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-purple-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Step Indicator */}
        <div className="text-center mb-12">
          <p className="text-2xl font-bold text-gray-800">Step {step}/2</p>
          <div className="flex gap-4 justify-center mt-4">
            <div className={`h-2 w-24 rounded-full transition-all ${step >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`} />
            <div className={`h-2 w-24 rounded-full transition-all ${step >= 2 ? 'bg-blue-500' : 'bg-gray-300'}`} />
          </div>
        </div>

        {/* Step 1: Character Selection */}
        {step === 1 && (
          <div className="fade-in-up">
            <h2 className="text-4xl font-bold text-center mb-12 text-gray-800">Select Your Character</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {CHARACTERS.map((character) => (
                <button
                    key={character}
                    onClick={() => setSelectedCharacter(character)}
                    className={`group relative overflow-hidden aspect-square px-4 rounded-2xl border font-bold text-lg transition-all transform hover:scale-105 ${
                    selectedCharacter === character
                        ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-[#343B6E]'
                    }`}
                >
                    {/* The Background Image */}
                    <img 
                    src={CHARACTER_IMAGES[character].src} 
                    alt={character}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-40" 
                    />

                  <div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
                    <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent w-full pb-5 pt-16 px-2 text-center">
                      <span className="text-white text-xs font-black uppercase tracking-widest drop-shadow-md">
                        {character}
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
                className={`px-12 py-4 rounded-2xl border font-bold text-xl transition-all transform hover:scale-105 ${
                  !selectedCharacter
                    ? 'border-gray-400 bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
                }`}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Subject Selection */}
        {step === 2 && (
          <div className="fade-in-up">
            <h2 className="text-4xl font-bold text-center mb-12 text-gray-800">Select Your Subject</h2>
            <p className="text-center text-lg text-gray-600 mb-8">
              You selected: <span className="font-bold text-blue-600">{selectedCharacter}</span>
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {SUBJECTS.map((subject) => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={`py-8 px-4 rounded-2xl border font-bold text-lg transition-all transform hover:scale-105 ${
                    selectedSubject === subject
                      ? 'border-blue-500 bg-blue-200 text-blue-900 shadow-lg scale-105'
                      : 'border-gray-400 bg-white text-gray-700 hover:border-blue-300'
                  }`}
                >
                  {subject}
                </button>
              ))}
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
                disabled={!selectedSubject || isLoading}
                className={`flex-1 px-12 py-4 rounded-2xl border font-bold text-lg transition-all transform hover:scale-105 ml-4 ${
                  !selectedSubject || isLoading
                    ? 'border-gray-400 bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
                }`}
              >
                {isLoading ? 'Creating...' : 'Create StoryBook 🚀'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
