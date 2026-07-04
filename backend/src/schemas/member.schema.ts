import { z } from 'zod';

export const createMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  branchId: z.string().uuid('Invalid branch ID'),
  planId: z.string().uuid('Invalid plan ID').optional(),
  emergencyContact: z.string().regex(/^\d{10}$/, 'Emergency contact must be exactly 10 digits').optional().or(z.literal('')),
  medicalHistory: z.string().optional(),
  trainerId: z.string().uuid('Invalid trainer ID').optional().nullable(),
});

export const updateMemberSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  emergencyContact: z.string().regex(/^\d{10}$/, 'Emergency contact must be exactly 10 digits').optional().nullable().or(z.literal('')),
  medicalHistory: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED']).optional(),
  trainerId: z.string().uuid('Invalid trainer ID').optional().nullable(),
});

export const checkInSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
