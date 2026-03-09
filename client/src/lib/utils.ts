import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function circularActionButtonClass(active = false) {
  return cn(
    "rounded-full border border-primary/80 bg-background/85 text-muted-foreground shadow-sm transition-all duration-150 ease-out hover:border-primary hover:bg-primary hover:text-slate-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-primary/75 dark:bg-background/80 dark:text-neutral-200 dark:hover:border-primary dark:hover:bg-primary dark:hover:text-slate-900",
    active && "border-primary bg-primary text-slate-900 dark:border-primary dark:bg-primary dark:text-slate-900",
  )
}

export function splannoOutlinePillClass() {
  return cn(
    "rounded-full border border-primary/80 bg-background/85 text-foreground shadow-sm transition-all duration-150 ease-out hover:border-primary hover:bg-primary hover:text-slate-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  )
}
