import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertNote } from "@shared/routes";
import type { NoteWithAuthor } from "@shared/schema";

const NOTES_QUERY_KEY = "/api/events/notes";

function parseNoteError(text: string): string {
  if (/Cannot POST|Cannot GET|Cannot PATCH|Cannot DELETE/i.test(text)) {
    return "Notes API route missing";
  }
  try {
    const err = JSON.parse(text) as { message?: string };
    return err?.message || "Operation failed";
  } catch {
    return text?.slice(0, 150) || "Operation failed";
  }
}

export function useNotes(eventId: number | null) {
  return useQuery({
    queryKey: [NOTES_QUERY_KEY, eventId],
    queryFn: async (): Promise<NoteWithAuthor[]> => {
      if (!eventId) return [];
      const url = buildUrl(api.notes.list.path, { eventId });
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(parseNoteError(text));
      }
      return res.json();
    },
    enabled: !!eventId,
  });
}

export function useCreateNote(eventId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertNote) => {
      if (!eventId) throw new Error("No event selected");
      const url = buildUrl(api.notes.create.path, { eventId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text();
        const message = parseNoteError(text);
        if (import.meta.env?.DEV) {
          console.error("[useCreateNote]", res.status, res.statusText, message);
        }
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTES_QUERY_KEY, eventId] });
    },
  });
}

export function useUpdateNote(eventId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: number;
      title?: string | null;
      body?: string;
      pinned?: boolean;
    }) => {
      const url = buildUrl(api.notes.update.path, { noteId: id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(parseNoteError(text));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTES_QUERY_KEY, eventId] });
    },
  });
}

export function useDeleteNote(eventId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.notes.delete.path, { noteId: id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(parseNoteError(text));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTES_QUERY_KEY, eventId] });
    },
  });
}
