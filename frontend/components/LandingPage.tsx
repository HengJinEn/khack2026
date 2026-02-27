'use client';

import Image from 'next/image';
import Logo from '../assets/Logo.png';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="landing-root">
      <div className="landing-content">
        {/* Logo */}
        <div className="logo-wrapper">
          <Image
            src={Logo}
            alt="App Logo"
            className="landing-logo"
            priority
          />
        </div>

        {/* Description */}
        <p className="landing-desc">
          AI-Native Edutainment: Kids &amp; Parents co-create deeply personalized interactive experiences.
        </p>

        {/* CTA Button */}
        <button className="get-started-btn" onClick={onGetStarted}>
          <span className="btn-text">Get Started</span>
          <span className="btn-arrow">→</span>
        </button>
      </div>

      <style>{`
        .landing-root {
          min-height: 100vh;
          background: linear-gradient(to bottom, #dbeafe, #e9d5ff);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }

        /* Center content card */
        .landing-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          text-align: center;
          padding: 3rem 2.5rem;
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 2rem;
          box-shadow: 0 16px 48px rgba(99, 102, 241, 0.15), 0 2px 8px rgba(0,0,0,0.06);
          max-width: 680px;
          width: 90%;
          animation: contentAppear 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes contentAppear {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Logo */
        .logo-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          animation: logoAppear 1s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
        }
        @keyframes logoAppear {
          from { opacity: 0; transform: scale(0.85) translateY(-12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .landing-logo {
          width: clamp(220px, 55vw, 420px) !important;
          height: auto !important;
          object-fit: contain;
          filter: drop-shadow(0 6px 20px rgba(99, 102, 241, 0.2));
        }

        /* Description */
        .landing-desc {
          font-size: clamp(1rem, 2.5vw, 1.2rem);
          color: #374151;
          max-width: 520px;
          line-height: 1.75;
          letter-spacing: 0.01em;
          margin: 0;
          font-weight: 500;
          animation: fadeSlideUp 0.8s ease 0.3s both;
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* CTA button — matches blue buttons in CharacterSelection */
        .get-started-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 1rem 2.8rem;
          border: 2px solid #3b82f6;
          border-radius: 1rem;
          background: #3b82f6;
          color: #fff;
          font-size: 1.2rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          animation: fadeSlideUp 0.8s ease 0.5s both;
        }
        .get-started-btn:hover {
          transform: translateY(-3px) scale(1.05);
          background: #2563eb;
          border-color: #2563eb;
          box-shadow: 0 8px 28px rgba(59, 130, 246, 0.5);
        }
        .get-started-btn:active {
          transform: translateY(0) scale(0.98);
        }
        .btn-arrow {
          font-size: 1.3rem;
          transition: transform 0.2s ease;
        }
        .get-started-btn:hover .btn-arrow {
          transform: translateX(4px);
        }
      `}</style>
    </div>
  );
}
