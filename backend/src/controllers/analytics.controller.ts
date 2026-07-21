import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { isSuperAdmin } from '../utils/superadmin.js';

export const getHeatmapData = async (req: Request, res: Response) => {
  try {
    const { branchId } = req.query;
    const activeBranchIdHeader = req.headers['x-branch-id'] as string | undefined;
    const reqUser = (req as any).user;
    if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

    const userRole = reqUser.role;
    const userBranchId = reqUser.branchId;
    const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId as string || activeBranchIdHeader)) || undefined;

    const whereClause: any = {};
    if (resolvedBranchId) {
      whereClause.member = { user: { branchId: resolvedBranchId } };
    } else {
      const ownedBranches = await prisma.branch.findMany({
        where: isSuperAdmin(reqUser) ? {
          OR: [{ ownerId: reqUser.id }, { ownerId: null }]
        } : { ownerId: reqUser.id },
        select: { id: true }
      });
      whereClause.member = { user: { branchId: { in: ownedBranches.map(b => b.id) } } };
    }

    const checkIns = await prisma.checkIn.findMany({
      where: whereClause,
      select: {
        timestamp: true,
      },
    });

    // Initialize 7 days x 24 hours grid
    // Day 0: Sun, 1: Mon, ..., 6: Sat
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let totalCheckIns = 0;

    checkIns.forEach(c => {
      const dt = new Date(c.timestamp);
      const day = dt.getDay(); // 0 - 6
      const hour = dt.getHours(); // 0 - 23
      matrix[day][hour] += 1;
      totalCheckIns += 1;
    });

    // Find peak hour and peak day
    let maxCount = 0;
    let peakDay = 1; // Mon default
    let peakHour = 18; // 6 PM default
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (matrix[d][h] > maxCount) {
          maxCount = matrix[d][h];
          peakDay = d;
          peakHour = h;
        }
      }
    }

    return res.status(200).json({
      matrix,
      totalCheckIns,
      peakTime: {
        day: dayNames[peakDay],
        hour: `${peakHour % 12 || 12}:00 ${peakHour >= 12 ? 'PM' : 'AM'}`,
        count: maxCount,
      },
    });
  } catch (error) {
    console.error('Get heatmap data error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRetentionMetrics = async (req: Request, res: Response) => {
  try {
    const { branchId } = req.query;
    const activeBranchIdHeader = req.headers['x-branch-id'] as string | undefined;
    const reqUser = (req as any).user;
    if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

    const userRole = reqUser.role;
    const userBranchId = reqUser.branchId;
    const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId as string || activeBranchIdHeader)) || undefined;

    const whereClause: any = {};
    if (resolvedBranchId) {
      whereClause.user = { branchId: resolvedBranchId };
    } else {
      const ownedBranches = await prisma.branch.findMany({
        where: isSuperAdmin(reqUser) ? {
          OR: [{ ownerId: reqUser.id }, { ownerId: null }]
        } : { ownerId: reqUser.id },
        select: { id: true }
      });
      whereClause.user = { branchId: { in: ownedBranches.map(b => b.id) } };
    }

    const members = await prisma.member.findMany({
      where: whereClause,
      select: {
        id: true,
        status: true,
        joinDate: true,
        expiryDate: true,
      },
    });

    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.status === 'ACTIVE').length;
    const inactiveMembers = members.filter(m => m.status === 'INACTIVE').length;
    const pausedMembers = members.filter(m => m.status === 'PAUSED').length;

    const retentionRate = totalMembers > 0 ? ((activeMembers / totalMembers) * 100).toFixed(1) : '100.0';
    const churnRate = totalMembers > 0 ? ((inactiveMembers / totalMembers) * 100).toFixed(1) : '0.0';

    // Monthly signups breakdown for last 6 months
    const monthlyStats: { month: string; signups: number; churned: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      
      const startOfMonth = new Date(year, d.getMonth(), 1);
      const endOfMonth = new Date(year, d.getMonth() + 1, 0, 23, 59, 59);

      const signups = members.filter(m => {
        const j = new Date(m.joinDate);
        return j >= startOfMonth && j <= endOfMonth;
      }).length;

      const churned = members.filter(m => {
        if (!m.expiryDate) return false;
        const e = new Date(m.expiryDate);
        return e >= startOfMonth && e <= endOfMonth && m.status === 'INACTIVE';
      }).length;

      monthlyStats.push({
        month: `${monthLabel} ${year.toString().slice(-2)}`,
        signups,
        churned,
      });
    }

    return res.status(200).json({
      totalMembers,
      activeMembers,
      inactiveMembers,
      pausedMembers,
      retentionRate: parseFloat(retentionRate),
      churnRate: parseFloat(churnRate),
      monthlyStats,
    });
  } catch (error) {
    console.error('Get retention metrics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
