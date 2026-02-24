import { motion } from "framer-motion";
import { motionTransition } from "@/lib/motion";

interface StatsCardProps {
  icon: string;
  value: string | number;
  label: string;
  colorClass?: string;
  delay?: number;
}

export function StatsCard({ icon, value, label, colorClass = "text-white", delay = 0 }: StatsCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...motionTransition.slow, delay: delay * 0.1 }}
      className="bg-card border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-1.5 hover:border-white/10 transition-colors"
    >
      <span className="text-2xl mb-1 filter drop-shadow-md">{icon}</span>
      <span className={`text-3xl font-bold font-display ${colorClass} tracking-tight`}>{value}</span>
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
    </motion.div>
  );
}
