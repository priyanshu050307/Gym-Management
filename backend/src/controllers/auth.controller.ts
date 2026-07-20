import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { UserRole, MemberStatus } from '@prisma/client';
import logger from '../config/logger.js';
import { sendWelcomeEmail } from '../config/email.js';
import { verifyFirebaseToken } from '../config/firebase.js';

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

      if (userRole === UserRole.ADMIN) {
        // Initialize or reset SaaS trial for 30 days
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);

        const existingSub = await tx.saaSSubscription.findFirst({
          where: { ownerId: user.id },
        });
        if (existingSub) {
          await tx.saaSSubscription.update({
            where: { id: existingSub.id },
            data: {
              status: 'TRIAL_ACTIVE',
              planName: 'Starter',
              trialEndDate,
              subscriptionEnd: null,
            },
          });
        } else {
          await tx.saaSSubscription.create({
            data: {
              ownerId: user.id,
              status: 'TRIAL_ACTIVE',
              planName: 'Starter',
              trialEndDate,
            },
          });
        }
      }

      return { user };
    });

    const token = jwt.sign(
      { id: result.user.id, email: result.user.email, role: result.user.role, branchId: result.user.branchId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { passwordHash: _, ...userWithoutPassword } = result.user;

    // Send welcome email (non-blocking)
    if (userRole === UserRole.ADMIN) {
      sendWelcomeEmail(result.user.email, result.user.firstName, 30).catch((e) =>
        logger.error('Failed to send welcome email', { error: e.message })
      );
    }

    return res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword,
      token,
    });
  } catch (error: any) {
    logger.error('Registration error', { error: error.message });
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

    if (!user.passwordHash) {
      return res.status(400).json({ error: 'This account uses Google or Phone OTP login. Please use the social login options.' });
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
        profilePhoto: true,
        phoneNumber: true,
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

export const updateProfile = async (req: any, res: Response) => {
  try {
    const { firstName, lastName, email, profilePhoto, phoneNumber } = req.body;
    const userId = req.user.id;

    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Email is already in use by another account' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
        email: email !== undefined ? email : undefined,
        profilePhoto: profilePhoto !== undefined ? profilePhoto : undefined,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : undefined,
      },
    });

    return res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error: any) {
    console.error('Profile update error:', error);
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

export const firebaseLogin = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Firebase ID token is required' });
    }

    // Verify token
    const decodedToken = await verifyFirebaseToken(idToken);
    const { email, phone_number, name, uid, firebase } = decodedToken;
    const provider = firebase?.sign_in_provider;

    let user = null;

    // 1. Try to find user
    if (provider === 'google.com' && email) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { googleId: uid },
            { email: email }
          ]
        }
      });
    } else if (provider === 'phone' && phone_number) {
      user = await prisma.user.findFirst({
        where: { phoneNumber: phone_number }
      });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    }

    // 2. If user doesn't exist, register them as a new owner ADMIN
    if (!user) {
      const displayName = name || 'Gym Owner';
      const [firstName, ...lastNameParts] = displayName.split(' ');
      const lastName = lastNameParts.join(' ') || 'Admin';
      const finalEmail = email || `owner_${uid.substring(0, 8)}@gymos.com`;

      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: finalEmail,
            phoneNumber: phone_number || null,
            googleId: provider === 'google.com' ? uid : null,
            firstName,
            lastName,
            role: UserRole.ADMIN,
            branchId: null,
          },
        });

        // Create SaaS trial subscription for 30 days
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);
        await tx.saaSSubscription.create({
          data: {
            ownerId: newUser.id,
            status: 'TRIAL_ACTIVE',
            planName: 'Starter',
            trialEndDate,
          },
        });

        return newUser;
      });

      // Send welcome email if they have a real email
      if (email && !email.endsWith('@gymos.com')) {
        sendWelcomeEmail(email, firstName).catch((err) =>
          logger.error('Error sending welcome email on social register', { error: err.message })
        );
      }

      logger.info('New social user registered successfully', {
        userId: user.id,
        email: user.email,
        provider,
      });
    } else {
      // User exists, update social keys if missing
      const updateData: any = {};
      if (provider === 'google.com' && !user.googleId) {
        updateData.googleId = uid;
      }
      if (phone_number && !user.phoneNumber) {
        updateData.phoneNumber = phone_number;
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }

      logger.info('Social user logged in successfully', {
        userId: user.id,
        email: user.email,
        provider,
      });
    }

    // 3. Issue local JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        branchId: user.branchId,
      },
    });
  } catch (error: any) {
    logger.error('Firebase authentication failure', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(401).json({ error: error.message || 'Firebase authentication failed' });
  }
};
