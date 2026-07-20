import { z } from 'zod';
export const createTrainerSchema = z.object({
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    specialty: z.string().min(1, 'Specialty is required').max(100),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z
        .string()
        .regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits')
        .optional()
        .or(z.literal('')),
    branchId: z.string().uuid('Invalid branch ID').optional().nullable(),
});
export const updateTrainerSchema = z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    specialty: z.string().min(1).max(100).optional(),
    email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
    phone: z
        .string()
        .regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits')
        .optional()
        .nullable()
        .or(z.literal('')),
    isActive: z.boolean().optional(),
    branchId: z.string().uuid('Invalid branch ID').optional().nullable(),
});
