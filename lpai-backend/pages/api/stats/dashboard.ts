// pages/api/stats/dashboard.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { 
  sendSuccess, 
  sendError, 
  sendValidationError,
  sendServerError,
  sendMethodNotAllowed 
} from '../../../src/utils/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }
  
  const client = await clientPromise;
  const db = client.db('lpai');
  
  return await getDashboardStats(db, req.query, res);
}

async function getDashboardStats(db: any, query: any, res: NextApiResponse) {
  try {
    const { locationId, period = 'month', userId, teamView = 'false' } = query;
    
    if (!locationId) {
      return sendValidationError(res, { locationId: 'Missing locationId' });
    }
    
    // Calculate date ranges based on period
    const now = new Date();
    const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(period, now);
    
    // Build base filters
    const baseFilter: any = { locationId };
    const userFilter: any = userId ? { ...baseFilter, userId } : baseFilter;
    
    // Run all aggregations in parallel for performance
    const [
      projectStats,
      quoteStats,
      revenueStats,
      appointmentStats,
      taskStats,
      conversationStats,
      teamStats
    ] = await Promise.all([
      getProjectStats(db, baseFilter, userFilter, currentStart, currentEnd, previousStart, previousEnd),
      getQuoteStats(db, baseFilter, userFilter, currentStart, currentEnd, previousStart, previousEnd),
      getRevenueStats(db, baseFilter, userFilter, currentStart, currentEnd, previousStart, previousEnd),
      getAppointmentStats(db, baseFilter, userFilter, currentStart, currentEnd, previousStart, previousEnd),
      getTaskStats(db, baseFilter, userFilter, currentStart, currentEnd),
      getConversationStats(db, baseFilter, userFilter, currentStart, currentEnd),
      teamView === 'true' ? getTeamStats(db, baseFilter, currentStart, currentEnd) : null
    ]);
    
    // Compile response
    const stats = {
      period: {
        type: period,
        current: {
          start: currentStart.toISOString(),
          end: currentEnd.toISOString()
        },
        previous: {
          start: previousStart.toISOString(),
          end: previousEnd.toISOString()
        }
      },
      projects: projectStats,
      quotes: quoteStats,
      revenue: revenueStats,
      appointments: appointmentStats,
      tasks: taskStats,
      conversations: conversationStats,
      ...(teamView === 'true' && teamStats ? { team: teamStats } : {})
    };
    
    return sendSuccess(res, stats, 'Dashboard statistics retrieved successfully');
    
  } catch (error) {
    console.error('[STATS API] Error fetching dashboard stats:', error);
    return sendServerError(res, error, 'Failed to fetch dashboard statistics');
  }
}

// Helper function to calculate date ranges
function getDateRanges(period: string, now: Date) {
  let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;
  
  switch (period) {
    case 'week':
      // Current week (Monday to Sunday)
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      currentStart = new Date(now);
      currentStart.setDate(now.getDate() - daysToMonday);
      currentStart.setHours(0, 0, 0, 0);
      
      currentEnd = new Date(currentStart);
      currentEnd.setDate(currentStart.getDate() + 6);
      currentEnd.setHours(23, 59, 59, 999);
      
      // Previous week
      previousStart = new Date(currentStart);
      previousStart.setDate(currentStart.getDate() - 7);
      previousEnd = new Date(currentEnd);
      previousEnd.setDate(currentEnd.getDate() - 7);
      break;
      
    case 'month':
      // Current month
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Previous month
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
      
    case 'year':
      // Current year
      currentStart = new Date(now.getFullYear(), 0, 1);
      currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      
      // Previous year
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      break;
      
    default:
      // Default to month
      return getDateRanges('month', now);
  }
  
  return { currentStart, currentEnd, previousStart, previousEnd };
}

// Get project statistics
async function getProjectStats(
  db: any, 
  baseFilter: any, 
  userFilter: any,
  currentStart: Date, 
  currentEnd: Date, 
  previousStart: Date, 
  previousEnd: Date
) {
  // Total counts
  const [total, byStatus] = await Promise.all([
    db.collection('projects').countDocuments({ ...userFilter, status: { $ne: 'Deleted' } }),
    db.collection('projects').aggregate([
      { $match: { ...userFilter, status: { $ne: 'Deleted' } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray()
  ]);
  
  // Current period
  const currentPeriod = await db.collection('projects').countDocuments({
    ...userFilter,
    createdAt: { $gte: currentStart, $lte: currentEnd },
    status: { $ne: 'Deleted' }
  });
  
  // Previous period
  const previousPeriod = await db.collection('projects').countDocuments({
    ...userFilter,
    createdAt: { $gte: previousStart, $lte: previousEnd },
    status: { $ne: 'Deleted' }
  });
  
  // Calculate growth
  const growth = previousPeriod > 0 
    ? ((currentPeriod - previousPeriod) / previousPeriod * 100).toFixed(1)
    : currentPeriod > 0 ? 100 : 0;
  
  // Format status breakdown
  const statusBreakdown = Object.fromEntries(
    byStatus.map(s => [s._id || 'unknown', s.count])
  );
  
  return {
    total,
    active: statusBreakdown.open || 0,
    completed: statusBreakdown.won || 0,
    byStatus: statusBreakdown,
    thisPeriod: currentPeriod,
    lastPeriod: previousPeriod,
    growth: parseFloat(growth)
  };
}

// Get quote statistics
async function getQuoteStats(
  db: any,
  baseFilter: any,
  userFilter: any,
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
) {
  // Aggregate quote stats
  const stats = await db.collection('quotes').aggregate([
    { $match: { ...userFilter, status: { $ne: 'deleted' } } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              totalValue: { $sum: '$total' },
              sent: { $sum: { $cond: [{ $in: ['$status', ['published', 'viewed', 'signed']] }, 1, 0] } },
              signed: { $sum: { $cond: [{ $eq: ['$status', 'signed'] }, 1, 0] } },
              signedValue: { $sum: { $cond: [{ $eq: ['$status', 'signed'] }, '$total', 0] } }
            }
          }
        ],
        currentPeriod: [
          {
            $match: {
              createdAt: { $gte: currentStart.toISOString(), $lte: currentEnd.toISOString() }
            }
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              value: { $sum: '$total' }
            }
          }
        ],
        previousPeriod: [
          {
            $match: {
              createdAt: { $gte: previousStart.toISOString(), $lte: previousEnd.toISOString() }
            }
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              value: { $sum: '$total' }
            }
          }
        ]
      }
    }
  ]).toArray();
  
  const totals = stats[0]?.totals[0] || { total: 0, totalValue: 0, sent: 0, signed: 0, signedValue: 0 };
  const current = stats[0]?.currentPeriod[0] || { count: 0, value: 0 };
  const previous = stats[0]?.previousPeriod[0] || { count: 0, value: 0 };
  
  const conversionRate = totals.sent > 0 
    ? (totals.signed / totals.sent * 100).toFixed(1)
    : 0;
    
  const averageValue = totals.total > 0
    ? Math.round(totals.totalValue / totals.total)
    : 0;
  
  return {
    total: totals.total,
    sent: totals.sent,
    signed: totals.signed,
    totalValue: totals.totalValue,
    averageValue,
    conversionRate: parseFloat(conversionRate),
    thisPeriod: {
      count: current.count,
      value: current.value
    },
    lastPeriod: {
      count: previous.count,
      value: previous.value
    },
    growth: previous.value > 0 
      ? parseFloat(((current.value - previous.value) / previous.value * 100).toFixed(1))
      : current.value > 0 ? 100 : 0
  };
}

// Get revenue statistics
async function getRevenueStats(
  db: any,
  baseFilter: any,
  userFilter: any,
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
) {
  // Aggregate payment stats
  const stats = await db.collection('payments').aggregate([
    { $match: { ...baseFilter, status: 'completed' } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ],
        pending: [
          { $match: { status: 'pending' } },
          {
            $group: {
              _id: null,
              amount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ],
        currentPeriod: [
          {
            $match: {
              completedAt: { $gte: currentStart, $lte: currentEnd }
            }
          },
          {
            $group: {
              _id: null,
              amount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ],
        previousPeriod: [
          {
            $match: {
              completedAt: { $gte: previousStart, $lte: previousEnd }
            }
          },
          {
            $group: {
              _id: null,
              amount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ],
        byType: [
          {
            $group: {
              _id: '$type',
              amount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ]
      }
    }
  ]).toArray();
  
  const totals = stats[0]?.totals[0] || { total: 0, count: 0 };
  const pending = stats[0]?.pending[0] || { amount: 0, count: 0 };
  const current = stats[0]?.currentPeriod[0] || { amount: 0, count: 0 };
  const previous = stats[0]?.previousPeriod[0] || { amount: 0, count: 0 };
  const byType = Object.fromEntries(
    (stats[0]?.byType || []).map(t => [t._id || 'unknown', { amount: t.amount, count: t.count }])
  );
  
  // Get total invoiced amount
  const invoicedAmount = await db.collection('invoices').aggregate([
    { $match: baseFilter },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]).toArray();
  
  const totalInvoiced = invoicedAmount[0]?.total || 0;
  
  return {
    total: totals.total,
    collected: totals.total,
    pending: pending.amount,
    invoiced: totalInvoiced,
    collectionRate: totalInvoiced > 0 
      ? parseFloat(((totals.total / totalInvoiced) * 100).toFixed(1))
      : 0,
    thisPeriod: current.amount,
    lastPeriod: previous.amount,
    growth: previous.amount > 0 
      ? parseFloat(((current.amount - previous.amount) / previous.amount * 100).toFixed(1))
      : current.amount > 0 ? 100 : 0,
    byType
  };
}

// Get appointment statistics
async function getAppointmentStats(
  db: any,
  baseFilter: any,
  userFilter: any,
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
) {
  const now = new Date();
  
  // Aggregate appointment stats
  const stats = await db.collection('appointments').aggregate([
    { $match: userFilter },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
              noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } }
            }
          }
        ],
        upcoming: [
          { $match: { start: { $gte: now }, status: { $ne: 'cancelled' } } },
          { $count: 'count' }
        ],
        currentPeriod: [
          {
            $match: {
              start: { $gte: currentStart, $lte: currentEnd }
            }
          },
          { $count: 'count' }
        ],
        previousPeriod: [
          {
            $match: {
              start: { $gte: previousStart, $lte: previousEnd }
            }
          },
          { $count: 'count' }
        ]
      }
    }
  ]).toArray();
  
  const totals = stats[0]?.totals[0] || { total: 0, completed: 0, cancelled: 0, noShow: 0 };
  const upcoming = stats[0]?.upcoming[0]?.count || 0;
  const current = stats[0]?.currentPeriod[0]?.count || 0;
  const previous = stats[0]?.previousPeriod[0]?.count || 0;
  
  const completionRate = totals.total > 0
    ? parseFloat(((totals.completed / totals.total) * 100).toFixed(1))
    : 0;
  
  return {
    total: totals.total,
    completed: totals.completed,
    cancelled: totals.cancelled,
    noShow: totals.noShow,
    upcoming,
    completionRate,
    thisPeriod: current,
    lastPeriod: previous,
    growth: previous > 0 
      ? parseFloat(((current - previous) / previous * 100).toFixed(1))
      : current > 0 ? 100 : 0
  };
}

// Get task statistics
async function getTaskStats(
  db: any,
  baseFilter: any,
  userFilter: any,
  currentStart: Date,
  currentEnd: Date
) {
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const todayEnd = new Date(now.setHours(23, 59, 59, 999));
  
  const stats = await db.collection('tasks').aggregate([
    { $match: { ...userFilter, deleted: { $ne: true } } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              completed: { $sum: { $cond: ['$completed', 1, 0] } },
              pending: { $sum: { $cond: ['$completed', 0, 1] } }
            }
          }
        ],
        overdue: [
          {
            $match: {
              completed: false,
              dueDate: { $lt: todayStart }
            }
          },
          { $count: 'count' }
        ],
        dueToday: [
          {
            $match: {
              completed: false,
              dueDate: { $gte: todayStart, $lte: todayEnd }
            }
          },
          { $count: 'count' }
        ],
        completedThisPeriod: [
          {
            $match: {
              completedAt: { $gte: currentStart, $lte: currentEnd }
            }
          },
          { $count: 'count' }
        ]
      }
    }
  ]).toArray();
  
  const totals = stats[0]?.totals[0] || { total: 0, completed: 0, pending: 0 };
  const overdue = stats[0]?.overdue[0]?.count || 0;
  const dueToday = stats[0]?.dueToday[0]?.count || 0;
  const completedThisPeriod = stats[0]?.completedThisPeriod[0]?.count || 0;
  
  return {
    total: totals.total,
    completed: totals.completed,
    pending: totals.pending,
    overdue,
    dueToday,
    completedThisPeriod,
    completionRate: totals.total > 0
      ? parseFloat(((totals.completed / totals.total) * 100).toFixed(1))
      : 0
  };
}

// Get conversation statistics
async function getConversationStats(
  db: any,
  baseFilter: any,
  userFilter: any,
  currentStart: Date,
  currentEnd: Date
) {
  const stats = await db.collection('conversations').aggregate([
    { $match: baseFilter },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              unread: { $sum: { $cond: [{ $gt: ['$unreadCount', 0] }, 1, 0] } },
              starred: { $sum: { $cond: ['$starred', 1, 0] } }
            }
          }
        ],
        byType: [
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
              unread: { $sum: { $cond: [{ $gt: ['$unreadCount', 0] }, 1, 0] } }
            }
          }
        ],
        recentActivity: [
          {
            $match: {
              lastMessageAt: { $gte: currentStart, $lte: currentEnd }
            }
          },
          { $count: 'count' }
        ]
      }
    }
  ]).toArray();
  
  const totals = stats[0]?.totals[0] || { total: 0, unread: 0, starred: 0 };
  const byType = Object.fromEntries(
    (stats[0]?.byType || []).map(t => [
      t._id || 'unknown', 
      { count: t.count, unread: t.unread }
    ])
  );
  const recentActivity = stats[0]?.recentActivity[0]?.count || 0;
  
  return {
    total: totals.total,
    unread: totals.unread,
    starred: totals.starred,
    byType,
    activeThisPeriod: recentActivity,
    responseRate: totals.total > 0
      ? parseFloat((((totals.total - totals.unread) / totals.total) * 100).toFixed(1))
      : 100
  };
}

// Get team performance statistics
async function getTeamStats(
  db: any,
  baseFilter: any,
  currentStart: Date,
  currentEnd: Date
) {
  // Get all users for this location
  const users = await db.collection('users').find({
    locationId: baseFilter.locationId,
    role: { $ne: 'admin' } // Exclude admins from leaderboard
  }).toArray();
  
  // Get performance metrics for each user
  const userPerformance = await Promise.all(
    users.map(async (user) => {
      const userFilter = { ...baseFilter, userId: user.userId };
      
      // Get metrics for this user
      const [projects, quotes, revenue, appointments, tasks] = await Promise.all([
        // Projects won
        db.collection('projects').countDocuments({
          ...userFilter,
          status: 'won',
          updatedAt: { $gte: currentStart, $lte: currentEnd }
        }),
        
        // Quotes signed
        db.collection('quotes').aggregate([
          {
            $match: {
              ...userFilter,
              status: 'signed',
              signedAt: { $gte: currentStart.toISOString(), $lte: currentEnd.toISOString() }
            }
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              value: { $sum: '$total' }
            }
          }
        ]).toArray(),
        
        // Revenue collected
        db.collection('payments').aggregate([
          {
            $match: {
              ...baseFilter,
              createdBy: user._id.toString(),
              status: 'completed',
              completedAt: { $gte: currentStart, $lte: currentEnd }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' }
            }
          }
        ]).toArray(),
        
        // Appointments completed
        db.collection('appointments').countDocuments({
          ...userFilter,
          status: 'completed',
          end: { $gte: currentStart, $lte: currentEnd }
        }),
        
        // Tasks completed
        db.collection('tasks').countDocuments({
          assignedTo: user.userId,
          locationId: baseFilter.locationId,
          completed: true,
          completedAt: { $gte: currentStart, $lte: currentEnd }
        })
      ]);
      
      const quoteStats = quotes[0] || { count: 0, value: 0 };
      const revenueTotal = revenue[0]?.total || 0;
      
      return {
        userId: user.userId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        metrics: {
          projectsWon: projects,
          quotesSigned: quoteStats.count,
          quotesValue: quoteStats.value,
          revenueCollected: revenueTotal,
          appointmentsCompleted: appointments,
          tasksCompleted: tasks,
          // Calculate a simple score for ranking
          score: (projects * 100) + (quoteStats.count * 50) + (revenueTotal / 100) + (appointments * 10) + (tasks * 5)
        }
      };
    })
  );
  
  // Sort by score and get top performers
  const leaderboard = userPerformance
    .sort((a, b) => b.metrics.score - a.metrics.score)
    .slice(0, 10); // Top 10
  
  // Find top performer
  const topPerformer = leaderboard[0] || null;
  
  // Calculate team totals
  const teamTotals = userPerformance.reduce((acc, user) => ({
    projectsWon: acc.projectsWon + user.metrics.projectsWon,
    quotesSigned: acc.quotesSigned + user.metrics.quotesSigned,
    quotesValue: acc.quotesValue + user.metrics.quotesValue,
    revenueCollected: acc.revenueCollected + user.metrics.revenueCollected,
    appointmentsCompleted: acc.appointmentsCompleted + user.metrics.appointmentsCompleted,
    tasksCompleted: acc.tasksCompleted + user.metrics.tasksCompleted
  }), {
    projectsWon: 0,
    quotesSigned: 0,
    quotesValue: 0,
    revenueCollected: 0,
    appointmentsCompleted: 0,
    tasksCompleted: 0
  });
  
  return {
    activeUsers: users.length,
    topPerformer: topPerformer ? {
      name: topPerformer.name,
      revenue: topPerformer.metrics.revenueCollected,
      projects: topPerformer.metrics.projectsWon
    } : null,
    leaderboard: leaderboard.map(user => ({
      userId: user.userId,
      name: user.name,
      avatar: user.avatar,
      ...user.metrics
    })),
    teamTotals
  };
}