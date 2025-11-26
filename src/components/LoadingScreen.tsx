import React from 'react';

interface LoadingScreenProps {
  message: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-3xl transition-all duration-700 animate-in fade-in">
      {/* Flowing Background Effect */}
      <div className="absolute inset-0 overflow-hidden opacity-40 pointer-events-none">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(255,255,255,0.1)_360deg)] animate-spin-slow opacity-30 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[100px] animate-blob" />
        <div className="absolute bottom-1/3 right-1/3 w-[300px] h-[300px] bg-cyan-500/20 rounded-full blur-[80px] animate-blob animation-delay-2000" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-12">
        {/* Logo / Icon Animation */}
        <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Outer rings */}
            <div className="absolute inset-0 border-t border-l border-white/20 rounded-full animate-spin-slow" />
            <div className="absolute inset-4 border-r border-b border-white/10 rounded-full animate-spin-reverse-slower" />
            
            {/* Center glowing orb */}
            <div className="w-20 h-20 bg-white/5 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.15)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 opacity-50 animate-pulse" />
                <div className="w-10 h-10 bg-white/90 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.5)] animate-pulse-fast z-10" />
            </div>
        </div>
        
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-4xl font-thin text-white tracking-[0.3em] uppercase animate-fade-up drop-shadow-lg">
            Glass Explorer
          </h1>
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-white/50 font-light tracking-[0.2em] uppercase animate-pulse">
              {message || 'LOADING...'}
            </p>
            {/* Subtle progress bar */}
            <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-white/50 w-1/3 animate-progress-indeterminate rounded-full" />
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 10s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animate-spin-slow {
          animation: spin 15s linear infinite;
        }
        .animate-spin-reverse-slower {
          animation: spin 20s linear infinite reverse;
        }
        .animate-pulse-slow {
            animation: pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-pulse-fast {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes fade-up {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
            animation: fade-up 0.5s ease-out forwards;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes progress-indeterminate {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
        }
        .animate-progress-indeterminate {
            animation: progress-indeterminate 2s infinite linear;
        }
      `}</style>
    </div>
  );
};
