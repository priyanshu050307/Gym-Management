import prisma from '../config/prisma.js';
export const generateSampleData = async (req, res) => {
    try {
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const activeBranchIdHeader = req.headers['x-branch-id'];
        const branchId = activeBranchIdHeader || reqUser.branchId;
        if (!branchId) {
            return res.status(400).json({ error: 'No active branch selected to populate sample data.' });
        }
        // 1. Create Sample Membership Plans if none exist
        const existingPlans = await prisma.membershipPlan.findMany({ where: { ownerId: reqUser.id } });
        let starterPlan = existingPlans[0];
        let proPlan = existingPlans[1];
        if (!starterPlan) {
            starterPlan = await prisma.membershipPlan.create({
                data: {
                    name: 'Monthly Fitness Pass',
                    price: 1500,
                    durationMonths: 1,
                    description: 'Access to gym floor, cardio equipment, and locker rooms.',
                    ownerId: reqUser.id,
                },
            });
        }
        if (!proPlan) {
            proPlan = await prisma.membershipPlan.create({
                data: {
                    name: 'Pro Performance Annual',
                    price: 12000,
                    durationMonths: 12,
                    description: 'Full facility access + 2 personal trainer consultations per month.',
                    ownerId: reqUser.id,
                },
            });
        }
        // 2. Create Sample Trainer
        const sampleTrainer = await prisma.trainer.create({
            data: {
                firstName: 'Alex',
                lastName: 'Fitness Pro',
                specialty: 'Hypertrophy & Weight Loss',
                email: `trainer_${Date.now()}@gymnasium.com`,
                phone: '+91 98765 43210',
            },
        });
        // 3. Create Sample Leads
        await prisma.lead.createMany({
            data: [
                {
                    name: 'Rahul Sharma',
                    email: 'rahul.s@example.com',
                    phone: '+91 91234 56789',
                    interestedPlanId: starterPlan.id,
                    status: 'NEW',
                    notes: 'Interested in evening slot after office hours',
                    branchId,
                },
                {
                    name: 'Priya Patel',
                    email: 'priya.p@example.com',
                    phone: '+91 92345 67890',
                    interestedPlanId: proPlan.id,
                    status: 'FOLLOWED_UP',
                    notes: 'Trial workout completed. Promised to enroll this weekend.',
                    followUpDate: new Date(Date.now() + 86400000 * 2),
                    branchId,
                },
                {
                    name: 'Vikram Verma',
                    email: 'vikram.v@example.com',
                    phone: '+91 93456 78901',
                    interestedPlanId: starterPlan.id,
                    status: 'CONVERTED',
                    notes: 'Joined annual plan.',
                    branchId,
                },
            ],
        });
        // 4. Create Sample Members with Check-Ins
        const sampleMembers = [
            { first: 'Aarav', last: 'Mehta', phone: '+91 98111 22233' },
            { first: 'Neha', last: 'Gupta', phone: '+91 98222 33344' },
            { first: 'Karan', last: 'Singh', phone: '+91 98333 44455' },
        ];
        const now = new Date();
        for (const m of sampleMembers) {
            const user = await prisma.user.create({
                data: {
                    firstName: m.first,
                    lastName: m.last,
                    email: `${m.first.toLowerCase()}.${m.last.toLowerCase()}_demo@example.com`,
                    phoneNumber: m.phone,
                    role: 'MEMBER',
                    branchId,
                    member: {
                        create: {
                            status: 'ACTIVE',
                            joinDate: new Date(now.getTime() - 86400000 * 30),
                            trainerId: sampleTrainer.id,
                        },
                    },
                },
                include: { member: true },
            });
            if (user.member) {
                // Create Subscription & Payment
                const sub = await prisma.subscription.create({
                    data: {
                        memberId: user.member.id,
                        planId: starterPlan.id,
                        startDate: new Date(now.getTime() - 86400000 * 30),
                        endDate: new Date(now.getTime() + 86400000 * 30),
                        status: 'ACTIVE',
                    },
                });
                await prisma.payment.create({
                    data: {
                        subscriptionId: sub.id,
                        amount: 1500,
                        status: 'PAID',
                        method: 'UPI',
                        paymentDate: new Date(now.getTime() - 86400000 * 30),
                    },
                });
                // Add 5 realistic check-ins spread across peak hours
                for (let i = 1; i <= 5; i++) {
                    const checkInTime = new Date(now.getTime() - 86400000 * (i * 3));
                    checkInTime.setHours(17 + (i % 3), 15, 0); // Evening 5-7 PM peak check-ins
                    await prisma.checkIn.create({
                        data: {
                            memberId: user.member.id,
                            timestamp: checkInTime,
                        },
                    });
                }
            }
        }
        // 5. Create Sample Payroll Record for Trainer
        await prisma.payroll.create({
            data: {
                trainerId: sampleTrainer.id,
                month: now.getMonth() + 1,
                year: now.getFullYear(),
                baseSalary: 25000,
                sessionCount: 15,
                sessionRate: 500,
                bonus: 2000,
                deductions: 500,
                totalAmount: 34000,
                status: 'PENDING',
                branchId,
                notes: 'Monthly salary + 15 Personal Training sessions',
            },
        });
        return res.status(201).json({
            message: 'Sample demo data generated successfully!',
            details: {
                plans: 2,
                leads: 3,
                members: 3,
                trainers: 1,
                checkIns: 15,
            },
        });
    }
    catch (error) {
        console.error('Generate sample data error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
