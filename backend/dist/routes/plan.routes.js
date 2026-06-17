"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const plan_controller_js_1 = require("../controllers/plan.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// Allow STAFF or ADMIN to view and manage plans, but only ADMIN can create/edit/delete
router.use(auth_js_1.authenticateToken);
router.get('/', plan_controller_js_1.getPlans);
router.get('/:id', plan_controller_js_1.getPlanById);
// Administrative mutations
router.post('/', (0, auth_js_1.requireRoles)([client_1.UserRole.ADMIN]), plan_controller_js_1.createPlan);
router.put('/:id', (0, auth_js_1.requireRoles)([client_1.UserRole.ADMIN]), plan_controller_js_1.updatePlan);
router.delete('/:id', (0, auth_js_1.requireRoles)([client_1.UserRole.ADMIN]), plan_controller_js_1.deletePlan);
exports.default = router;
