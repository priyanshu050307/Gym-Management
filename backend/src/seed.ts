import { PrismaClient, UserRole, MemberStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 1. Clean existing database
  console.log('Cleaning old records...');
  await prisma.supplementSale.deleteMany({});
  await prisma.supplement.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.trainerFeedback.deleteMany({});
  await prisma.progressLog.deleteMany({});
  await prisma.dietPlan.deleteMany({});
  await prisma.workoutPlan.deleteMany({});
  await prisma.classBooking.deleteMany({});
  await prisma.groupClass.deleteMany({});
  await prisma.checkIn.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.membershipPlan.deleteMany({});
  await prisma.trainer.deleteMany({});
  await prisma.member.deleteMany({});
  await prisma.forgotPasswordToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.branch.deleteMany({});

  console.log('Database cleared.');

  // Common password hash
  const passwordHash = await bcrypt.hash('password123', 10);

  // 2. Create 10 Branches
  console.log('Creating 10 branches...');
  const branchesData = [
    { name: 'Downtown Gym & Fitness', address: '123 Main St, Downtown', phone: '9876543210', gstNo: 'GST0123456789' },
    { name: 'Uptown Premium Health', address: '456 High St, Uptown', phone: '9876543211', gstNo: 'GST0123456790' },
    { name: 'Westside Flex Studio', address: '789 West Rd, Westside', phone: '9876543212', gstNo: 'GST0123456791' },
    { name: 'Eastside Strength Hub', address: '101 East Blvd, Eastside', phone: '9876543213', gstNo: 'GST0123456792' },
    { name: 'Southside CrossFit Center', address: '202 South Ave, Southside', phone: '9876543214', gstNo: 'GST0123456793' },
    { name: 'Northside Cardio Arena', address: '303 North Lane, Northside', phone: '9876543215', gstNo: 'GST0123456794' },
    { name: 'Metro Elite Fitness', address: '404 Metro Plz, Central', phone: '9876543216', gstNo: 'GST0123456795' },
    { name: 'Platinum Iron Cave', address: '505 Platinum Way, Industrial', phone: '9876543217', gstNo: 'GST0123456796' },
    { name: 'Flex & Flow Yoga Studio', address: '606 Serenity Blvd, Green Valley', phone: '9876543218', gstNo: 'GST0123456797' },
    { name: 'Titan Powerhouse Gym', address: '707 Strength Rd, Sector 15', phone: '9876543219', gstNo: 'GST0123456798' },
  ];

  const branches = [];
  for (const b of branchesData) {
    const branch = await prisma.branch.create({ data: b });
    branches.push(branch);
  }
  console.log(`Created ${branches.length} branches.`);

  // 3. Create Admin Account
  console.log('Creating Admin account...');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@gym.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: UserRole.ADMIN,
      branchId: branches[0].id,
    },
  });
  console.log('Admin account created: admin@gym.com');

  // Set all seeded branches as owned by the default admin
  await prisma.branch.updateMany({
    where: { ownerId: null },
    data: { ownerId: adminUser.id },
  });

  // Create SaaS trial subscription for the default admin
  const adminTrialEnd = new Date();
  adminTrialEnd.setDate(adminTrialEnd.getDate() + 30);
  await prisma.saaSSubscription.create({
    data: {
      ownerId: adminUser.id,
      status: 'TRIAL_ACTIVE',
      planName: 'Starter',
      trialEndDate: adminTrialEnd,
      billingCycle: 'MONTHLY',
    },
  });
  console.log('SaaS trial subscription created for admin.');

  // 4. Create 10 Staff Users
  console.log('Creating 10 staff members...');
  const staffList = [];
  for (let i = 1; i <= 10; i++) {
    const branchIndex = (i - 1) % branches.length;
    const staff = await prisma.user.create({
      data: {
        email: `staff${i}@gym.com`,
        passwordHash,
        firstName: `Staff`,
        lastName: `Member ${i}`,
        role: UserRole.STAFF,
        branchId: branches[branchIndex].id,
      },
    });
    staffList.push(staff);
  }

  // 5. Create 10 Trainers (and linked Trainer profiles) - 1 for each branch
  console.log('Creating 10 trainers...');
  const trainers = [];
  for (let i = 1; i <= 10; i++) {
    const branchIndex = i - 1;
    const trainerUser = await prisma.user.create({
      data: {
        email: `trainer${i}@gym.com`,
        passwordHash,
        firstName: `Trainer`,
        lastName: `Pro ${i}`,
        role: UserRole.TRAINER,
        branchId: branches[branchIndex].id,
      },
    });

    const trainer = await prisma.trainer.create({
      data: {
        userId: trainerUser.id,
        firstName: trainerUser.firstName,
        lastName: trainerUser.lastName,
        specialty: i % 2 === 0 ? 'Strength & Conditioning' : 'Weight Loss & Yoga',
        email: trainerUser.email,
        phone: `987654321${i - 1}`,
      },
    });
    trainers.push(trainer);
  }

  // 6. Create 10 Members per Branch (100 members total), 5 with PT in each branch
  console.log('Creating 100 members (10 per branch)...');
  const members = [];
  let memberCount = 1;
  for (let b = 0; b < branches.length; b++) {
    const branch = branches[b];
    // Find trainer in this branch (1-to-1 matching index)
    const branchTrainer = trainers[b];

    for (let m = 1; m <= 10; m++) {
      // 5 members in this branch get PT (trainerId set), 5 don't (trainerId null)
      const trainerId = m <= 5 && branchTrainer ? branchTrainer.id : null;

      const memberUser = await prisma.user.create({
        data: {
          email: `member${memberCount}@gym.com`,
          passwordHash,
          firstName: `Member`,
          lastName: `${memberCount}`,
          role: UserRole.MEMBER,
          branchId: branch.id,
        },
      });

      const member = await prisma.member.create({
        data: {
          userId: memberUser.id,
          status: MemberStatus.ACTIVE,
          emergencyContact: `999998888${memberCount % 10}`,
          medicalHistory: 'No major health risks.',
          trainerId: trainerId,
        },
        include: {
          user: true
        }
      });
      members.push(member);
      memberCount++;
    }
  }
  console.log(`Created ${members.length} members total.`);

  // 7. Create 10 Membership Plans
  console.log('Creating 10 membership plans...');
  const plansData = [
    { name: 'Basic Monthly', durationMonths: 1, price: 1500, description: 'Access to cardio and weights.' },
    { name: 'Premium Quarterly', durationMonths: 3, price: 4000, description: 'Access to gym + steam room.' },
    { name: 'VIP Annual Power', durationMonths: 12, price: 12000, description: 'Full access + locker + free shirt.' },
    { name: 'Strength Specialist', durationMonths: 2, price: 3000, description: 'Powerlifting zone access.' },
    { name: 'Yoga & Pilates', durationMonths: 1, price: 1800, description: 'Unlimited classes for group yoga.' },
    { name: 'Cardio Blast Pro', durationMonths: 6, price: 7500, description: 'Treadmill, spin, and HIIT zone.' },
    { name: 'Weekend Warrior', durationMonths: 3, price: 2500, description: 'Access on Saturday & Sunday only.' },
    { name: 'Student Discount Pack', durationMonths: 1, price: 1000, description: 'Valid student ID card required.' },
    { name: 'Corporate Elite Pass', durationMonths: 12, price: 10000, description: 'Special corporate group access.' },
    { name: 'Pilates Core Focus', durationMonths: 1, price: 2000, description: 'Specialized reformer training.' },
  ];

  const plans = [];
  for (const p of plansData) {
    const plan = await prisma.membershipPlan.create({ data: p });
    plans.push(plan);
  }

  // 8. Create Subscriptions for all 100 members
  console.log('Creating subscriptions...');
  const subscriptions = [];
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const plan = plans[i % plans.length];
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(startDate.getMonth() + plan.durationMonths);

    const sub = await prisma.subscription.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        startDate,
        endDate,
        status: 'ACTIVE',
      },
    });
    subscriptions.push(sub);
  }

  // 9. Create Payments for all subscriptions
  console.log('Creating payment receipts...');
  const payments = [];
  for (let i = 0; i < subscriptions.length; i++) {
    const sub = subscriptions[i];
    const plan = plans[i % plans.length];

    const payment = await prisma.payment.create({
      data: {
        subscriptionId: sub.id,
        amount: plan.price,
        status: 'PAID',
        method: i % 2 === 0 ? 'CARD' : 'UPI',
      },
    });
    payments.push(payment);
  }

  // 10. Create 10 Group Classes
  console.log('Creating 10 group classes...');
  const classesData = [
    { name: 'Morning Vinyasa Yoga', capacity: 20, scheduleTime: '07:00' },
    { name: 'HIIT Fat Burning', capacity: 15, scheduleTime: '08:30' },
    { name: 'Power Weightlifting', capacity: 10, scheduleTime: '10:00' },
    { name: 'Zumba Dance Fitness', capacity: 25, scheduleTime: '11:30' },
    { name: 'Pilates Reformer Core', capacity: 12, scheduleTime: '14:00' },
    { name: 'Spin Cycle Marathon', capacity: 18, scheduleTime: '16:00' },
    { name: 'Boxing & MMA Basics', capacity: 15, scheduleTime: '17:30' },
    { name: 'Evening Flow Yoga', capacity: 20, scheduleTime: '19:00' },
    { name: 'Flexibility & Stretching', capacity: 15, scheduleTime: '20:00' },
    { name: 'CrossFit WOD', capacity: 12, scheduleTime: '21:00' },
  ];

  const classes = [];
  for (let i = 0; i < 10; i++) {
    const trainer = trainers[i];
    const cData = classesData[i];
    const [hour, minute] = cData.scheduleTime.split(':').map(Number);
    const classDate = new Date();
    classDate.setHours(hour, minute, 0, 0);

    const fitnessClass = await prisma.groupClass.create({
      data: {
        name: cData.name,
        capacity: cData.capacity,
        dateTime: classDate,
        trainerId: trainer.id,
      },
    });
    classes.push(fitnessClass);
  }

  // 11. Create Class Bookings (1 booking for each class)
  console.log('Creating class bookings...');
  const bookings = [];
  for (let i = 0; i < 10; i++) {
    const fitnessClass = classes[i];
    const member = members[i * 10]; // First member of each branch

    const booking = await prisma.classBooking.create({
      data: {
        classId: fitnessClass.id,
        memberId: member.id,
        status: 'CONFIRMED',
      },
    });
    bookings.push(booking);
  }

  // 12. Create Check-ins (Attendance)
  console.log('Creating check-ins...');
  const checkins = [];
  for (let i = 0; i < 10; i++) {
    const member = members[i * 10];
    const checkin = await prisma.checkIn.create({
      data: {
        memberId: member.id,
        timestamp: new Date(Date.now() - 3600 * 1000 * i),
      },
    });
    checkins.push(checkin);
  }

  // 13. Create Workout Plans for PT members (50 total)
  console.log('Creating workout plans for PT members...');
  const workoutPlans = [];
  const ptMembersList = members.filter(m => m.trainerId !== null);
  for (let i = 0; i < ptMembersList.length; i++) {
    const member = ptMembersList[i];
    const wp = await prisma.workoutPlan.create({
      data: {
        name: `PT Strength Plan - Member ${member.user.lastName}`,
        description: 'Personalized strength guide by trainer.',
        memberId: member.id,
        trainerId: member.trainerId,
        days: {
          create: [
            {
              dayOfWeek: 'MONDAY',
              exercises: {
                create: [
                  { name: 'Bench Press', sets: 4, reps: '10', notes: 'Warm up first' },
                  { name: 'Squats', sets: 4, reps: '8', notes: 'Keep back straight' },
                  { name: 'Deadlifts', sets: 3, reps: '5', notes: 'Increase weight slightly' },
                ]
              }
            }
          ]
        }
      },
    });
    workoutPlans.push(wp);
  }

  // 14. Create Diet Plans for PT members (50 total)
  console.log('Creating diet plans for PT members...');
  const dietPlans = [];
  for (let i = 0; i < ptMembersList.length; i++) {
    const member = ptMembersList[i];
    const dp = await prisma.dietPlan.create({
      data: {
        name: `PT Diet Plan - Member ${member.user.lastName}`,
        description: 'Macro balanced meal plan by trainer.',
        memberId: member.id,
        trainerId: member.trainerId,
        meals: {
          create: [
            {
              name: 'Breakfast',
              time: '08:00 AM',
              items: 'Oatmeal, 4 Egg Whites, 1 Banana',
              calories: 500,
              protein: 30,
              carbs: 60,
              fat: 10,
            },
            {
              name: 'Lunch',
              time: '01:30 PM',
              items: '200g Chicken Breast, 150g Brown Rice, Broccoli',
              calories: 700,
              protein: 50,
              carbs: 70,
              fat: 15,
            },
            {
              name: 'Dinner',
              time: '08:30 PM',
              items: '150g Grilled Salmon, Sweet Potato, Asparagus',
              calories: 600,
              protein: 40,
              carbs: 50,
              fat: 20,
            }
          ]
        }
      },
    });
    dietPlans.push(dp);
  }

  // 15. Create Progress Logs
  console.log('Creating progress logs...');
  const progressLogs = [];
  for (let i = 0; i < 10; i++) {
    const member = members[i * 10];
    const log = await prisma.progressLog.create({
      data: {
        memberId: member.id,
        weightKg: 70 + i * 2,
        bodyFat: 15 - i * 0.5,
        muscleMass: 35 + i * 0.8,
      },
    });
    progressLogs.push(log);
  }

  // 16. Create Trainer Feedbacks
  console.log('Creating trainer feedbacks...');
  const feedbacks = [];
  for (let i = 0; i < ptMembersList.length; i++) {
    if (i >= 10) break;
    const member = ptMembersList[i];
    const feedback = await prisma.trainerFeedback.create({
      data: {
        memberId: member.id,
        trainerId: member.trainerId!,
        rating: 5,
        feedback: `Excellent training session. Strongly recommend this trainer!`,
      },
    });
    feedbacks.push(feedback);
  }

  // 17. Create 10 Equipment Items
  console.log('Creating 10 equipment items...');
  const equipmentNames = [
    'Commercial Treadmill T80',
    'Olympus Dumbbell Rack',
    'Squat Cage Extreme',
    'Leg Press Machine v4',
    'Cable Crossover Double',
    'Stationary Spin Bike',
    'Kettlebell Set (4kg-24kg)',
    'Preacher Curl Bench',
    'Chest Fly Machine',
    'Rowing Ergometer Cardio',
  ];

  const equipments = [];
  for (let i = 0; i < 10; i++) {
    const branchIndex = i % branches.length;
    const equip = await prisma.equipment.create({
      data: {
        name: equipmentNames[i],
        quantity: 2 + i,
        status: i === 4 ? 'MAINTENANCE' : i === 7 ? 'BROKEN' : 'WORKING',
        lastServiced: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        notes: i === 4 ? 'Need wire replacements.' : i === 7 ? 'Broken base structure.' : 'Working fine.',
        branchId: branches[branchIndex].id,
      },
    });
    equipments.push(equip);
  }

  // 18. Create 10 Supplements
  console.log('Creating 10 supplements...');
  const supplementNames = [
    '100% Whey Protein Gold 2kg',
    'Creatine Monohydrate 250g',
    'Pre-Workout Energy Rush',
    'BCAA Recovery Blue Razz',
    'Daily Multivitamin 90 Tabs',
    'Mass Gainer Muscle Pack 3kg',
    'Fish Oil Omega-3 120 Caps',
    'ZMA Strength Recovery',
    'Whey Isolate Chocolate 1kg',
    'L-Carnitine Liquid Shot',
  ];

  const categories = ['PROTEIN', 'CREATINE', 'PREWORKOUT', 'VITAMINS', 'OTHER'];

  const supplements = [];
  for (let i = 0; i < 10; i++) {
    const branchIndex = i % branches.length;
    const cat = categories[i % categories.length];

    const supp = await prisma.supplement.create({
      data: {
        name: supplementNames[i],
        price: 800 + i * 350,
        stock: 5 + i * 3,
        description: `High-quality formula for sports nutrition and optimal workout gains. Category: ${cat}`,
        category: cat,
        branchId: branches[branchIndex].id,
      },
    });
    supplements.push(supp);
  }

  // 19. Create 10 Supplement Sales
  console.log('Creating 10 supplement sales...');
  const sales = [];
  for (let i = 0; i < 10; i++) {
    const supp = supplements[i];
    const member = members.find((m) => m.user.branchId === supp.branchId) || members[i];
    const qty = 1 + (i % 2);

    const sale = await prisma.supplementSale.create({
      data: {
        supplementId: supp.id,
        memberId: member.id,
        quantity: qty,
        soldPrice: i === 3 ? 0 : supp.price,
        saleType: i === 3 ? 'FREE_WITH_SUBSCRIPTION' : i === 6 ? 'ADDITIONAL_CHARGED' : 'PAID',
        notes: i === 3 ? 'Given as enrollment promotion.' : 'Standard counter sale checkout.',
        branchId: supp.branchId,
      },
    });

    await prisma.supplement.update({
      where: { id: supp.id },
      data: {
        stock: {
          decrement: qty,
        },
      },
    });

    sales.push(sale);
  }

  console.log('Database seeding successfully finished!');
  console.log('Credentials Summary:');
  console.log('====================');
  console.log('Admin Account:');
  console.log('Email: admin@gym.com');
  console.log('Password: password123');
  console.log('--------------------');
  console.log('Staff Accounts (10): staff1@gym.com to staff10@gym.com');
  console.log('Password: password123');
  console.log('--------------------');
  console.log('Trainer Accounts (10): trainer1@gym.com to trainer10@gym.com');
  console.log('Password: password123');
  console.log('--------------------');
  console.log('Member Accounts (100): member1@gym.com to member100@gym.com');
  console.log('Password: password123');
  console.log('====================');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
