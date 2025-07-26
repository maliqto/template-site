const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const AILog = require('../models/AILog');
const Transaction = require('../models/Transaction');
const { authenticateToken, checkCredits, aiRateLimit, logActivity } = require('../middleware/auth');
const { validateAIRequest, validateObjectId, validateFeedback } = require('../middleware/validation');
const { body, validationResult } = require('express-validator');
const { callRealAI, calculateCredits, isModelAvailable, getModelInfo, getAllModels } = require('../config/ai');

const router = express.Router();

// Obter modelos disponíveis da configuração
const aiModels = getAllModels();

// Função para preparar prompt baseado no tipo de requisição
function preparePrompt(prompt, requestType) {
  const prompts = {
    'marketing_campaign': `Como especialista em marketing digital, analise e forneça estratégias para: ${prompt}`,
    'sms_campaign': `Como especialista em SMS marketing, crie uma campanha eficaz para: ${prompt}`,
    'email_campaign': `Como especialista em email marketing, desenvolva uma estratégia para: ${prompt}`,
    'audience_analysis': `Como analista de dados, analise o público-alvo para: ${prompt}`,
    'content_generation': `Como copywriter especializado, crie conteúdo persuasivo para: ${prompt}`,
    'text_generation': prompt,
    'chat': prompt,
    default: prompt
  };
  
  return prompts[requestType] || prompts.default;
}



// GET /api/ai/models - Listar modelos disponíveis
router.get('/models',
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          models: aiModels
        }
      });
    } catch (error) {
      console.error('Erro ao obter modelos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/ai/generate - Gerar resposta da IA
router.post('/generate',
  authenticateToken,
  aiRateLimit,
  validateAIRequest,
  logActivity('ai_request'),
  async (req, res) => {
    const sessionId = crypto.randomUUID();
    let aiLog;
    
    try {
      const {
        prompt,
        model = 'gpt-3.5-turbo',
        requestType = 'text_generation',
        parameters = {},
        category = 'general'
      } = req.body;
      
      // Verificar se o modelo existe e está disponível
      if (!isModelAvailable(model)) {
        return res.status(400).json({
          success: false,
          message: 'Modelo de IA não encontrado ou não disponível'
        });
      }
      
      // Estimar créditos necessários (baseado no prompt)
      const estimatedTokens = Math.ceil(prompt.length / 4) + 500; // Input + output estimado
      const requiredCredits = calculateCredits(estimatedTokens, model);
      
      // Verificar se o usuário tem créditos suficientes
      if (req.user.credits < requiredCredits) {
        return res.status(402).json({
          success: false,
          message: 'Créditos insuficientes',
          required: requiredCredits,
          available: req.user.credits
        });
      }
      
      // Criar log da requisição
      aiLog = new AILog({
        user: req.user._id,
        sessionId,
        requestType,
        model,
        input: {
          prompt,
          parameters: {
            temperature: parameters.temperature || 0.7,
            maxTokens: parameters.maxTokens || 1000,
            topP: parameters.topP || 1,
            frequencyPenalty: parameters.frequencyPenalty || 0,
            presencePenalty: parameters.presencePenalty || 0
          }
        },
        status: 'processing',
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          platform: 'web',
          category
        }
      });
      
      await aiLog.save();
      
      // Preparar prompt baseado no tipo de requisição
      const preparedPrompt = preparePrompt(prompt, requestType);
      
      // Gerar resposta da IA usando API real
      const aiResponse = await callRealAI(preparedPrompt, model, parameters);
      
      // Calcular créditos reais baseado nos tokens usados
      const actualCredits = calculateCredits(aiResponse.tokensUsed.total, model);
      
      // Deduzir créditos do usuário
      await req.user.deductCredits(actualCredits);
      
      // Criar transação de uso
      const transaction = new Transaction({
        user: req.user._id,
        type: 'credit_usage',
        status: 'completed',
        amount: 0,
        credits: actualCredits,
        description: `Uso da IA - ${model} (${requestType})`,
        aiUsage: {
          model,
          tokens: aiResponse.tokensUsed.total,
          requestType,
          processingTime: aiResponse.processingTime
        },
        completedAt: Date.now()
      });
      
      await transaction.save();
      
      // Atualizar log com a resposta
      await aiLog.markCompleted(
        aiResponse.response,
        aiResponse.tokensUsed,
        aiResponse.processingTime
      );
      
      aiLog.cost = {
        credits: actualCredits,
        usdCost: actualCredits * 0.01
      };
      
      await aiLog.save();
      
      res.json({
        success: true,
        data: {
          response: aiResponse.response,
          sessionId,
          model,
          requestType,
          tokensUsed: aiResponse.tokensUsed,
          processingTime: aiResponse.processingTime,
          creditsUsed: actualCredits,
          remainingCredits: req.user.credits - actualCredits,
          logId: aiLog._id
        }
      });
      
    } catch (error) {
      console.error('Erro na geração de IA:', error);
      
      // Marcar log como falhou se foi criado
      if (aiLog) {
        await aiLog.markFailed(error);
      }
      
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        sessionId
      });
    }
  }
);

// POST /api/ai/feedback - Enviar feedback sobre resposta
router.post('/feedback',
  authenticateToken,
  validateFeedback,
  logActivity('ai_feedback'),
  async (req, res) => {
    try {
      const { logId, rating, feedback, category } = req.body;
      
      const aiLog = await AILog.findOne({
        _id: logId,
        user: req.user._id
      });
      
      if (!aiLog) {
        return res.status(404).json({
          success: false,
          message: 'Log de IA não encontrado'
        });
      }
      
      // Atualizar feedback
      aiLog.output.userRating = rating;
      aiLog.output.userFeedback = feedback;
      
      if (category) {
        aiLog.metadata.category = category;
      }
      
      await aiLog.save();
      
      res.json({
        success: true,
        message: 'Feedback enviado com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao enviar feedback:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/ai/history - Histórico de conversas
router.get('/history',
  authenticateToken,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const filter = {
        user: req.user._id,
        status: 'completed'
      };
      
      if (req.query.model) {
        filter.model = req.query.model;
      }
      
      if (req.query.requestType) {
        filter.requestType = req.query.requestType;
      }
      
      if (req.query.category) {
        filter['metadata.category'] = req.query.category;
      }
      
      const conversations = await AILog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('sessionId requestType model input.prompt output.response output.userRating cost.credits performance.processingTime createdAt metadata.category');
      
      const total = await AILog.countDocuments(filter);
      
      res.json({
        success: true,
        data: {
          conversations,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });
      
    } catch (error) {
      console.error('Erro ao obter histórico:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/ai/conversation/:sessionId - Obter conversa específica
router.get('/conversation/:sessionId',
  authenticateToken,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const conversation = await AILog.findOne({
        sessionId,
        user: req.user._id
      }).select('-user -error.stack');
      
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversa não encontrada'
        });
      }
      
      res.json({
        success: true,
        data: { conversation }
      });
      
    } catch (error) {
      console.error('Erro ao obter conversa:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/ai/stats - Estatísticas de uso da IA
router.get('/stats',
  authenticateToken,
  async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      // Estatísticas gerais
      const generalStats = await AILog.aggregate([
        {
          $match: {
            user: req.user._id,
            createdAt: { $gte: startDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            totalCredits: { $sum: '$cost.credits' },
            totalTokens: { $sum: '$output.tokensUsed.total' },
            avgProcessingTime: { $avg: '$performance.processingTime' },
            avgRating: { $avg: '$output.userRating' }
          }
        }
      ]);
      
      // Uso por modelo
      const modelStats = await AILog.aggregate([
        {
          $match: {
            user: req.user._id,
            createdAt: { $gte: startDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$model',
            count: { $sum: 1 },
            credits: { $sum: '$cost.credits' },
            avgRating: { $avg: '$output.userRating' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      // Uso por tipo de requisição
      const typeStats = await AILog.aggregate([
        {
          $match: {
            user: req.user._id,
            createdAt: { $gte: startDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$requestType',
            count: { $sum: 1 },
            credits: { $sum: '$cost.credits' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      res.json({
        success: true,
        data: {
          period: `${days} dias`,
          general: generalStats[0] || {
            totalRequests: 0,
            totalCredits: 0,
            totalTokens: 0,
            avgProcessingTime: 0,
            avgRating: 0
          },
          byModel: modelStats,
          byType: typeStats
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

module.exports = router;