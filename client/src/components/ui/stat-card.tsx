import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color?: "default" | "gold" | "orange" | "blue" | "green";
  className?: string;
}

export function StatCard({ label, value, icon, color = "default", className }: StatCardProps) {
  const colorStyles = {
    default: "text-foreground",
    gold: "text-primary",
    orange: "text-accent",
    blue: "text-blue-400",
    green: "text-emerald-400",
  };

  return (
    <div className={cn(
      "glass-card rounded-2xl p-6 flex flex-col gap-2 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-2xl hover:bg-card/90",
      className
    )}>
      <div className="text-2xl mb-1 opacity-80">{icon}</div>
      <div className={cn("text-3xl font-bold font-display tracking-tight", colorStyles[color])}>
        {value}
      </div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
        {label}
      </div>
    </div>
  );
}
