"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePlan = exports.updatePlan = exports.getPlanById = exports.getPlans = exports.createPlan = void 0;
const prisma_js_1 = __importDefault(require("../config/prisma.js"));
const createPlan = async (req, res) => {
    try {
        const { name, price, durationMonths, description } = req.body;
        if (!name || price === undefined || durationMonths === undefined) {
            return res.status(400).json({ error: 'Name, price, and duration are required' });
        }
        const plan = await prisma_js_1.default.membershipPlan.create({
            data: {
                name,
                price: parseFloat(price),
                durationMonths: parseInt(durationMonths),
                description,
            },
        });
        return res.status(201).json({ message: 'Plan created successfully', plan });
    }
    catch (error) {
        console.error('Plan creation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createPlan = createPlan;
const getPlans = async (req, res) => {
    try {
        const plans = await prisma_js_1.default.membershipPlan.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({ plans });
    }
    catch (error) {
        console.error('Fetch plans error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPlans = getPlans;
const getPlanById = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await prisma_js_1.default.membershipPlan.findUnique({
            where: { id },
        });
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        return res.status(200).json({ plan });
    }
    catch (error) {
        console.error('Fetch plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPlanById = getPlanById;
const updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, durationMonths, description, isActive } = req.body;
        const updatedData = {};
        if (name !== undefined)
            updatedData.name = name;
        if (price !== undefined)
            updatedData.price = parseFloat(price);
        if (durationMonths !== undefined)
            updatedData.durationMonths = parseInt(durationMonths);
        if (description !== undefined)
            updatedData.description = description;
        if (isActive !== undefined)
            updatedData.isActive = isActive;
        const plan = await prisma_js_1.default.membershipPlan.update({
            where: { id },
            data: updatedData,
        });
        return res.status(200).json({ message: 'Plan updated successfully', plan });
    }
    catch (error) {
        console.error('Update plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updatePlan = updatePlan;
const deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        // We do a soft delete by setting isActive to false
        const plan = await prisma_js_1.default.membershipPlan.update({
            where: { id },
            data: { isActive: false },
        });
        return res.status(200).json({ message: 'Plan deactivated successfully', plan });
    }
    catch (error) {
        console.error('Deactivate plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deletePlan = deletePlan;
