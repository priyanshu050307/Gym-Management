import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(100),
  address: z.string().max(500).optional(),
  phone: z
    .string()
    .regex(/^\d{10}$/, 'Phone number must be exactly 10 digits')
    .optional()
    .or(z.literal('')),
  gstNo: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format')
    .optional()
    .or(z.literal('')),
  staffEmail: z.string().email('Invalid staff email').optional(),
  staffPassword: z.string().min(6).optional(),
  staffFirstName: z.string().min(1).max(50).optional(),
  staffLastName: z.string().min(1).max(50).optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(500).optional(),
  phone: z
    .string()
    .regex(/^\d{10}$/, 'Phone number must be exactly 10 digits')
    .optional()
    .or(z.literal('')),
  gstNo: z.string().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
