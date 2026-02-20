import { z } from 'zod';
import { insertBarbecueSchema, insertParticipantSchema, insertExpenseSchema } from './schema';
import type { Barbecue, Participant, ExpenseWithParticipant } from './schema';

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
    delete: {
      method: 'DELETE' as const,
      path: '/api/barbecues/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
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
    create: {
      method: 'POST' as const,
      path: '/api/barbecues/:bbqId/participants' as const,
      input: insertParticipantSchema.omit({ barbecueId: true }),
      responses: {
        201: z.custom<Participant>(),
        400: errorSchemas.validation,
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
      input: insertExpenseSchema.omit({ barbecueId: true }),
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
  }
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
