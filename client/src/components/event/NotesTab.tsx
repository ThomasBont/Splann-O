"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { motionTransition } from "@/lib/motion";
import { useLanguage } from "@/hooks/use-language";
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from "@/hooks/use-notes";
import { Modal, ModalSection } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { StickyNote, Plus, Edit2, Trash2, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteWithAuthor } from "@shared/schema";

function formatRelativeTime(date: Date | string, t: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t.justNow;
  if (diffMins < 60) return t.minutesAgo.replace("{{n}}", String(diffMins));
  if (diffHours < 24) return t.hoursAgo.replace("{{n}}", String(diffHours));
  return t.daysAgo.replace("{{n}}", String(diffDays));
}

export interface NotesTabProps {
  /** Event ID (works for all event types: barbecue, birthday, trips, etc.) */
  eventId: number | null;
  /** Current user's participantId — required to add notes */
  myParticipantId: number | null;
  canAddNote: boolean;
  emptySubtitleOverride?: string;
}

export function NotesTab({ eventId, myParticipantId, canAddNote, emptySubtitleOverride }: NotesTabProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: notes = [], isLoading } = useNotes(eventId);
  const createNote = useCreateNote(eventId);
  const updateNote = useUpdateNote(eventId);
  const deleteNote = useDeleteNote(eventId);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<NoteWithAuthor | null>(null);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [pinned, setPinned] = React.useState(false);

  const pinnedNotes = notes.filter((n) => n.pinned);
  const regularNotes = notes.filter((n) => !n.pinned);

  const resetForm = () => {
    setEditingNote(null);
    setTitle("");
    setBody("");
    setPinned(false);
  };

  const openAdd = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (note: NoteWithAuthor) => {
    setEditingNote(note);
    setTitle(note.title || "");
    setBody(note.body);
    setPinned(note.pinned);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      toast({ title: t.modals.noteBodyRequired, variant: "warning" });
      return;
    }
    if (editingNote) {
      await updateNote.mutateAsync(
        { id: editingNote.id, title: title.trim() || null, body: trimmedBody, pinned },
        {
          onSuccess: () => {
            toast({ title: t.modals.noteUpdated });
            setModalOpen(false);
            resetForm();
          },
        }
      );
    } else if (myParticipantId) {
      try {
        await createNote.mutateAsync(
          { participantId: myParticipantId, title: title.trim() || null, body: trimmedBody, pinned },
          {
            onSuccess: () => {
              toast({ title: t.modals.noteAdded });
              setModalOpen(false);
              resetForm();
            },
          }
        );
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : "Failed to create note", variant: "destructive" });
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t.notes.deleteConfirm)) return;
    await deleteNote.mutateAsync(id, {
      onSuccess: () => toast({ title: t.modals.noteDeleted }),
    });
  };

  const togglePin = async (note: NoteWithAuthor) => {
    await updateNote.mutateAsync({ id: note.id, pinned: !note.pinned });
  };

  const isAuthor = (note: NoteWithAuthor) => {
    if (!myParticipantId) return false;
    return note.participantId === myParticipantId;
  };

  if (isLoading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-8 text-center text-muted-foreground">
        <p className="text-sm">Loading notes…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pinned note area */}
      {pinnedNotes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Pin className="h-3.5 w-3.5" />
            {t.notes.pinnedNote}
          </h3>
          <div className="space-y-2">
            {pinnedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                canEdit={isAuthor(note)}
                onEdit={() => openEdit(note)}
                onDelete={() => handleDelete(note.id)}
                onTogglePin={() => togglePin(note)}
                formatTime={() => formatRelativeTime(note.createdAt ?? new Date(), t.notes)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-2">
        {pinnedNotes.length > 0 && <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>}
        {regularNotes.length === 0 && pinnedNotes.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-8 text-center shadow-[var(--shadow-sm)]">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <StickyNote className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">{t.notes.emptyTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">{emptySubtitleOverride ?? t.notes.emptySubtitle}</p>
            {canAddNote && myParticipantId && (
              <Button onClick={openAdd} className="mt-5" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                {t.notes.addNoteCta}
              </Button>
            )}
          </div>
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              {regularNotes.map((note) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={motionTransition.normal}
                  className="overflow-hidden"
                >
                  <NoteCard
                    note={note}
                    canEdit={isAuthor(note)}
                    onEdit={() => openEdit(note)}
                    onDelete={() => handleDelete(note.id)}
                    onTogglePin={() => togglePin(note)}
                    formatTime={() => formatRelativeTime(note.createdAt ?? new Date(), t.notes)}
                    t={t}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {canAddNote && myParticipantId && (
              <Button onClick={openAdd} variant="outline" size="sm" className="mt-2 w-full">
                <Plus className="w-4 h-4 mr-2" />
                {t.notes.addNoteCta}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Note Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingNote ? t.modals.editNoteTitle : t.modals.addNoteTitle}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t.modals.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={createNote.isPending || updateNote.isPending || !body.trim()}
            >
              {editingNote ? t.modals.save : t.modals.add}
            </Button>
          </>
        }
      >
        <ModalSection className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">{t.modals.noteTitlePlaceholder}</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.modals.noteTitlePlaceholder}
              maxLength={200}
              className="bg-secondary/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-body">Body *</Label>
            <textarea
              id="note-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t.modals.noteBodyPlaceholder}
              rows={4}
              className="w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] resize-y"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="note-pinned" className="flex items-center gap-2 cursor-pointer">
              <Switch id="note-pinned" checked={pinned} onCheckedChange={setPinned} />
              {t.modals.pinNote}
            </Label>
          </div>
        </ModalSection>
      </Modal>
    </div>
  );
}

function NoteCard({
  note,
  canEdit,
  onEdit,
  onDelete,
  onTogglePin,
  formatTime,
  t,
}: {
  note: NoteWithAuthor;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  formatTime: () => string;
  t: { notes: { by: string } };
}) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/50 p-4 hover:bg-[hsl(var(--surface-2))]/80 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {note.title && (
            <h4 className="text-sm font-semibold text-foreground truncate">{note.title}</h4>
          )}
          <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
            {note.body}
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
            <span>{t.notes.by} {note.authorName}</span>
            <span>·</span>
            <span>{formatTime()}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onTogglePin}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label={note.pinned ? "Unpin" : "Pin"}
          >
            <Pin className={cn("h-4 w-4", note.pinned && "fill-amber-400 text-amber-500")} />
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Edit"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
