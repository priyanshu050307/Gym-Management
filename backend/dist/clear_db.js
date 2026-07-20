import prisma from './config/prisma.js';
import logger from './config/logger.js';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
async function main() {
    logger.info('Database cleanup started...');
    try {
        // Delete in reverse dependency order to avoid foreign key violations
        await prisma.$transaction([
            prisma.payment.deleteMany(),
            prisma.subscription.deleteMany(),
            prisma.classBooking.deleteMany(),
            prisma.groupClass.deleteMany(),
            prisma.checkIn.deleteMany(),
            prisma.supplementSale.deleteMany(),
            prisma.supplement.deleteMany(),
            prisma.equipment.deleteMany(),
            prisma.trainerFeedback.deleteMany(),
            prisma.progressLog.deleteMany(),
            prisma.dietMeal.deleteMany(),
            prisma.dietPlan.deleteMany(),
            prisma.workoutExercise.deleteMany(),
            prisma.workoutDay.deleteMany(),
            prisma.workoutPlan.deleteMany(),
            prisma.forgotPasswordToken.deleteMany(),
            prisma.notification.deleteMany(),
            prisma.saaSSubscription.deleteMany(),
            prisma.member.deleteMany(),
            prisma.trainer.deleteMany(),
            prisma.membershipPlan.deleteMany(),
            prisma.user.deleteMany(),
            prisma.branch.deleteMany(),
        ]);
        logger.info('Database cleared successfully.');
        logger.info('Seeding default Admin and initial Branch...');
        // 1. Create a default Branch
        const branch = await prisma.branch.create({
            data: {
                name: 'Main Branch',
                address: '123 Gym Street, HQ',
                phone: '1234567890',
            },
        });
        // 2. Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('password123', salt);
        // 3. Create Admin Account
        const adminUser = await prisma.user.create({
            data: {
                email: 'admin@gym.com',
                passwordHash,
                firstName: 'System',
                lastName: 'Administrator',
                role: UserRole.ADMIN,
                branchId: branch.id,
            },
        });
        // 4. Update branch owner
        await prisma.branch.update({
            where: { id: branch.id },
            data: { ownerId: adminUser.id },
        });
        // 5. Create SaaS trial subscription for the admin
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);
        await prisma.saaSSubscription.create({
            data: {
                ownerId: adminUser.id,
                status: 'TRIAL_ACTIVE',
                planName: 'Starter',
                trialEndDate,
            },
        });
        logger.info('Database cleaned and default Admin seeded successfully!');
        console.log('\n======================================');
        console.log('Database Cleared & Initialized!');
        console.log('Default Admin Credentials:');
        console.log('Email: admin@gym.com');
        console.log('Password: password123');
        console.log('======================================\n');
    }
    catch (err) {
        logger.error('Database cleanup and initialization failed', { error: err.message, stack: err.stack });
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
