import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-4 rounded-md ${className}`.trim()} />;
}

export function SkeletonAvatar({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-10 w-10 rounded-full ${className}`.trim()} />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-24 w-full rounded-xl ${className}`.trim()} />;
}

export function InlineQueryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-destructive">{message}</p>
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
