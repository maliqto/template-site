const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authenticateToken, authorize, logActivity } = require('../middleware/auth');
const { validateCreditPurchase, validateObjectId } = require('../middleware/validation');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Pacotes de créditos disponíveis
const creditPackages = {
  basic: {
    name: 'Pacote Básico',
    credits: 100,
    price: 9.99,
    currency: 'BRL',
    description: '100 créditos para uso da IA'
  },
  premium: {
    name: 'Pacote Premium',
    credits: 500,
    price: 39.99,
    currency: 'BRL',
    description: '500 créditos + 20% de bônus',
    bonus: 100
  },
  enterprise: {
    name: 'Pacote Enterprise',
    credits: 1000,
    price: 69.99,
    currency: 'BRL',
    description: '1000 créditos + 30% de bônus',
    bonus: 300
  },
  mega: {
    name: 'Pacote Mega',
    credits: 2500,
    price: 149.99,
    currency: 'BRL',
    description: '2500 créditos + 40% de bônus',
    bonus: 1000
  }
};

// GET /api/payments/packages - Listar pacotes disponíveis
router.get('/packages',
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          packages: creditPackages
        }
      });
    } catch (error) {
      console.error('Erro ao obter pacotes:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/payments/create-payment-intent - Criar intenção de pagamento
router.post('/create-payment-intent',
  authenticateToken,
  [
    body('package').isIn(Object.keys(creditPackages)).withMessage('Pacote inválido'),
    body('paymentMethod').optional().isIn(['card', 'pix']).withMessage('Método de pagamento inválido')
  ],
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

      const { package: packageName, paymentMethod = 'card' } = req.body;
      const packageInfo = creditPackages[packageName];
      
      if (!packageInfo) {
        return res.status(400).json({
          success: false,
          message: 'Pacote não encontrado'
        });
      }

      // Criar customer no Stripe se não existir
      let customer;
      if (req.user.stripeCustomerId) {
        customer = await stripe.customers.retrieve(req.user.stripeCustomerId);
      } else {
        customer = await stripe.customers.create({
          email: req.user.email,
          name: req.user.fullName,
          metadata: {
            userId: req.user._id.toString()
          }
        });
        
        // Salvar customer ID no usuário
        await User.findByIdAndUpdate(req.user._id, {
          stripeCustomerId: customer.id
        });
      }

      // Criar Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(packageInfo.price * 100), // Converter para centavos
        currency: packageInfo.currency.toLowerCase(),
        customer: customer.id,
        payment_method_types: paymentMethod === 'pix' ? ['pix'] : ['card'],
        metadata: {
          userId: req.user._id.toString(),
          package: packageName,
          credits: packageInfo.credits.toString(),
          bonus: (packageInfo.bonus || 0).toString()
        },
        description: `${packageInfo.name} - ${packageInfo.credits} créditos`
      });

      // Criar transação pendente
      const transaction = new Transaction({
        user: req.user._id,
        type: 'credit_purchase',
        status: 'pending',
        amount: packageInfo.price,
        currency: packageInfo.currency,
        credits: packageInfo.credits + (packageInfo.bonus || 0),
        description: packageInfo.description,
        package: packageName,
        paymentMethod: paymentMethod === 'pix' ? 'pix' : 'credit_card',
        paymentProvider: {
          paymentIntentId: paymentIntent.id,
          customerId: customer.id
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      await transaction.save();

      res.json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          transactionId: transaction._id,
          package: packageInfo
        }
      });

    } catch (error) {
      console.error('Erro ao criar payment intent:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/payments/confirm-payment - Confirmar pagamento
router.post('/confirm-payment',
  authenticateToken,
  [
    body('paymentIntentId').notEmpty().withMessage('Payment Intent ID é obrigatório'),
    body('transactionId').isMongoId().withMessage('Transaction ID inválido')
  ],
  logActivity('payment_confirmation'),
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

      const { paymentIntentId, transactionId } = req.body;

      // Buscar transação
      const transaction = await Transaction.findOne({
        _id: transactionId,
        user: req.user._id,
        'paymentProvider.paymentIntentId': paymentIntentId
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transação não encontrada'
        });
      }

      if (transaction.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Transação já foi processada'
        });
      }

      // Verificar status do pagamento no Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        // Adicionar créditos ao usuário
        const user = await User.findById(req.user._id);
        await user.addCredits(transaction.credits);

        // Marcar transação como completa
        await transaction.markCompleted();

        res.json({
          success: true,
          message: 'Pagamento confirmado com sucesso',
          data: {
            transaction,
            creditsAdded: transaction.credits,
            newBalance: user.credits
          }
        });
      } else {
        // Marcar transação como falhou
        await transaction.markFailed(`Pagamento não foi bem-sucedido: ${paymentIntent.status}`);

        res.status(400).json({
          success: false,
          message: 'Pagamento não foi confirmado',
          paymentStatus: paymentIntent.status
        });
      }

    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/payments/webhook - Webhook do Stripe
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Processar evento
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          await handlePaymentSuccess(paymentIntent);
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          await handlePaymentFailure(failedPayment);
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });

    } catch (error) {
      console.error('Erro no webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Função para processar pagamento bem-sucedido
async function handlePaymentSuccess(paymentIntent) {
  try {
    const transaction = await Transaction.findOne({
      'paymentProvider.paymentIntentId': paymentIntent.id
    });

    if (!transaction || transaction.status === 'completed') {
      return;
    }

    // Adicionar créditos ao usuário
    const user = await User.findById(transaction.user);
    if (user) {
      await user.addCredits(transaction.credits);
      await transaction.markCompleted();
      
      console.log(`Créditos adicionados: ${transaction.credits} para usuário ${user._id}`);
    }

  } catch (error) {
    console.error('Erro ao processar pagamento bem-sucedido:', error);
  }
}

// Função para processar pagamento falhado
async function handlePaymentFailure(paymentIntent) {
  try {
    const transaction = await Transaction.findOne({
      'paymentProvider.paymentIntentId': paymentIntent.id
    });

    if (!transaction || transaction.status !== 'pending') {
      return;
    }

    await transaction.markFailed(paymentIntent.last_payment_error?.message || 'Pagamento falhou');
    console.log(`Pagamento falhou para transação ${transaction._id}`);

  } catch (error) {
    console.error('Erro ao processar pagamento falhado:', error);
  }
}

// GET /api/payments/history - Histórico de pagamentos
router.get('/history',
  authenticateToken,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter = {
        user: req.user._id,
        type: { $in: ['credit_purchase', 'subscription'] }
      };

      if (req.query.status) {
        filter.status = req.query.status;
      }

      const transactions = await Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-paymentProvider.metadata -user');

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
      console.error('Erro ao obter histórico:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/payments/balance - Saldo de créditos
router.get('/balance',
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
        .select('credits totalCreditsUsed totalCreditsPurchased');

      // Estatísticas dos últimos 30 dias
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const recentUsage = await Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            type: 'credit_usage',
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalUsed: { $sum: '$credits' },
            count: { $sum: 1 }
          }
        }
      ]);

      const recentPurchases = await Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            type: 'credit_purchase',
            status: 'completed',
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalPurchased: { $sum: '$credits' },
            totalSpent: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          balance: {
            current: user.credits,
            totalUsed: user.totalCreditsUsed,
            totalPurchased: user.totalCreditsPurchased
          },
          last30Days: {
            used: recentUsage[0]?.totalUsed || 0,
            usageCount: recentUsage[0]?.count || 0,
            purchased: recentPurchases[0]?.totalPurchased || 0,
            spent: recentPurchases[0]?.totalSpent || 0,
            purchaseCount: recentPurchases[0]?.count || 0
          }
        }
      });

    } catch (error) {
      console.error('Erro ao obter saldo:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/payments/admin/add-credits - Adicionar créditos (admin)
router.post('/admin/add-credits',
  authenticateToken,
  authorize('admin'),
  [
    body('userId').isMongoId().withMessage('User ID inválido'),
    body('credits').isInt({ min: 1 }).withMessage('Créditos devem ser um número positivo'),
    body('reason').notEmpty().withMessage('Motivo é obrigatório')
  ],
  logActivity('admin_add_credits'),
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

      const { userId, credits, reason } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Adicionar créditos
      await user.addCredits(credits);

      // Criar transação de bônus
      const transaction = new Transaction({
        user: userId,
        type: 'bonus',
        status: 'completed',
        amount: 0,
        credits,
        description: `Créditos adicionados pelo admin: ${reason}`,
        notes: `Adicionado por: ${req.user.username}`,
        completedAt: Date.now()
      });

      await transaction.save();

      res.json({
        success: true,
        message: 'Créditos adicionados com sucesso',
        data: {
          user: {
            id: user._id,
            username: user.username,
            newBalance: user.credits
          },
          creditsAdded: credits,
          transaction
        }
      });

    } catch (error) {
      console.error('Erro ao adicionar créditos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

module.exports = router;