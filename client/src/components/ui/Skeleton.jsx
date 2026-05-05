export function Skeleton({ className = '' }) {
  return <div className={`skel ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="gc p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function TransactionSkeleton() {
  return (
    <div className="gc p-4 flex items-center gap-4">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

export function ChartSkeleton({ height = 200 }) {
  return <Skeleton className="w-full" style={{ height, borderRadius: '18px' }} />;
}
