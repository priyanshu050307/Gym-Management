"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemberBookings = exports.cancelBooking = exports.createBooking = void 0;
const prisma_js_1 = __importDefault(require("../config/prisma.js"));
const client_1 = require("@prisma/client");
const createBooking = async (req, res) => {
    try {
        const { classId, memberId } = req.body;
        if (!classId || !memberId) {
            return res.status(400).json({ error: 'Class ID and Member ID are required' });
        }
        // Security check: MEMBER can only book for themselves
        const reqUser = req.user;
        if (reqUser && reqUser.role === 'MEMBER') {
            const currentMember = await prisma_js_1.default.member.findUnique({ where: { userId: reqUser.id } });
            if (!currentMember || currentMember.id !== memberId) {
                return res.status(403).json({ error: 'Access Denied: You can only book classes for your own membership.' });
            }
        }
        // 1. Verify Member status
        const member = await prisma_js_1.default.member.findUnique({
            where: { id: memberId },
            include: { user: true },
        });
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (member.status !== client_1.MemberStatus.ACTIVE) {
            return res.status(400).json({
                error: `Booking Denied: Member ${member.user.firstName} ${member.user.lastName} does not have an ACTIVE membership status.`,
            });
        }
        // 2. Verify Class and capacity
        const groupClass = await prisma_js_1.default.groupClass.findUnique({
            where: { id: classId },
            include: {
                bookings: {
                    where: { status: client_1.BookingStatus.CONFIRMED },
                },
            },
        });
        if (!groupClass) {
            return res.status(404).json({ error: 'Group class session not found' });
        }
        if (groupClass.bookings.length >= groupClass.capacity) {
            return res.status(400).json({
                error: `Booking Denied: Class "${groupClass.name}" has reached its maximum capacity of ${groupClass.capacity} slots.`,
            });
        }
        // 3. Check if booking already exists (could be cancelled or confirmed)
        const existingBooking = await prisma_js_1.default.classBooking.findUnique({
            where: {
                classId_memberId: { classId, memberId },
            },
        });
        if (existingBooking) {
            if (existingBooking.status === client_1.BookingStatus.CONFIRMED) {
                return res.status(400).json({ error: 'Member is already registered for this class.' });
            }
            // Re-activate cancelled booking
            const updatedBooking = await prisma_js_1.default.classBooking.update({
                where: { id: existingBooking.id },
                data: { status: client_1.BookingStatus.CONFIRMED },
            });
            return res.status(200).json({ message: 'Booking re-confirmed successfully', booking: updatedBooking });
        }
        // 4. Create new booking
        const booking = await prisma_js_1.default.classBooking.create({
            data: {
                classId,
                memberId,
                status: client_1.BookingStatus.CONFIRMED,
            },
        });
        return res.status(201).json({ message: 'Booking created successfully', booking });
    }
    catch (error) {
        console.error('Create booking error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createBooking = createBooking;
const cancelBooking = async (req, res) => {
    try {
        const { classId, memberId } = req.body;
        if (!classId || !memberId) {
            return res.status(400).json({ error: 'Class ID and Member ID are required' });
        }
        // Security check: MEMBER can only cancel for themselves
        const reqUser = req.user;
        if (reqUser && reqUser.role === 'MEMBER') {
            const currentMember = await prisma_js_1.default.member.findUnique({ where: { userId: reqUser.id } });
            if (!currentMember || currentMember.id !== memberId) {
                return res.status(403).json({ error: 'Access Denied: You can only cancel your own class bookings.' });
            }
        }
        // We can soft cancel or delete. Let's delete the record to keep the schedule tidy!
        await prisma_js_1.default.classBooking.delete({
            where: {
                classId_memberId: { classId, memberId },
            },
        });
        return res.status(200).json({ message: 'Booking cancelled successfully' });
    }
    catch (error) {
        console.error('Cancel booking error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.cancelBooking = cancelBooking;
const getMemberBookings = async (req, res) => {
    try {
        const { memberId } = req.params;
        // Security check: MEMBER can only view their own bookings
        const reqUser = req.user;
        if (reqUser && reqUser.role === 'MEMBER') {
            const currentMember = await prisma_js_1.default.member.findUnique({ where: { userId: reqUser.id } });
            if (!currentMember || currentMember.id !== memberId) {
                return res.status(403).json({ error: 'Access Denied: You can only view your own class bookings.' });
            }
        }
        const bookings = await prisma_js_1.default.classBooking.findMany({
            where: { memberId, status: client_1.BookingStatus.CONFIRMED },
            include: {
                class: {
                    include: {
                        trainer: true,
                    },
                },
            },
            orderBy: { bookedAt: 'desc' },
        });
        return res.status(200).json({ bookings });
    }
    catch (error) {
        console.error('Fetch member bookings error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getMemberBookings = getMemberBookings;
