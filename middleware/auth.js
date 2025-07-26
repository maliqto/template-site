const jwt = require('jsonwebtoken');
const User = require('../models/User');
const rateLimit = require('express-rate-limit');

// Middleware de autenticação JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acesso requerido'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada'
      });
    }
    
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Conta bloqueada temporariamente'
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }
    
    console.error('Erro na autenticação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware de autorização por role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Acesso negado - usuário não autenticado'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado - permissões insuficientes'
      });
    }
    
    next();
  };
};

// Middleware para verificar créditos
const checkCredits = (requiredCredits = 1) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    if (req.user.credits < requiredCredits) {
      return res.status(402).json({
        success: false,
        message: 'Créditos insuficientes',
        required: requiredCredits,
        available: req.user.credits
      });
    }
    
    next();
  };
};

// Middleware para verificar subscription
const checkSubscription = (requiredLevel = 'basic') => {
  const levels = {
    'basic': 1,
    'premium': 2,
    'enterprise': 3
  };
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    const userLevel = levels[req.user.subscription.type] || 0;
    const requiredLevelNum = levels[requiredLevel] || 1;
    
    if (userLevel < requiredLevelNum || req.user.subscription.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Subscription necessária',
        required: requiredLevel,
        current: req.user.subscription.type,
        status: req.user.subscription.status
      });
    }
    
    next();
  };
};

// Rate limiting para autenticação
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting para IPs confiáveis (opcional)
    const trustedIPs = process.env.TRUSTED_IPS ? process.env.TRUSTED_IPS.split(',') : [];
    return trustedIPs.includes(req.ip);
  }
});

// Rate limiting para API de IA
const aiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: (req) => {
    if (!req.user) return 5; // Usuários não autenticados: 5 por minuto
    
    switch (req.user.role) {
      case 'admin':
        return 1000; // Admins: sem limite prático
      case 'premium':
        return 100; // Premium: 100 por minuto
      default:
        return 20; // Usuários básicos: 20 por minuto
    }
  },
  message: {
    success: false,
    message: 'Limite de requisições excedido. Aguarde um momento.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  }
});

// Rate limiting geral para API
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: (req) => {
    if (!req.user) return 100; // Usuários não autenticados: 100 por 15min
    
    switch (req.user.role) {
      case 'admin':
        return 10000; // Admins: limite alto
      case 'premium':
        return 2000; // Premium: 2000 por 15min
      default:
        return 500; // Usuários básicos: 500 por 15min
    }
  },
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente mais tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  }
});

// Middleware para logging de atividades
const logActivity = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log da atividade
      const logData = {
        user: req.user ? req.user._id : null,
        action,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
        success: res.statusCode < 400,
        statusCode: res.statusCode,
        method: req.method,
        url: req.originalUrl,
        body: req.method !== 'GET' ? req.body : undefined
      };
      
      // Aqui você pode salvar no banco de dados ou enviar para um serviço de logging
      console.log('Activity Log:', JSON.stringify(logData, null, 2));
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Middleware para validar API Key (para integrações externas)
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API Key requerida'
      });
    }
    
    // Buscar usuário pela API Key (você pode criar um campo apiKey no modelo User)
    const user = await User.findOne({ apiKey }).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'API Key inválida'
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Erro na validação da API Key:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware para verificar se o email foi verificado
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado'
    });
  }
  
  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email não verificado. Verifique seu email antes de continuar.',
      requiresEmailVerification: true
    });
  }
  
  next();
};

module.exports = {
  authenticateToken,
  authorize,
  checkCredits,
  checkSubscription,
  authRateLimit,
  aiRateLimit,
  generalRateLimit,
  logActivity,
  validateApiKey,
  requireEmailVerification
};