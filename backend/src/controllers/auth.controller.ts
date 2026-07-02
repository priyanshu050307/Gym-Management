import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { UserRole, MemberStatus } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-replace-this-in-production';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role, branchId } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Determine role (default to MEMBER)
    const userRole = role && Object.values(UserRole).includes(role) ? (role as UserRole) : UserRole.MEMBER;

    // Use transaction to create User and if they are a MEMBER, create Member profile
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          role: userRole,
          branchId: branchId || null,
        },
      });

      if (userRole === UserRole.MEMBER) {
        const member = await tx.member.create({
          data: {
            userId: user.id,
            status: MemberStatus.ACTIVE,
          },
        });
        return { user, member };
      }

      return { user };
    });

    const token = jwt.sign(
      { id: result.user.id, email: result.user.email, role: result.user.role, branchId: result.user.branchId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { passwordHash: _, ...userWithoutPassword } = result.user;

    return res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword,
      token,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { member: true, branch: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, branchId: user.branchId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { passwordHash: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProfile = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        branchId: true,
        branch: true,
        createdAt: true,
        member: {
          select: {
            id: true,
            status: true,
            joinDate: true,
            emergencyContact: true,
            subscriptions: {
              include: {
                plan: true,
                payments: true,
              },
              orderBy: { startDate: 'desc' },
            },
          },
        },
        trainer: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return success message to prevent user enumeration
      return res.status(200).json({ message: 'If the email exists, a reset link has been sent' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour expiry

    await prisma.forgotPasswordToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    console.log(`\n======================================================`);
    console.log(`[PASSWORD RESET REQUEST] for user: ${email}`);
    console.log(`Reset Token: ${token}`);
    console.log(`Mock Reset Link: http://localhost:5173/reset-password?token=${token}`);
    console.log(`======================================================\n`);

    return res.status(200).json({
      message: 'If the email exists, a reset link has been sent',
      resetToken: token,
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const tokenRecord = await prisma.forgotPasswordToken.findUnique({
      where: { token },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash },
      }),
      prisma.forgotPasswordToken.delete({
        where: { id: tokenRecord.id },
      }),
    ]);

    return res.status(200).json({ message: 'Password reset successful' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
