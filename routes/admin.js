const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AILog = require('../models/AILog');
const { authenticateToken, authorize, logActivity } = require('../middleware/auth');
const { validatePagination, validateObjectId } = require('../middleware/validation');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Middleware para todas as rotas admin
router.use(authenticateToken);
router.use(authorize('admin'));

// GET /api/admin/dashboard - Dashboard administrativo
router.get('/dashboard',
  logActivity('admin_dashboard_view'),
  async (req, res) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Estatísticas de usuários
      const userStats = await User.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            active: [{ $match: { isActive: true } }, { $count: 'count' }],
            newThisMonth: [{ $match: { createdAt: { $gte: thirtyDaysAgo } } }, { $count: 'count' }],
            newThisWeek: [{ $match: { createdAt: { $gte: sevenDaysAgo } } }, { $count: 'count' }],
            newToday: [{ $match: { createdAt: { $gte: oneDayAgo } } }, { $count: 'count' }],
            byRole: [
              {
                $group: {
                  _id: '$role',
                  count: { $sum: 1 }
                }
              }
            ],
            topUsers: [
              { $match: { isActive: true } },
              { $sort: { totalCreditsUsed: -1 } },
              { $limit: 10 },
              {
                $project: {
                  username: 1,
                  email: 1,
                  totalCreditsUsed: 1,
                  credits: 1,
                  createdAt: 1
                }
              }
            ]
          }
        }
      ]);
      
      // Estatísticas de receita
      const revenueStats = await Transaction.aggregate([
        {
          $match: {
            type: { $in: ['credit_purchase', 'subscription'] },
            status: 'completed'
          }
        },
        {
          $facet: {
            total: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: '$amount' },
                  totalTransactions: { $sum: 1 }
                }
              }
            ],
            thisMonth: [
              { $match: { createdAt: { $gte: thirtyDaysAgo } } },
              {
                $group: {
                  _id: null,
                  revenue: { $sum: '$amount' },
                  transactions: { $sum: 1 }
                }
              }
            ],
            thisWeek: [
              { $match: { createdAt: { $gte: sevenDaysAgo } } },
              {
                $group: {
                  _id: null,
                  revenue: { $sum: '$amount' },
                  transactions: { $sum: 1 }
                }
              }
            ],
            today: [
              { $match: { createdAt: { $gte: oneDayAgo } } },
              {
                $group: {
                  _id: null,
                  revenue: { $sum: '$amount' },
                  transactions: { $sum: 1 }
                }
              }
            ],
            byPackage: [
              { $match: { createdAt: { $gte: thirtyDaysAgo } } },
              {
                $group: {
                  _id: '$package',
                  revenue: { $sum: '$amount' },
                  count: { $sum: 1 }
                }
              },
              { $sort: { revenue: -1 } }
            ]
          }
        }
      ]);
      
      // Estatísticas de IA
      const aiStats = await AILog.aggregate([
        {
          $match: {
            status: 'completed'
          }
        },
        {
          $facet: {
            total: [{ $count: 'count' }],
            thisMonth: [
              { $match: { createdAt: { $gte: thirtyDaysAgo } } },
              { $count: 'count' }
            ],
            thisWeek: [
              { $match: { createdAt: { $gte: sevenDaysAgo } } },
              { $count: 'count' }
            ],
            today: [
              { $match: { createdAt: { $gte: oneDayAgo } } },
              { $count: 'count' }
            ],
            byModel: [
              { $match: { createdAt: { $gte: thirtyDaysAgo } } },
              {
                $group: {
                  _id: '$model',
                  count: { $sum: 1 },
                  avgRating: { $avg: '$output.userRating' },
                  avgProcessingTime: { $avg: '$performance.processingTime' }
                }
              },
              { $sort: { count: -1 } }
            ],
            byType: [
              { $match: { createdAt: { $gte: thirtyDaysAgo } } },
              {
                $group: {
                  _id: '$requestType',
                  count: { $sum: 1 }
                }
              },
              { $sort: { count: -1 } }
            ]
          }
        }
      ]);
      
      // Estatísticas do sistema
      const systemStats = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform
      };
      
      res.json({
        success: true,
        data: {
          users: {
            total: userStats[0].total[0]?.count || 0,
            active: userStats[0].active[0]?.count || 0,
            newThisMonth: userStats[0].newThisMonth[0]?.count || 0,
            newThisWeek: userStats[0].newThisWeek[0]?.count || 0,
            newToday: userStats[0].newToday[0]?.count || 0,
            byRole: userStats[0].byRole,
            topUsers: userStats[0].topUsers
          },
          revenue: {
            total: revenueStats[0].total[0] || { totalRevenue: 0, totalTransactions: 0 },
            thisMonth: revenueStats[0].thisMonth[0] || { revenue: 0, transactions: 0 },
            thisWeek: revenueStats[0].thisWeek[0] || { revenue: 0, transactions: 0 },
            today: revenueStats[0].today[0] || { revenue: 0, transactions: 0 },
            byPackage: revenueStats[0].byPackage
          },
          ai: {
            total: aiStats[0].total[0]?.count || 0,
            thisMonth: aiStats[0].thisMonth[0]?.count || 0,
            thisWeek: aiStats[0].thisWeek[0]?.count || 0,
            today: aiStats[0].today[0]?.count || 0,
            byModel: aiStats[0].byModel,
            byType: aiStats[0].byType
          },
          system: systemStats
        }
      });
      
    } catch (error) {
      console.error('Erro no dashboard admin:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/admin/users - Gerenciar usuários
router.get('/users',
  validatePagination,
  logActivity('admin_users_list'),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      const filter = {};
      
      // Filtros
      if (req.query.role) filter.role = req.query.role;
      if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
      if (req.query.emailVerified !== undefined) filter.emailVerified = req.query.emailVerified === 'true';
      
      if (req.query.search) {
        filter.$or = [
          { username: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
          { firstName: { $regex: req.query.search, $options: 'i' } },
          { lastName: { $regex: req.query.search, $options: 'i' } }
        ];
      }
      
      const users = await User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-password -emailVerificationToken -passwordResetToken -twoFactorSecret');
      
      const total = await User.countDocuments(filter);
      
      res.json({
        success: true,
        data: {
          users,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });
      
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// PUT /api/admin/users/:id - Atualizar usuário
router.put('/users/:id',
  validateObjectId('id'),
  [
    body('role').optional().isIn(['user', 'premium', 'admin']).withMessage('Role inválido'),
    body('isActive').optional().isBoolean().withMessage('isActive deve ser booleano'),
    body('emailVerified').optional().isBoolean().withMessage('emailVerified deve ser booleano'),
    body('credits').optional().isInt({ min: 0 }).withMessage('Créditos devem ser um número positivo')
  ],
  logActivity('admin_user_update'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }
      
      const { id } = req.params;
      const allowedUpdates = ['role', 'isActive', 'emailVerified', 'credits'];
      
      const updates = {};
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });
      
      const user = await User.findByIdAndUpdate(
        id,
        updates,
        { new: true, runValidators: true }
      ).select('-password -emailVerificationToken -passwordResetToken -twoFactorSecret');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }
      
      res.json({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: { user }
      });
      
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// DELETE /api/admin/users/:id - Deletar usuário
router.delete('/users/:id',
  validateObjectId('id'),
  logActivity('admin_user_delete'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }
      
      // Soft delete
      user.isActive = false;
      user.email = `deleted_${Date.now()}_${user.email}`;
      user.username = `deleted_${Date.now()}_${user.username}`;
      await user.save();
      
      res.json({
        success: true,
        message: 'Usuário deletado com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/admin/transactions - Gerenciar transações
router.get('/transactions',
  validatePagination,
  logActivity('admin_transactions_list'),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      const filter = {};
      
      // Filtros
      if (req.query.type) filter.type = req.query.type;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.userId) filter.user = req.query.userId;
      
      if (req.query.startDate || req.query.endDate) {
        filter.createdAt = {};
        if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
        if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
      }
      
      const transactions = await Transaction.find(filter)
        .populate('user', 'username email firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-paymentProvider.metadata');
      
      const total = await Transaction.countDocuments(filter);
      
      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });
      
    } catch (error) {
      console.error('Erro ao listar transações:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// PUT /api/admin/transactions/:id/refund - Processar reembolso
router.put('/transactions/:id/refund',
  validateObjectId('id'),
  [
    body('reason').notEmpty().withMessage('Motivo do reembolso é obrigatório'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('Valor deve ser positivo')
  ],
  logActivity('admin_transaction_refund'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }
      
      const { id } = req.params;
      const { reason, amount } = req.body;
      
      const transaction = await Transaction.findById(id).populate('user');
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transação não encontrada'
        });
      }
      
      if (transaction.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Apenas transações completas podem ser reembolsadas'
        });
      }
      
      if (transaction.refund.isRefunded) {
        return res.status(400).json({
          success: false,
          message: 'Transação já foi reembolsada'
        });
      }
      
      const refundAmount = amount || transaction.amount;
      const refundTransactionId = `refund_${Date.now()}`;
      
      // Processar reembolso
      await transaction.processRefund(refundAmount, reason, refundTransactionId);
      
      // Deduzir créditos do usuário se necessário
      if (transaction.credits > 0 && transaction.user.credits >= transaction.credits) {
        transaction.user.credits -= transaction.credits;
        await transaction.user.save();
      }
      
      res.json({
        success: true,
        message: 'Reembolso processado com sucesso',
        data: { transaction }
      });
      
    } catch (error) {
      console.error('Erro ao processar reembolso:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/admin/ai-logs - Logs de IA
router.get('/ai-logs',
  validatePagination,
  logActivity('admin_ai_logs_list'),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      const filter = {};
      
      // Filtros
      if (req.query.model) filter.model = req.query.model;
      if (req.query.requestType) filter.requestType = req.query.requestType;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.userId) filter.user = req.query.userId;
      
      if (req.query.startDate || req.query.endDate) {
        filter.createdAt = {};
        if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
        if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
      }
      
      const aiLogs = await AILog.find(filter)
        .populate('user', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-input.context -output.response -error.stack');
      
      const total = await AILog.countDocuments(filter);
      
      res.json({
        success: true,
        data: {
          aiLogs,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });
      
    } catch (error) {
      console.error('Erro ao listar logs de IA:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/admin/reports/revenue - Relatório de receita
router.get('/reports/revenue',
  logActivity('admin_revenue_report'),
  async (req, res) => {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      
      const matchStage = {
        type: { $in: ['credit_purchase', 'subscription'] },
        status: 'completed'
      };
      
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }
      
      let groupStage;
      switch (groupBy) {
        case 'hour':
          groupStage = {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' },
                hour: { $hour: '$createdAt' }
              },
              revenue: { $sum: '$amount' },
              transactions: { $sum: 1 },
              credits: { $sum: '$credits' }
            }
          };
          break;
        case 'month':
          groupStage = {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              revenue: { $sum: '$amount' },
              transactions: { $sum: 1 },
              credits: { $sum: '$credits' }
            }
          };
          break;
        default: // day
          groupStage = {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              revenue: { $sum: '$amount' },
              transactions: { $sum: 1 },
              credits: { $sum: '$credits' }
            }
          };
      }
      
      const revenueData = await Transaction.aggregate([
        { $match: matchStage },
        groupStage,
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
      ]);
      
      // Estatísticas gerais
      const totalStats = await Transaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalTransactions: { $sum: 1 },
            totalCredits: { $sum: '$credits' },
            avgTransactionValue: { $avg: '$amount' }
          }
        }
      ]);
      
      res.json({
        success: true,
        data: {
          revenueData,
          totalStats: totalStats[0] || {
            totalRevenue: 0,
            totalTransactions: 0,
            totalCredits: 0,
            avgTransactionValue: 0
          },
          groupBy,
          period: { startDate, endDate }
        }
      });
      
    } catch (error) {
      console.error('Erro no relatório de receita:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/admin/reports/usage - Relatório de uso da IA
router.get('/reports/usage',
  logActivity('admin_usage_report'),
  async (req, res) => {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      
      const matchStage = {
        status: 'completed'
      };
      
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }
      
      let groupStage;
      switch (groupBy) {
        case 'hour':
          groupStage = {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' },
                hour: { $hour: '$createdAt' }
              },
              requests: { $sum: 1 },
              credits: { $sum: '$cost.credits' },
              tokens: { $sum: '$output.tokensUsed.total' },
              avgProcessingTime: { $avg: '$performance.processingTime' }
            }
          };
          break;
        case 'month':
          groupStage = {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              requests: { $sum: 1 },
              credits: { $sum: '$cost.credits' },
              tokens: { $sum: '$output.tokensUsed.total' },
              avgProcessingTime: { $avg: '$performance.processingTime' }
            }
          };
          break;
        default: // day
          groupStage = {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              requests: { $sum: 1 },
              credits: { $sum: '$cost.credits' },
              tokens: { $sum: '$output.tokensUsed.total' },
              avgProcessingTime: { $avg: '$performance.processingTime' }
            }
          };
      }
      
      const usageData = await AILog.aggregate([
        { $match: matchStage },
        groupStage,
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
      ]);
      
      // Estatísticas por modelo
      const modelStats = await AILog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$model',
            requests: { $sum: 1 },
            credits: { $sum: '$cost.credits' },
            avgRating: { $avg: '$output.userRating' },
            avgProcessingTime: { $avg: '$performance.processingTime' }
          }
        },
        { $sort: { requests: -1 } }
      ]);
      
      res.json({
        success: true,
        data: {
          usageData,
          modelStats,
          groupBy,
          period: { startDate, endDate }
        }
      });
      
    } catch (error) {
      console.error('Erro no relatório de uso:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

module.exports = router;