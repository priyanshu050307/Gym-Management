"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_js_1 = __importDefault(require("./routes/auth.routes.js"));
const plan_routes_js_1 = __importDefault(require("./routes/plan.routes.js"));
const member_routes_js_1 = __importDefault(require("./routes/member.routes.js"));
const payment_routes_js_1 = __importDefault(require("./routes/payment.routes.js"));
const trainer_routes_js_1 = __importDefault(require("./routes/trainer.routes.js"));
const class_routes_js_1 = __importDefault(require("./routes/class.routes.js"));
const booking_routes_js_1 = __importDefault(require("./routes/booking.routes.js"));
const cron_js_1 = require("./config/cron.js");
dotenv_1.default.config();
// Initialize scheduler
(0, cron_js_1.initCronJobs)();
const app = (0, express_1.default)();
// Middlewares
app.use((0, cors_1.default)({
    origin: '*', // For local dev, customize as needed
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Root healthcheck
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});
// Route Handlers
app.use('/api/auth', auth_routes_js_1.default);
app.use('/api/plans', plan_routes_js_1.default);
app.use('/api/members', member_routes_js_1.default);
app.use('/api/payments', payment_routes_js_1.default);
app.use('/api/trainers', trainer_routes_js_1.default);
app.use('/api/classes', class_routes_js_1.default);
app.use('/api/bookings', booking_routes_js_1.default);
// 404 Route
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal server error occurred' });
});
exports.default = app;
