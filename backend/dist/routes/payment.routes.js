"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_js_1 = require("../controllers/payment.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// Secure all endpoints
router.use(auth_js_1.authenticateToken);
router.get('/', (0, auth_js_1.requireRoles)([client_1.UserRole.ADMIN, client_1.UserRole.STAFF]), payment_controller_js_1.getPayments);
router.post('/:id/manual', (0, auth_js_1.requireRoles)([client_1.UserRole.ADMIN, client_1.UserRole.STAFF]), payment_controller_js_1.recordManualPayment);
router.post('/:id/mock-pay', payment_controller_js_1.processMockCardPayment);
router.get('/:id/invoice', payment_controller_js_1.downloadInvoice);
exports.default = router;
