import { X } from "lucide-react";
import { motion } from "framer-motion";

interface ParticipantChipProps {
  name: string;
  onRemove: () => void;
}

export function ParticipantChip({ name, onRemove }: ParticipantChipProps) {
  return (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="bg-secondary/50 border border-white/5 rounded-full pl-4 pr-2 py-1.5 flex items-center gap-2 hover:border-white/20 transition-colors group"
    >
      <span className="font-medium text-sm text-foreground">{name}</span>
      <button 
        onClick={onRemove}
        className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
