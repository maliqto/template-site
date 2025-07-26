const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Middleware para processar erros de validação
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    console.log('Validation errors:', formattedErrors);
    console.log('Request body:', req.body);
    
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: formattedErrors
    });
  }
  
  next();
};

// Validações para registro de usuário
const validateUserRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username deve ter entre 3 e 30 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username deve conter apenas letras, números e underscore')
    .custom(async (value) => {
      const User = require('../models/User');
      const existingUser = await User.findOne({ username: value });
      if (existingUser) {
        throw new Error('Username já está em uso');
      }
      return true;
    }),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .custom(async (value) => {
      const User = require('../models/User');
      const existingUser = await User.findOne({ email: value });
      if (existingUser) {
        throw new Error('Email já está em uso');
      }
      return true;
    }),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Senha deve ter pelo menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Confirmação de senha não confere');
      }
      return true;
    }),
  
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nome deve ter entre 2 e 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Nome deve conter apenas letras'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Sobrenome deve ter entre 2 e 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Sobrenome deve conter apenas letras'),
  
  body('acceptTerms')
    .isBoolean()
    .withMessage('Aceitação dos termos é obrigatória')
    .custom((value) => {
      if (!value) {
        throw new Error('Você deve aceitar os termos de uso');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validações para login
const validateUserLogin = [
  body('login')
    .trim()
    .notEmpty()
    .withMessage('Email ou username é obrigatório'),
  
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória'),
  
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me deve ser um valor booleano'),
  
  handleValidationErrors
];

// Validações para atualização de perfil
const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nome deve ter entre 2 e 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Nome deve conter apenas letras'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Sobrenome deve ter entre 2 e 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Sobrenome deve conter apenas letras'),
  
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('preferences.theme')
    .optional()
    .isIn(['dark', 'light', 'auto'])
    .withMessage('Tema deve ser: dark, light ou auto'),
  
  body('preferences.language')
    .optional()
    .isIn(['pt', 'en', 'es'])
    .withMessage('Idioma deve ser: pt, en ou es'),
  
  body('preferences.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Notificação por email deve ser booleana'),
  
  body('preferences.notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Notificação push deve ser booleana'),
  
  handleValidationErrors
];

// Validações para mudança de senha
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Nova senha deve ter pelo menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Nova senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial'),
  
  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Confirmação da nova senha não confere');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validações para requisições de IA
const validateAIRequest = [
  body('prompt')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Prompt deve ter entre 1 e 10000 caracteres'),
  
  body('model')
    .optional()
    .isIn(['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-pro', 'custom-hacking-ai'])
    .withMessage('Modelo de IA inválido'),
  
  body('requestType')
    .isIn(['text_generation', 'code_generation', 'image_analysis', 'chat', 'hacking_tools', 'vulnerability_scan', 'penetration_test'])
    .withMessage('Tipo de requisição inválido'),
  
  body('parameters.temperature')
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage('Temperature deve estar entre 0 e 2'),
  
  body('parameters.maxTokens')
    .optional()
    .isInt({ min: 1, max: 4000 })
    .withMessage('Max tokens deve estar entre 1 e 4000'),
  
  body('parameters.topP')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Top P deve estar entre 0 e 1'),
  
  body('category')
    .optional()
    .isIn(['general', 'hacking', 'security', 'development', 'analysis', 'research'])
    .withMessage('Categoria inválida'),
  
  handleValidationErrors
];

// Validações para compra de créditos
const validateCreditPurchase = [
  body('package')
    .isIn(['basic', 'premium', 'enterprise', 'custom'])
    .withMessage('Pacote inválido'),
  
  body('paymentMethod')
    .isIn(['stripe', 'paypal', 'pix', 'credit_card'])
    .withMessage('Método de pagamento inválido'),
  
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Valor deve ser maior que 0'),
  
  body('credits')
    .isInt({ min: 1 })
    .withMessage('Quantidade de créditos deve ser maior que 0'),
  
  handleValidationErrors
];

// Validações para parâmetros de ID
const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID inválido');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validações para paginação
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número maior que 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve estar entre 1 e 100'),
  
  query('sort')
    .optional()
    .isIn(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'name', '-name'])
    .withMessage('Ordenação inválida'),
  
  handleValidationErrors
];

// Validações para filtros de data
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Data de início inválida'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Data de fim inválida')
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('Data de fim deve ser posterior à data de início');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validações para upload de arquivos
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      success: false,
      message: 'Nenhum arquivo foi enviado'
    });
  }
  
  const file = req.file || (req.files && req.files[0]);
  
  // Verificar tamanho do arquivo (5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'Arquivo muito grande. Tamanho máximo: 5MB'
    });
  }
  
  // Verificar tipos de arquivo permitidos
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain', 'application/pdf'];
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Tipo de arquivo não permitido',
      allowedTypes: ['JPEG', 'PNG', 'GIF', 'WebP', 'TXT', 'PDF']
    });
  }
  
  next();
};

// Validações para feedback
const validateFeedback = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Avaliação deve estar entre 1 e 5'),
  
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback deve ter no máximo 1000 caracteres'),
  
  body('category')
    .optional()
    .isIn(['bug', 'feature', 'improvement', 'general'])
    .withMessage('Categoria inválida'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateProfileUpdate,
  validatePasswordChange,
  validateAIRequest,
  validateCreditPurchase,
  validateObjectId,
  validatePagination,
  validateDateRange,
  validateFileUpload,
  validateFeedback
};