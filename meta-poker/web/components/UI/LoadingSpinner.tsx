export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];
  return (
    <div className={`${sizeClass} border-2 border-[#F2A900] border-t-transparent rounded-full animate-spin`} />
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
