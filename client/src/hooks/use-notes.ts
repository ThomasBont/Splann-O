import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertNote } from "@shared/routes";
import type { NoteWithAuthor } from "@shared/schema";
import { apiRequest } from "@/lib/api";

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
      try {
        return await apiRequest<NoteWithAuthor[]>(url);
      } catch (error) {
        throw new Error(parseNoteError(error instanceof Error ? error.message : ""));
      }
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
      try {
        return await apiRequest(url, {
        method: "POST",
        body: data,
      });
      } catch (error) {
        const message = parseNoteError(error instanceof Error ? error.message : "");
        if (import.meta.env?.DEV) {
          console.error("[useCreateNote]", message);
        }
        throw new Error(message);
      }
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
      try {
        return await apiRequest(url, {
          method: "PATCH",
          body: updates,
        });
      } catch (error) {
        throw new Error(parseNoteError(error instanceof Error ? error.message : ""));
      }
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
      try {
        await apiRequest(url, { method: "DELETE" });
      } catch (error) {
        throw new Error(parseNoteError(error instanceof Error ? error.message : ""));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTES_QUERY_KEY, eventId] });
    },
  });
}
