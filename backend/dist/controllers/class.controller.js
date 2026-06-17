"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteClass = exports.updateClass = exports.getClassById = exports.getClasses = exports.createClass = void 0;
const prisma_js_1 = __importDefault(require("../config/prisma.js"));
const createClass = async (req, res) => {
    try {
        const { name, description, trainerId, dateTime, durationMinutes, capacity } = req.body;
        if (!name || !trainerId || !dateTime) {
            return res.status(400).json({ error: 'Name, trainer, and schedule date/time are required' });
        }
        // Verify trainer exists and is active
        const trainer = await prisma_js_1.default.trainer.findUnique({ where: { id: trainerId } });
        if (!trainer) {
            return res.status(404).json({ error: 'Trainer not found' });
        }
        if (!trainer.isActive) {
            return res.status(400).json({ error: 'Selected trainer profile is currently inactive' });
        }
        const groupClass = await prisma_js_1.default.groupClass.create({
            data: {
                name,
                description: description || null,
                trainerId,
                dateTime: new Date(dateTime),
                durationMinutes: durationMinutes ? parseInt(durationMinutes) : 60,
                capacity: capacity ? parseInt(capacity) : 20,
            },
            include: {
                trainer: true,
            },
        });
        return res.status(201).json({ message: 'Class scheduled successfully', groupClass });
    }
    catch (error) {
        console.error('Create class error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createClass = createClass;
const getClasses = async (req, res) => {
    try {
        // Optional query parameter to filter by date
        const { startDate, endDate } = req.query;
        const whereClause = {};
        if (startDate && endDate) {
            whereClause.dateTime = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }
        const classes = await prisma_js_1.default.groupClass.findMany({
            where: whereClause,
            include: {
                trainer: true,
                bookings: {
                    include: {
                        member: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { dateTime: 'asc' },
        });
        return res.status(200).json({ classes });
    }
    catch (error) {
        console.error('Fetch classes error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getClasses = getClasses;
const getClassById = async (req, res) => {
    try {
        const { id } = req.params;
        const groupClass = await prisma_js_1.default.groupClass.findUnique({
            where: { id },
            include: {
                trainer: true,
                bookings: {
                    include: {
                        member: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!groupClass) {
            return res.status(404).json({ error: 'Class session not found' });
        }
        return res.status(200).json({ groupClass });
    }
    catch (error) {
        console.error('Fetch class details error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getClassById = getClassById;
const updateClass = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, trainerId, dateTime, durationMinutes, capacity } = req.body;
        const data = {};
        if (name !== undefined)
            data.name = name;
        if (description !== undefined)
            data.description = description;
        if (durationMinutes !== undefined)
            data.durationMinutes = parseInt(durationMinutes);
        if (capacity !== undefined)
            data.capacity = parseInt(capacity);
        if (dateTime !== undefined)
            data.dateTime = new Date(dateTime);
        if (trainerId) {
            const trainer = await prisma_js_1.default.trainer.findUnique({ where: { id: trainerId } });
            if (!trainer) {
                return res.status(404).json({ error: 'Trainer not found' });
            }
            data.trainerId = trainerId;
        }
        const groupClass = await prisma_js_1.default.groupClass.update({
            where: { id },
            data,
            include: {
                trainer: true,
            },
        });
        return res.status(200).json({ message: 'Class session updated successfully', groupClass });
    }
    catch (error) {
        console.error('Update class error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateClass = updateClass;
const deleteClass = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_js_1.default.groupClass.delete({
            where: { id },
        });
        return res.status(200).json({ message: 'Class session deleted successfully' });
    }
    catch (error) {
        console.error('Delete class error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteClass = deleteClass;
