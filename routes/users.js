const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AILog = require('../models/AILog');
const { authenticateToken, authorize, logActivity } = require('../middleware/auth');
const { 
  validateProfileUpdate, 
  validateObjectId, 
  validatePagination,
  validateFileUpload 
} = require('../middleware/validation');

const router = express.Router();

// Configuração do multer para upload de avatar
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/avatars');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

// GET /api/users/profile - Obter perfil do usuário
router.get('/profile',
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
        .select('-password -emailVerificationToken -passwordResetToken -twoFactorSecret');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }
      
      // Obter estatísticas do usuário
      const stats = await AILog.getUserStats(user._id);
      const recentTransactions = await Transaction.find({ user: user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('type status amount credits description createdAt');
      
      res.json({
        success: true,
        data: {
          user,
          stats: stats[0] || {
            totalRequests: 0,
            totalCredits: 0,
            totalTokens: 0,
            avgProcessingTime: 0,
            avgRating: 0
          },
          recentTransactions
        }
      });
      
    } catch (error) {
      console.error('Erro ao obter perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// PUT /api/users/profile - Atualizar perfil
router.put('/profile',
  authenticateToken,
  validateProfileUpdate,
  logActivity('profile_update'),
  async (req, res) => {
    try {
      const allowedUpdates = [
        'firstName', 'lastName', 'preferences'
      ];
      
      const updates = {};
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });
      
      const user = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
      ).select('-password -emailVerificationToken -passwordResetToken -twoFactorSecret');
      
      res.json({
        success: true,
        message: 'Perfil atualizado com sucesso',
        data: { user }
      });
      
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/users/avatar - Upload de avatar
router.post('/avatar',
  authenticateToken,
  upload.single('avatar'),
  validateFileUpload,
  logActivity('avatar_upload'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum arquivo foi enviado'
        });
      }
      
      // Remover avatar anterior se existir
      const user = await User.findById(req.user._id);
      if (user.avatar) {
        try {
          await fs.unlink(path.join(__dirname, '../uploads/avatars', path.basename(user.avatar)));
        } catch (error) {
          console.log('Erro ao remover avatar anterior:', error.message);
        }
      }
      
      // Atualizar caminho do avatar no banco
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      user.avatar = avatarUrl;
      await user.save();
      
      res.json({
        success: true,
        message: 'Avatar atualizado com sucesso',
        data: {
          avatarUrl
        }
      });
      
    } catch (error) {
      console.error('Erro no upload do avatar:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// DELETE /api/users/avatar - Remover avatar
router.delete('/avatar',
  authenticateToken,
  logActivity('avatar_delete'),
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      
      if (!user.avatar) {
        return res.status(400).json({
          success: false,
          message: 'Usuário não possui avatar'
        });
      }
      
      // Remover arquivo do sistema
      try {
        await fs.unlink(path.join(__dirname, '../uploads/avatars', path.basename(user.avatar)));
      } catch (error) {
        console.log('Erro ao remover arquivo de avatar:', error.message);
      }
      
      // Remover referência do banco
      user.avatar = null;
      await user.save();
      
      res.json({
        success: true,
        message: 'Avatar removido com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao remover avatar:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/users/transactions - Obter histórico de transações
router.get('/transactions',
  authenticateToken,
  validatePagination,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const filter = { user: req.user._id };
      
      // Filtros opcionais
      if (req.query.type) {
        filter.type = req.query.type;
      }
      
      if (req.query.status) {
        filter.status = req.query.status;
      }
      
      if (req.query.startDate || req.query.endDate) {
        filter.createdAt = {};
        if (req.query.startDate) {
          filter.createdAt.$gte = new Date(req.query.startDate);
        }
        if (req.query.endDate) {
          filter.createdAt.$lte = new Date(req.query.endDate);
        }
      }
      
      const transactions = await Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-user -paymentProvider.metadata');
      
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
      console.error('Erro ao obter transações:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/users/ai-logs - Obter histórico de uso da IA
router.get('/ai-logs',
  authenticateToken,
  validatePagination,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const filter = { user: req.user._id };
      
      // Filtros opcionais
      if (req.query.requestType) {
        filter.requestType = req.query.requestType;
      }
      
      if (req.query.model) {
        filter.model = req.query.model;
      }
      
      if (req.query.status) {
        filter.status = req.query.status;
      }
      
      if (req.query.startDate || req.query.endDate) {
        filter.createdAt = {};
        if (req.query.startDate) {
          filter.createdAt.$gte = new Date(req.query.startDate);
        }
        if (req.query.endDate) {
          filter.createdAt.$lte = new Date(req.query.endDate);
        }
      }
      
      const aiLogs = await AILog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-user -input.context -output.response -error.stack');
      
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
      console.error('Erro ao obter logs de IA:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/users/stats - Obter estatísticas do usuário
router.get('/stats',
  authenticateToken,
  async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;
      
      // Estatísticas de uso da IA
      const aiStats = await AILog.getUserStats(req.user._id, days);
      
      // Estatísticas de transações
      const transactionStats = await Transaction.getUserSummary(req.user._id);
      
      // Uso por categoria
      const categoryStats = await AILog.aggregate([
        {
          $match: {
            user: req.user._id,
            createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$metadata.category',
            count: { $sum: 1 },
            credits: { $sum: '$cost.credits' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      // Uso por modelo
      const modelStats = await AILog.aggregate([
        {
          $match: {
            user: req.user._id,
            createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$model',
            count: { $sum: 1 },
            avgRating: { $avg: '$output.userRating' },
            avgProcessingTime: { $avg: '$performance.processingTime' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      res.json({
        success: true,
        data: {
          period: `${days} dias`,
          aiUsage: aiStats[0] || {
            totalRequests: 0,
            totalCredits: 0,
            totalTokens: 0,
            avgProcessingTime: 0,
            avgRating: 0
          },
          transactions: transactionStats,
          categoryUsage: categoryStats,
          modelUsage: modelStats
        }
      });
      
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// DELETE /api/users/account - Deletar conta
router.delete('/account',
  authenticateToken,
  logActivity('account_deletion'),
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }
      
      // Marcar como inativo ao invés de deletar (soft delete)
      user.isActive = false;
      user.email = `deleted_${Date.now()}_${user.email}`;
      user.username = `deleted_${Date.now()}_${user.username}`;
      await user.save();
      
      // Remover avatar se existir
      if (user.avatar) {
        try {
          await fs.unlink(path.join(__dirname, '../uploads/avatars', path.basename(user.avatar)));
        } catch (error) {
          console.log('Erro ao remover avatar:', error.message);
        }
      }
      
      res.json({
        success: true,
        message: 'Conta deletada com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao deletar conta:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Rotas administrativas

// GET /api/users - Listar usuários (admin)
router.get('/',
  authenticateToken,
  authorize('admin'),
  validatePagination,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      const filter = {};
      
      // Filtros opcionais
      if (req.query.role) {
        filter.role = req.query.role;
      }
      
      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === 'true';
      }
      
      if (req.query.emailVerified !== undefined) {
        filter.emailVerified = req.query.emailVerified === 'true';
      }
      
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

// GET /api/users/:id - Obter usuário específico (admin)
router.get('/:id',
  authenticateToken,
  authorize('admin'),
  validateObjectId('id'),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id)
        .select('-password -emailVerificationToken -passwordResetToken -twoFactorSecret');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }
      
      // Obter estatísticas do usuário
      const stats = await AILog.getUserStats(user._id);
      const transactionStats = await Transaction.getUserSummary(user._id);
      
      res.json({
        success: true,
        data: {
          user,
          stats: stats[0] || {},
          transactionStats
        }
      });
      
    } catch (error) {
      console.error('Erro ao obter usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

module.exports = router;