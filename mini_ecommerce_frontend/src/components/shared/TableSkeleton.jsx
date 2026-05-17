import { Skeleton } from '@/components/ui/skeleton'

export default function TableSkeleton({ cols = 4, rows = 6 }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/40 px-4 py-3 flex gap-4 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex gap-4 border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
