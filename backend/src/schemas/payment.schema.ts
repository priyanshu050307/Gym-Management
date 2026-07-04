import { z } from 'zod';

export const createPaymentSchema = z.object({
  subscriptionId: z.string().uuid('Invalid subscription ID'),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['CASH', 'CARD', 'UPI', 'RAZORPAY', 'BANK_TRANSFER']).optional(),
  notes: z.string().max(500).optional(),
});

export const razorpayVerifySchema = z.object({
  razorpay_order_id: z.string().min(1, 'Razorpay order ID required'),
  razorpay_payment_id: z.string().min(1, 'Razorpay payment ID required'),
  razorpay_signature: z.string().min(1, 'Razorpay signature required'),
});

export const saasSubscribeSchema = z.object({
  planName: z.enum(['Starter', 'Professional', 'Enterprise']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  cardBrand: z.string().optional(),
  cardLast4: z.string().length(4).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type RazorpayVerifyInput = z.infer<typeof razorpayVerifySchema>;
