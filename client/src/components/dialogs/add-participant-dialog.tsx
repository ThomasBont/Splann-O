import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateParticipant } from "@/hooks/use-bbq-data";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
});

interface AddParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddParticipantDialog({ open, onOpenChange }: AddParticipantDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const createParticipant = useCreateParticipant();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createParticipant.mutate(values, {
      onSuccess: () => {
        toast({ title: t("add.person"), description: `${values.name} added!` });
        form.reset();
        onOpenChange(false);
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-white/10">
        <DialogHeader>
          <DialogTitle className="text-gold font-display text-xl">{t("modal.add.participant")}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-[10px] tracking-wider text-muted-foreground">{t("name")}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. Alex" 
                      {...field} 
                      className="bg-secondary/50 border-white/10 focus-visible:ring-gold/50 text-base"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" className="bg-gold text-primary-foreground hover:bg-gold/90">
                {createParticipant.isPending ? "..." : t("add")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
