# AI Learning StoryBook - Frontend

An immersive interactive learning platform using AI-generated animated content. Students learn through character-guided stories with embedded quizzes.

## Features Implemented

### 1. **Character Selection Screen**
- Select from 4 characters: Cat, Dog, Panda, Poney
- Select from 5 subjects: Math, Science, English, Moral
- Beautiful UI with hover effects and selection feedback
- Gradient background with intuitive design

### 2. **Interactive StoryBook Viewer**
- Book-like interface with page progression
- Video player for each scene (prepared for Veo3-generated 8-second clips)
- Multiple-choice quiz questions per page
- Progress bar showing chapter completion

### 3. **Quiz Card Component**
- Left side: Video player with scene ID
- Right side: Question with 4 answer options
- **Correct Answer**: Shows "Flip" button to proceed to next page
- **Wrong Answer**: Shows "Retry" button to try again
- Visual feedback with color-coded responses
- Shows correct answer on wrong attempt
- Disabled state when unanswered

### 4. **Page Flip Animation**
- Smooth transition between pages
- Scale and opacity animation during flip
- Progress tracking (e.g., "Chapter 3 of 8")

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx                # Main page
│   ├── layout.tsx              # Root layout with metadata
│   └── globals.css             # Global styles
├── components/
│   ├── App.tsx                 # Main app state manager
│   ├── CharacterSelection.tsx  # Character/Subject selection page
│   ├── StoryBook.tsx           # Book viewer with page management
│   └── QuizCard.tsx            # Video + quiz card component
├── package.json                # Dependencies
└── tsconfig.json               # TypeScript config
```

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Backend Integration Points (TODO)

### 1. **Generate StoryBook Endpoint**
```
POST /api/storybook/generate
Request:
{
  character: string,
  subject: string
}

Response:
{
  pages: QuizQuestion[]
}
```

### 2. **Video Generation (Veo3)**
- Each page needs 8-second video clip
- Video URL should be placed in `QuizQuestion.videoUrl`
- Fallback: Display `videoId` (for debugging)
- Total: 8 scenes per storybook

### 3. **Metrics/Analytics** (Optional)
```
POST /api/analytics/track
{
  character: string,
  subject: string,
  pageIndex: number,
  answered: boolean,
  isCorrect: boolean,
  timestamp: number
}
```

## Component API Reference

### CharacterSelection
```typescript
<CharacterSelection 
  onCreateStorybook={(character, subject) => {}}
/>
```

### StoryBook
```typescript
<StoryBook 
  character="Cat"
  subject="Math"
  onBack={() => {}}
/>
```

### QuizCard
```typescript
<QuizCard
  questions={QuizQuestion[]}
  currentPageIndex={0}
  onAnswer={(isCorrect) => {}}
  onFlip={() => {}}
  canFlip={boolean}
/>
```

### QuizQuestion Interface
```typescript
interface QuizQuestion {
  id: string;
  videoUrl: string;        // From Veo3
  videoId: string;         // For debugging/reference
  question: string;        // AI-generated question
  options: string[];       // 4 answer options
  correctAnswer: number;   // Index of correct option (0-3)
}
```

## Next Steps

1. **Connect to Backend API**
   - Replace mock data in StoryBook.tsx with API call
   - Implement error handling and loading states

2. **Integrate Veo3 Videos**
   - Request video generation from backend
   - Display actual video URLs in QuizCard
   - Handle video loading and playback

3. **Add More Features**
   - Sound/voice for narrator
   - Character animations and transitions
   - Achievement/badge system
   - Leaderboard
   - Multiple difficulty levels

4. **Performance Optimization**
   - Video lazy loading
   - Page pre-loading
   - Image optimization
   - Caching strategies

## Tech Stack

- **Framework**: Next.js 16.1.6
- **React**: 19.2.3
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript 5

## Commands

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
```

## Notes for Backend Integration

The frontend is structured to make backend integration seamless:

1. MockData in `StoryBook.tsx` can be replaced with async API calls
2. All components are properly typed for type safety
3. Error handling infrastructure is ready for API failures
4. Loading states are prepared for async operations

Update the `handleCreateStorybook` function in `StoryBook.tsx` to fetch from your backend instead of using mock data.
