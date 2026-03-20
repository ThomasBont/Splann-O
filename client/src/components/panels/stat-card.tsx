import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  stat: string | React.ReactNode;
  description?: string;
  buttonLabel: string;
  onButtonClick: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function StatCard({
  icon,
  title,
  stat,
  description,
  buttonLabel,
  onButtonClick,
  children,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-background/50 p-4 space-y-3",
        className
      )}
    >
      {/* Header with icon and title */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>

      {/* Main stat */}
      <div>
        <p className="text-2xl font-bold text-foreground">{stat}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      {/* Custom content (avatars, list, etc.) */}
      {children && <div className="space-y-2">{children}</div>}

      {/* Action button */}
      <Button
        size="sm"
        variant="outline"
        className="w-full h-8 text-xs"
        onClick={onButtonClick}
      >
        {buttonLabel} →
      </Button>
    </div>
  );
}
