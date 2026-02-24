import { motion } from "framer-motion";
import { motionTransition } from "@/lib/motion";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";

interface ExpenseItemProps {
  id: number;
  category: string;
  item: string;
  amount: number;
  participantName: string;
  onEdit: () => void;
  onDelete: () => void;
  delay?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Meat: 'border-l-orange-500',
  Bread: 'border-l-yellow-500',
  Drinks: 'border-l-blue-500',
  Charcoal: 'border-l-gray-500',
  Transportation: 'border-l-green-500',
  Other: 'border-l-purple-500',
  Food: 'border-l-orange-500',
  Transport: 'border-l-green-500',
  Tickets: 'border-l-violet-500',
  Accommodation: 'border-l-sky-500',
};

export function ExpenseItem({ id, category, item, amount, participantName, onEdit, onDelete, delay = 0 }: ExpenseItemProps) {
  const { t } = useLanguage();
  const translatedCategory = t.categories[category as keyof typeof t.categories] || category;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...motionTransition.normal, delay: delay * 0.05 }}
      className={`bg-card/50 border border-white/5 rounded-lg p-4 flex items-center gap-4 hover:bg-card transition-colors group border-l-4 ${CATEGORY_COLORS[category] || 'border-l-gray-500'}`}
    >
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground text-base truncate">{item}</h4>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <span>{translatedCategory}</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
          <span>{participantName}</span>
        </p>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-primary tabular-nums">${Number(amount).toFixed(2)}</div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10" onClick={onEdit}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
