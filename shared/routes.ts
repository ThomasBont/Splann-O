import { z } from 'zod';
import { insertBarbecueSchema, insertParticipantSchema, insertExpenseSchema } from './schema';
import type { Barbecue, Participant, ExpenseWithParticipant, NoteWithAuthor, Membership } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  barbecues: {
    list: {
      method: 'GET' as const,
      path: '/api/barbecues' as const,
      responses: {
        200: z.array(z.custom<Barbecue>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/barbecues' as const,
      input: insertBarbecueSchema,
      responses: {
        201: z.custom<Barbecue>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/barbecues/:id' as const,
      responses: {
        200: z.custom<Barbecue>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/barbecues/:id' as const,
      input: z.object({ allowOptInExpenses: z.boolean().optional(), templateData: z.unknown().optional(), status: z.enum(["draft", "active", "settling", "settled"]).optional() }),
      responses: {
        200: z.custom<Barbecue>(),
        403: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/barbecues/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    listPublic: {
      method: 'GET' as const,
      path: '/api/barbecues/public' as const,
      responses: {
        200: z.array(z.custom<Barbecue>()),
      },
    },
  },
  participants: {
    list: {
      method: 'GET' as const,
      path: '/api/barbecues/:bbqId/participants' as const,
      responses: {
        200: z.array(z.custom<Participant>()),
      },
    },
    pending: {
      method: 'GET' as const,
      path: '/api/barbecues/:bbqId/pending' as const,
      responses: {
        200: z.array(z.custom<Participant>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/barbecues/:bbqId/participants' as const,
      input: insertParticipantSchema.omit({ barbecueId: true }),
      responses: {
        201: z.custom<Participant>(),
        400: errorSchemas.validation,
      },
    },
    join: {
      method: 'POST' as const,
      path: '/api/barbecues/:bbqId/join' as const,
      input: z.object({ name: z.string(), userId: z.string() }),
      responses: {
        201: z.custom<Participant>(),
        400: errorSchemas.validation,
        409: errorSchemas.validation,
      },
    },
    accept: {
      method: 'PATCH' as const,
      path: '/api/participants/:id/accept' as const,
      responses: {
        200: z.custom<Participant>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/participants/:id' as const,
      input: z.object({ name: z.string().min(1).max(100) }),
      responses: {
        200: z.custom<Participant>(),
        400: errorSchemas.validation,
        403: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/participants/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  memberships: {
    list: {
      method: 'GET' as const,
      path: '/api/memberships' as const,
      responses: {
        200: z.array(z.custom<Membership>()),
      },
    },
  },
  expenses: {
    list: {
      method: 'GET' as const,
      path: '/api/barbecues/:bbqId/expenses' as const,
      responses: {
        200: z.array(z.custom<ExpenseWithParticipant>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/barbecues/:bbqId/expenses' as const,
      input: insertExpenseSchema.omit({ barbecueId: true }).extend({ optInByDefault: z.boolean().optional() }),
      responses: {
        201: z.custom<ExpenseWithParticipant>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/expenses/:id' as const,
      input: insertExpenseSchema.partial(),
      responses: {
        200: z.custom<ExpenseWithParticipant>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/expenses/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  notes: {
    list: {
      method: 'GET' as const,
      path: '/api/events/:eventId/notes' as const,
      responses: {
        200: z.array(z.custom<NoteWithAuthor>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/events/:eventId/notes' as const,
      input: z.object({
        participantId: z.number(),
        title: z.string().max(200).optional().nullable(),
        body: z.string().min(1, "Note body is required").max(10000),
        pinned: z.boolean().optional(),
      }),
      responses: {
        201: z.custom<NoteWithAuthor>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/notes/:noteId' as const,
      input: z.object({ title: z.string().max(200).optional().nullable(), body: z.string().min(1).max(10000).optional(), pinned: z.boolean().optional() }),
      responses: {
        200: z.custom<NoteWithAuthor>(),
        400: errorSchemas.validation,
        403: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/notes/:noteId' as const,
      responses: {
        204: z.void(),
        403: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type InsertParticipant = z.infer<typeof api.participants.create.input>;
export type InsertExpense = z.infer<typeof api.expenses.create.input>;
export type UpdateExpenseRequest = z.infer<typeof api.expenses.update.input>;
export type InsertNote = z.infer<typeof api.notes.create.input>;
