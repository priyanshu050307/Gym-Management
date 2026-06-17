"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const member_controller_js_1 = require("../controllers/member.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticateToken);
// Admins and Staff can perform most member actions
router.post('/register', (0, auth_js_1.requireRoles)([client_1.UserRole.ADMIN, client_1.UserRole.STAFF]), member_controller_js_1.registerMember);
router.get('/dashboard/stats', (0, auth_js_1.requireRoles)([client_1.UserRole.ADMIN, client_1.UserRole.STAFF]), member_controller_js_1.getDashboardStats);
router.get('/', (0, auth_js_1.requireRoles)([client_1.UserRole.ADMIN, client_1.UserRole.STAFF]), member_controller_js_1.getMembers);
router.get('/:id', member_controller_js_1.getMemberById); // Members can fetch their own details, check in controllers could refine permission checks if needed
router.put('/:id/status', (0, auth_js_1.requireRoles)([client_1.UserRole.ADMIN, client_1.UserRole.STAFF]), member_controller_js_1.updateMemberStatus);
router.post('/:id/subscription', (0, auth_js_1.requireRoles)([client_1.UserRole.ADMIN, client_1.UserRole.STAFF]), member_controller_js_1.addSubscriptionToMember);
router.post('/:id/checkin', (0, auth_js_1.requireRoles)([client_1.UserRole.ADMIN, client_1.UserRole.STAFF]), member_controller_js_1.logMemberCheckIn);
exports.default = router;
