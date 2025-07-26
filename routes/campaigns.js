const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authenticateToken, checkCredits, logActivity } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { 
  sendSMS, 
  sendEmail, 
  sendBulkSMS, 
  sendBulkEmail, 
  validatePhoneNumber, 
  validateEmail, 
  getMessagingStats 
} = require('../config/messaging');

const router = express.Router();

// Middleware para validação de erros
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }
  next();
}

// POST /api/campaigns/sms/send - Enviar SMS individual
router.post('/sms/send',
  authenticateToken,
  [
    body('phone').notEmpty().withMessage('Número de telefone é obrigatório'),
    body('message').isLength({ min: 1, max: 160 }).withMessage('Mensagem deve ter entre 1 e 160 caracteres'),
    handleValidationErrors
  ],
  checkCredits(1), // 1 crédito por SMS
  logActivity('sms_send'),
  async (req, res) => {
    try {
      const { phone, message } = req.body;
      
      // Validar número de telefone
      const phoneValidation = validatePhoneNumber(phone);
      if (!phoneValidation.valid) {
        return res.status(400).json({
          success: false,
          message: phoneValidation.error
        });
      }
      
      // Enviar SMS
      const result = await sendSMS(phoneValidation.formatted, message);
      
      // Deduzir créditos
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 
          credits: -1,
          totalCreditsUsed: 1
        }
      });
      
      // Registrar transação
      const transaction = new Transaction({
        user: req.user._id,
        type: 'sms_usage',
        status: 'completed',
        amount: 0,
        credits: -1,
        description: `SMS enviado para ${phoneValidation.formatted}`,
        metadata: {
          phone: phoneValidation.formatted,
          messageId: result.messageId,
          provider: result.provider
        },
        completedAt: Date.now()
      });
      
      await transaction.save();
      
      res.json({
        success: true,
        message: 'SMS enviado com sucesso',
        data: {
          messageId: result.messageId,
          status: result.status,
          to: result.to,
          creditsRemaining: req.user.credits - 1
        }
      });
      
    } catch (error) {
      console.error('Erro ao enviar SMS:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/campaigns/email/send - Enviar Email individual
router.post('/email/send',
  authenticateToken,
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('subject').isLength({ min: 1, max: 200 }).withMessage('Assunto deve ter entre 1 e 200 caracteres'),
    body('content').isLength({ min: 1, max: 10000 }).withMessage('Conteúdo deve ter entre 1 e 10000 caracteres'),
    handleValidationErrors
  ],
  checkCredits(1), // 1 crédito por email
  logActivity('email_send'),
  async (req, res) => {
    try {
      const { email, subject, content } = req.body;
      
      // Validar email
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return res.status(400).json({
          success: false,
          message: emailValidation.error
        });
      }
      
      // Enviar email
      const result = await sendEmail(email, subject, content);
      
      // Deduzir créditos
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 
          credits: -1,
          totalCreditsUsed: 1
        }
      });
      
      // Registrar transação
      const transaction = new Transaction({
        user: req.user._id,
        type: 'email_usage',
        status: 'completed',
        amount: 0,
        credits: -1,
        description: `Email enviado para ${email}`,
        metadata: {
          email: email,
          subject: subject,
          messageId: result.messageId,
          provider: result.provider
        },
        completedAt: Date.now()
      });
      
      await transaction.save();
      
      res.json({
        success: true,
        message: 'Email enviado com sucesso',
        data: {
          messageId: result.messageId,
          to: result.to,
          creditsRemaining: req.user.credits - 1
        }
      });
      
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/campaigns/sms/bulk - Envio em massa de SMS
router.post('/sms/bulk',
  authenticateToken,
  [
    body('recipients').isArray({ min: 1, max: 100 }).withMessage('Deve haver entre 1 e 100 destinatários'),
    body('recipients.*.phone').notEmpty().withMessage('Número de telefone é obrigatório'),
    body('recipients.*.name').optional().isString(),
    body('message').isLength({ min: 1, max: 160 }).withMessage('Mensagem deve ter entre 1 e 160 caracteres'),
    handleValidationErrors
  ],
  logActivity('sms_bulk_send'),
  async (req, res) => {
    try {
      const { recipients, message } = req.body;
      const creditsNeeded = recipients.length;
      
      // Verificar se tem créditos suficientes
      if (req.user.credits < creditsNeeded) {
        return res.status(400).json({
          success: false,
          message: `Créditos insuficientes. Necessário: ${creditsNeeded}, Disponível: ${req.user.credits}`
        });
      }
      
      // Validar todos os números
      const validatedRecipients = [];
      const invalidNumbers = [];
      
      for (const recipient of recipients) {
        const phoneValidation = validatePhoneNumber(recipient.phone);
        if (phoneValidation.valid) {
          validatedRecipients.push({
            ...recipient,
            phone: phoneValidation.formatted
          });
        } else {
          invalidNumbers.push({
            phone: recipient.phone,
            error: phoneValidation.error
          });
        }
      }
      
      if (validatedRecipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum número válido encontrado',
          invalidNumbers
        });
      }
      
      // Enviar SMS em massa
      const result = await sendBulkSMS(validatedRecipients, message);
      
      // Deduzir créditos apenas pelos SMS enviados com sucesso
      const creditsUsed = result.totalSent;
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 
          credits: -creditsUsed,
          totalCreditsUsed: creditsUsed
        }
      });
      
      // Registrar transação
      const transaction = new Transaction({
        user: req.user._id,
        type: 'sms_bulk_usage',
        status: 'completed',
        amount: 0,
        credits: -creditsUsed,
        description: `Envio em massa de SMS - ${result.totalSent} enviados`,
        metadata: {
          totalRecipients: recipients.length,
          totalSent: result.totalSent,
          totalErrors: result.totalErrors,
          invalidNumbers
        },
        completedAt: Date.now()
      });
      
      await transaction.save();
      
      res.json({
        success: true,
        message: `SMS enviado para ${result.totalSent} de ${recipients.length} destinatários`,
        data: {
          ...result,
          invalidNumbers,
          creditsUsed,
          creditsRemaining: req.user.credits - creditsUsed
        }
      });
      
    } catch (error) {
      console.error('Erro no envio em massa de SMS:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/campaigns/email/bulk - Envio em massa de Email
router.post('/email/bulk',
  authenticateToken,
  [
    body('recipients').isArray({ min: 1, max: 100 }).withMessage('Deve haver entre 1 e 100 destinatários'),
    body('recipients.*.email').isEmail().withMessage('Email inválido'),
    body('recipients.*.name').optional().isString(),
    body('subject').isLength({ min: 1, max: 200 }).withMessage('Assunto deve ter entre 1 e 200 caracteres'),
    body('content').isLength({ min: 1, max: 10000 }).withMessage('Conteúdo deve ter entre 1 e 10000 caracteres'),
    handleValidationErrors
  ],
  logActivity('email_bulk_send'),
  async (req, res) => {
    try {
      const { recipients, subject, content } = req.body;
      const creditsNeeded = recipients.length;
      
      // Verificar se tem créditos suficientes
      if (req.user.credits < creditsNeeded) {
        return res.status(400).json({
          success: false,
          message: `Créditos insuficientes. Necessário: ${creditsNeeded}, Disponível: ${req.user.credits}`
        });
      }
      
      // Validar todos os emails
      const validatedRecipients = [];
      const invalidEmails = [];
      
      for (const recipient of recipients) {
        const emailValidation = validateEmail(recipient.email);
        if (emailValidation.valid) {
          validatedRecipients.push(recipient);
        } else {
          invalidEmails.push({
            email: recipient.email,
            error: emailValidation.error
          });
        }
      }
      
      if (validatedRecipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum email válido encontrado',
          invalidEmails
        });
      }
      
      // Enviar emails em massa
      const result = await sendBulkEmail(validatedRecipients, subject, content);
      
      // Deduzir créditos apenas pelos emails enviados com sucesso
      const creditsUsed = result.totalSent;
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 
          credits: -creditsUsed,
          totalCreditsUsed: creditsUsed
        }
      });
      
      // Registrar transação
      const transaction = new Transaction({
        user: req.user._id,
        type: 'email_bulk_usage',
        status: 'completed',
        amount: 0,
        credits: -creditsUsed,
        description: `Envio em massa de Email - ${result.totalSent} enviados`,
        metadata: {
          totalRecipients: recipients.length,
          totalSent: result.totalSent,
          totalErrors: result.totalErrors,
          subject,
          invalidEmails
        },
        completedAt: Date.now()
      });
      
      await transaction.save();
      
      res.json({
        success: true,
        message: `Email enviado para ${result.totalSent} de ${recipients.length} destinatários`,
        data: {
          ...result,
          invalidEmails,
          creditsUsed,
          creditsRemaining: req.user.credits - creditsUsed
        }
      });
      
    } catch (error) {
      console.error('Erro no envio em massa de email:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/campaigns/stats - Estatísticas de campanhas
router.get('/stats',
  authenticateToken,
  logActivity('campaign_stats_view'),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const dateFilter = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
      }
      
      // Estatísticas de transações de campanhas
      const campaignStats = await Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            type: { $in: ['sms_usage', 'email_usage', 'sms_bulk_usage', 'email_bulk_usage'] },
            ...dateFilter
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalCredits: { $sum: { $abs: '$credits' } },
            totalSent: { $sum: '$metadata.totalSent' }
          }
        }
      ]);
      
      // Organizar estatísticas
      const stats = {
        sms: {
          individual: { count: 0, credits: 0, sent: 0 },
          bulk: { count: 0, credits: 0, sent: 0 }
        },
        email: {
          individual: { count: 0, credits: 0, sent: 0 },
          bulk: { count: 0, credits: 0, sent: 0 }
        },
        total: {
          campaigns: 0,
          credits: 0,
          messagesSent: 0
        }
      };
      
      campaignStats.forEach(stat => {
        switch (stat._id) {
          case 'sms_usage':
            stats.sms.individual = {
              count: stat.count,
              credits: stat.totalCredits,
              sent: stat.count // SMS individual = 1 por transação
            };
            break;
          case 'sms_bulk_usage':
            stats.sms.bulk = {
              count: stat.count,
              credits: stat.totalCredits,
              sent: stat.totalSent || 0
            };
            break;
          case 'email_usage':
            stats.email.individual = {
              count: stat.count,
              credits: stat.totalCredits,
              sent: stat.count // Email individual = 1 por transação
            };
            break;
          case 'email_bulk_usage':
            stats.email.bulk = {
              count: stat.count,
              credits: stat.totalCredits,
              sent: stat.totalSent || 0
            };
            break;
        }
      });
      
      // Calcular totais
      stats.total.campaigns = 
        stats.sms.individual.count + stats.sms.bulk.count +
        stats.email.individual.count + stats.email.bulk.count;
        
      stats.total.credits = 
        stats.sms.individual.credits + stats.sms.bulk.credits +
        stats.email.individual.credits + stats.email.bulk.credits;
        
      stats.total.messagesSent = 
        stats.sms.individual.sent + stats.sms.bulk.sent +
        stats.email.individual.sent + stats.email.bulk.sent;
      
      res.json({
        success: true,
        data: { stats }
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

module.exports = router;