import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

console.log('--- Razorpay Diagnostics ---');
console.log('KEY_ID:', key_id);
console.log('KEY_SECRET_EXISTS:', !!key_secret);

try {
  const rzp = new (Razorpay as any)({ key_id: key_id || '', key_secret: key_secret || '' });
  console.log('Razorpay instance successfully instantiated.');
  rzp.orders.create({
    amount: 50000, // 500 INR
    currency: 'INR',
    receipt: 'test_saas_receipt_123',
  }).then((order: any) => {
    console.log('Order created successfully:', order.id);
  }).catch((err: any) => {
    console.error('Error creating order via Razorpay API:', err);
  });
} catch (e) {
  console.error('Error instantiating Razorpay:', e);
}
