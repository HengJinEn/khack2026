'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import HTMLFlipBook from 'react-pageflip';
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
  episodeId: string;
  onBack: () => void;
}

// Map API response scene to our internal Scene format
function mapApiSceneToScene(apiScene: Record<string, unknown>, index: number): Scene {
  return {
    id: String(apiScene.scene_number ?? index + 1),
    videoUrl: String(apiScene.video_url ?? ''),
    videoId: `scene${apiScene.scene_number ?? index + 1}`,
    dialogue: String(apiScene.dialogue ?? ''),
    interaction: Boolean(apiScene.interaction),
    question: apiScene.question ? String(apiScene.question) : undefined,
    options: Array.isArray(apiScene.options) ? (apiScene.options as string[]) : undefined,
    correctAnswer: typeof apiScene.correct_answer_index === 'number' ? apiScene.correct_answer_index : undefined,
  };
}

export default function StoryBook({ character, subject, episodeId, onBack }: StoryBookProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  // 'polling' = waiting for backend | 'buffering' = preloading videos | 'ready' = show storybook | 'error'
  const [loadPhase, setLoadPhase] = useState<'polling' | 'buffering' | 'ready' | 'error'>('polling');
  const [loadingMessage, setLoadingMessage] = useState('Creating your VidiBook...');
  const [bufferProgress, setBufferProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageFlips, setPageFlips] = useState<{ [key: number]: boolean }>({});
  const [videoFinished, setVideoFinished] = useState<{ [key: number]: boolean }>({});
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);



  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

  // Phase 1: Poll backend until episode is complete
  // Phase 2: Silently pre-buffer all videos into browser cache (no autoplay)
  // Phase 3: Open storybook — all videos ready, play one at a time
  useEffect(() => {
    if (!episodeId) {
      setErrorMessage('No episode ID provided.');
      setLoadPhase('error');
      return;
    }

    const generatingMessages = [
      'Creating your VidiBook...',
      'Writing the story scenes...',
      'Generating videos with Veo...',
      'Adding quiz interactions...',
      'Polishing the final episode...',
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % generatingMessages.length;
      setLoadingMessage(generatingMessages[msgIdx]);
    }, 7000);

    // Called once episode data is received — pre-buffers all video URLs silently
    const startBuffering = async (mapped: Scene[]) => {
      clearInterval(msgInterval);
      setLoadPhase('buffering');
      setLoadingMessage('Buffering your VidiBook...');

      const allUrls = mapped.map((sc) => sc.videoUrl).filter(Boolean) as string[];

      let done = 0;
      const total = allUrls.length;
      if (total === 0) { setScenes(mapped); setLoadPhase('ready'); return; }

      await Promise.allSettled(
        allUrls.map(
          (url) =>
            new Promise<void>((resolve) => {
              // Create a video element purely to cache the resource — never appended to DOM, never plays
              const v = document.createElement('video');
              v.preload = 'auto';
              v.muted = true;   // muted so browser allows preloading without user gesture
              v.src = url;
              const finish = () => {
                done++;
                setBufferProgress(Math.round((done / total) * 100));
                resolve();
              };
              v.oncanplaythrough = finish;
              v.onerror = finish;
              setTimeout(finish, 45_000); // safety cap — never block forever
            })
        )
      );

      setScenes(mapped);
      setLoadPhase('ready');
    };

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/episodes/${episodeId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'pending' || data.status === 'generating') return;

        clearInterval(pollInterval);

        if (data.status === 'failed') {
          clearInterval(msgInterval);
          setErrorMessage(data.error || 'Episode generation failed. Please try again.');
          setLoadPhase('error');
          return;
        }

        if (data.scenes && Array.isArray(data.scenes)) {
          if (data.title) setEpisodeTitle(data.title);
          const mapped = data.scenes.map((s: Record<string, unknown>, i: number) =>
            mapApiSceneToScene(s, i)
          );
          await startBuffering(mapped);
        }
      } catch (err) {
        console.error('[StoryBook] Polling error:', err);
      }
    }, 3000);

    // Kick off immediately in case episode is already done
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/episodes/${episodeId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'complete' && data.scenes) {
            clearInterval(pollInterval);
            if (data.title) setEpisodeTitle(data.title as string);
            const mapped = data.scenes.map((s: Record<string, unknown>, i: number) =>
              mapApiSceneToScene(s, i)
            );
            await startBuffering(mapped);
          }
        }
      } catch { }
    })();

    return () => {
      clearInterval(pollInterval);
      clearInterval(msgInterval);
    };
  }, [episodeId, API_BASE_URL]);

  // When page changes (after first scene), auto-play the next video
  useEffect(() => {
    if (hasStartedPlaying && currentPageIndex > 0) {
      // Small delay to let the new <video> element mount and begin loading its src
      const timer = setTimeout(() => {
        videoRef.current?.play().catch(() => { /* browser blocked — user will see paused video */ });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [currentPageIndex, hasStartedPlaying]);

  const handlePlayFirstScene = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play().then(() => {
        setHasStartedPlaying(true);
      }).catch(() => { /* ignore */ });
    }
  }, []);

  const currentScene = scenes[currentPageIndex];



  const handleAnswer = (isCorrect: boolean) => {
    if (!currentScene) return;
    if (isCorrect) {
      setPageFlips((prev) => ({ ...prev, [currentPageIndex]: true }));
    }
  };



  const handleFlip = () => {
    if (currentPageIndex < scenes.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    } else if (currentPageIndex === scenes.length - 1) {
      alert('🎉 Congratulations! You completed the VidiBook!');
      onBack();
    }
  };

  const canFlip = currentScene
    ? currentScene.interaction
      ? pageFlips[currentPageIndex] === true
      : videoFinished[currentPageIndex] === true
    : false;
  const isLastPage = currentPageIndex === scenes.length - 1;

  const leftVideoSrc = currentScene?.videoUrl ?? '';

  // --- Loading Screen (Polling or Buffering) ---
  if (loadPhase === 'polling' || loadPhase === 'buffering') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-200 via-purple-100 to-pink-100 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-8xl animate-bounce mb-8">📖</div>
          <div className="flex justify-center mb-6">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-purple-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">{loadingMessage}</h2>
          {loadPhase === 'buffering' ? (
            <div className="mt-4">
              <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${bufferProgress}%` }}
                />
              </div>
              <p className="text-gray-500 text-xs mt-2">{bufferProgress}% ready</p>
            </div>
          ) : (
            <p className="text-gray-600 text-sm">
              {character}'s adventure on <strong>{subject}</strong> is being created just for you!
              <br />
              This can take a few minutes while Veo generates the videos.
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Error Screen ---
  if (loadPhase === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-200 via-purple-100 to-pink-100 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 whitespace-pre-line">{errorMessage}</h2>
          <button
            onClick={onBack}
            className="px-8 py-3 rounded-2xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
          >
            ← Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!currentScene) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-200 via-purple-100 to-pink-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800">
              {episodeTitle
                ? episodeTitle.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
                : `${character}'s Learning Adventure`}
            </h1>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
          >
            Exit
          </button>
        </div>

        {/* Book Container */}
        <div className="relative bg-[#fdfaf1] rounded-lg shadow-2xl border-8 border-[#5d4037] min-h-[650px] flex">
          {/* LEFT PAGE: Video */}
          <div className="flex-1 p-10 flex flex-col justify-center border-r border-gray-300 shadow-[inset_-15px_0_20px_-5px_rgba(0,0,0,0.1)]">
            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg border-4 border-[#d7ccc8]">
              {leftVideoSrc ? (
                <>
                  <video
                    ref={videoRef}
                    key={leftVideoSrc}
                    src={leftVideoSrc}
                    onEnded={() => setVideoFinished((prev) => ({ ...prev, [currentPageIndex]: true }))}
                    className="w-full h-full object-cover"
                    playsInline
                  />
                  {/* Play button overlay for first scene */}
                  {currentPageIndex === 0 && !hasStartedPlaying && (
                    <button
                      onClick={handlePlayFirstScene}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors cursor-pointer z-10"
                    >
                      <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                        <svg className="w-10 h-10 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </button>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black text-white text-center p-4">
                  <div>
                    <p className="text-sm opacity-50 mb-1">Scene {currentScene.id}</p>
                    <p className="text-xs opacity-30">Video loading...</p>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />
            </div>


          </div>

          {/* THE SPINE */}
          <div className="w-6 bg-gradient-to-r from-gray-400/20 via-gray-100 to-gray-400/20 shadow-inner z-20" />

          {/* RIGHT PAGE: Narrative or Quiz */}
          <div
            className="flex-1 p-10 bg-white/40 shadow-[inset_15px_0_20px_-5px_rgba(0,0,0,0.1)] relative z-10"
          >
            {currentScene.interaction ? (
              <QuizCard
                scenes={scenes}
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
              Chapter {currentPageIndex + 1} of {scenes.length}
            </p>
            <p className="text-gray-600 text-sm">
              {currentPageIndex === 0 && !hasStartedPlaying
                ? 'Press play to start your adventure!'
                : isLastPage && canFlip
                  ? 'Final chapter — Complete to finish!'
                  : currentScene.interaction
                    ? 'Answer correctly to flip the page'
                    : videoFinished[currentPageIndex]
                      ? 'Read the story, then flip to the next page'
                      : 'Watch the video to continue...'}
            </p>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300"
              style={{ width: `${scenes.length ? ((currentPageIndex + 1) / scenes.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
