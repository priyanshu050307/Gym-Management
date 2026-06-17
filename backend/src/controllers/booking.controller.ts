import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { BookingStatus, MemberStatus } from '@prisma/client';

export const createBooking = async (req: Request, res: Response) => {
  try {
    const { classId, memberId } = req.body;

    if (!classId || !memberId) {
      return res.status(400).json({ error: 'Class ID and Member ID are required' });
    }

    // Security check: MEMBER can only book for themselves
    const reqUser = (req as any).user;
    if (reqUser && reqUser.role === 'MEMBER') {
      const currentMember = await prisma.member.findUnique({ where: { userId: reqUser.id } });
      if (!currentMember || currentMember.id !== memberId) {
        return res.status(403).json({ error: 'Access Denied: You can only book classes for your own membership.' });
      }
    }

    // 1. Verify Member status
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.status !== MemberStatus.ACTIVE) {
      return res.status(400).json({
        error: `Booking Denied: Member ${member.user.firstName} ${member.user.lastName} does not have an ACTIVE membership status.`,
      });
    }

    // 2. Verify Class and capacity
    const groupClass = await prisma.groupClass.findUnique({
      where: { id: classId },
      include: {
        bookings: {
          where: { status: BookingStatus.CONFIRMED },
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
    const existingBooking = await prisma.classBooking.findUnique({
      where: {
        classId_memberId: { classId, memberId },
      },
    });

    if (existingBooking) {
      if (existingBooking.status === BookingStatus.CONFIRMED) {
        return res.status(400).json({ error: 'Member is already registered for this class.' });
      }

      // Re-activate cancelled booking
      const updatedBooking = await prisma.classBooking.update({
        where: { id: existingBooking.id },
        data: { status: BookingStatus.CONFIRMED },
      });
      return res.status(200).json({ message: 'Booking re-confirmed successfully', booking: updatedBooking });
    }

    // 4. Create new booking
    const booking = await prisma.classBooking.create({
      data: {
        classId,
        memberId,
        status: BookingStatus.CONFIRMED,
      },
    });

    return res.status(201).json({ message: 'Booking created successfully', booking });
  } catch (error: any) {
    console.error('Create booking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const { classId, memberId } = req.body;

    if (!classId || !memberId) {
      return res.status(400).json({ error: 'Class ID and Member ID are required' });
    }

    // Security check: MEMBER can only cancel for themselves
    const reqUser = (req as any).user;
    if (reqUser && reqUser.role === 'MEMBER') {
      const currentMember = await prisma.member.findUnique({ where: { userId: reqUser.id } });
      if (!currentMember || currentMember.id !== memberId) {
        return res.status(403).json({ error: 'Access Denied: You can only cancel your own class bookings.' });
      }
    }

    // We can soft cancel or delete. Let's delete the record to keep the schedule tidy!
    await prisma.classBooking.delete({
      where: {
        classId_memberId: { classId, memberId },
      },
    });

    return res.status(200).json({ message: 'Booking cancelled successfully' });
  } catch (error: any) {
    console.error('Cancel booking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMemberBookings = async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;

    // Security check: MEMBER can only view their own bookings
    const reqUser = (req as any).user;
    if (reqUser && reqUser.role === 'MEMBER') {
      const currentMember = await prisma.member.findUnique({ where: { userId: reqUser.id } });
      if (!currentMember || currentMember.id !== memberId) {
        return res.status(403).json({ error: 'Access Denied: You can only view your own class bookings.' });
      }
    }

    const bookings = await prisma.classBooking.findMany({
      where: { memberId, status: BookingStatus.CONFIRMED },
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
  } catch (error: any) {
    console.error('Fetch member bookings error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
