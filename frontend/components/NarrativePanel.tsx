'use client';

import type { Scene } from './StoryBook';


interface NarrativePanelProps {
    scene: Scene;
    character: string;
    onFlip: () => void;
    canFlip: boolean;
    isLastPage: boolean;
}


export default function NarrativePanel({
    scene,
    character,
    onFlip,
    canFlip,
    isLastPage,
}: NarrativePanelProps) {
    return (
        <div className="w-full h-full flex flex-col justify-between">
            {/* Narration Header */}
            <div>
                {/* Dialogue / Audio Script */}
                <div className="relative">
                    {/* Decorative quote mark */}
                    <span className="absolute -top-4 -left-2 text-6xl text-amber-300/40 font-serif leading-none select-none">"</span>

                    <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/60 rounded-2xl p-8 border border-amber-200/50 shadow-inner">
                        <p className="text-xl leading-relaxed text-[#3e2723] font-medium italic narrative-fade-in">
                            {scene.dialogue}
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

            {/* Action Button */}
            <div className="mt-8 pt-6 border-t-2 border-gray-200">
                <button
                    onClick={onFlip}
                    disabled={!canFlip}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all transform ${canFlip
                        ? isLastPage
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:scale-[1.02] shadow-lg cursor-pointer'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 hover:scale-[1.02] shadow-lg cursor-pointer'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                >
                    {isLastPage ? '✨ Complete Story!' : 'Next Page →'}
                </button>
            </div>
        </div>
    );
}
