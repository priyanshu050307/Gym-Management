import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import planRoutes from './routes/plan.routes.js';
import memberRoutes from './routes/member.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import trainerRoutes from './routes/trainer.routes.js';
import classRoutes from './routes/class.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import { initCronJobs } from './config/cron.js';

dotenv.config();

// Initialize scheduler
initCronJobs();

const app = express();

// Middlewares
app.use(cors({
  origin: '*', // For local dev, customize as needed
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Route Handlers
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/bookings', bookingRoutes);

// 404 Route
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error occurred' });
});

export default app;
