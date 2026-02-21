'use client'

export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <style>{`
        @keyframes pulseBar {
          0% {
            transform: scaleX(0.2);
            opacity: 0.3;
          }
          50% {
            transform: scaleX(1);
            opacity: 1;
          }
          100% {
            transform: scaleX(0.2);
            opacity: 0.3;
          }
        }
        @keyframes drift {
          0% {
            transform: translateY(6px);
            opacity: 0.4;
          }
          100% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }
      `}</style>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-10 rounded-full bg-gray-800" style={{ animation: 'pulseBar 1.2s ease-in-out infinite' }} />
          <span className="h-2 w-6 rounded-full bg-gray-500" style={{ animation: 'pulseBar 1.2s ease-in-out infinite 0.2s' }} />
          <span className="h-2 w-4 rounded-full bg-gray-400" style={{ animation: 'pulseBar 1.2s ease-in-out infinite 0.4s' }} />
        </div>
        <p className="text-[12px] text-gray-500 tracking-[0.4em]" style={{ animation: 'drift 1.6s ease-in-out infinite' }}>
          LOADING
        </p>
      </div>
    </div>
  )
}
