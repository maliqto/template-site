const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authenticateToken, authRateLimit, logActivity } = require('../middleware/auth');
const { 
  validateUserRegistration, 
  validateUserLogin, 
  validatePasswordChange,
  handleValidationErrors 
} = require('../middleware/validation');
const { body } = require('express-validator');

const router = express.Router();

// Função para gerar JWT
const generateToken = (userId, rememberMe = false) => {
  const expiresIn = rememberMe ? '30d' : '24h';
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
};

// Função para gerar refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

// POST /api/auth/register - Registro de usuário
router.post('/register', 
  authRateLimit,
  validateUserRegistration,
  logActivity('user_registration'),
  async (req, res) => {
    try {
      const { username, email, password, firstName, lastName } = req.body;
      
      // Criar novo usuário
      const user = new User({
        username,
        email,
        password,
        firstName,
        lastName,
        emailVerificationToken: crypto.randomBytes(32).toString('hex')
      });
      
      await user.save();
      
      // Criar transação de bônus de boas-vindas
      const welcomeTransaction = new Transaction({
        user: user._id,
        type: 'bonus',
        status: 'completed',
        amount: 0,
        credits: parseInt(process.env.DEFAULT_CREDITS) || 10,
        description: 'Bônus de boas-vindas',
        completedAt: Date.now()
      });
      
      await welcomeTransaction.save();
      
      // Gerar token
      const token = generateToken(user._id);
      
      // Remover senha da resposta
      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.emailVerificationToken;
      
      res.status(201).json({
        success: true,
        message: 'Usuário registrado com sucesso',
        data: {
          user: userResponse,
          token,
          expiresIn: '24h'
        }
      });
      
    } catch (error) {
      console.error('Erro no registro:', error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `${field === 'email' ? 'Email' : 'Username'} já está em uso`
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/auth/login - Login de usuário
router.post('/login',
  authRateLimit,
  validateUserLogin,
  logActivity('user_login'),
  async (req, res) => {
    try {
      const { login, password, rememberMe = false } = req.body;
      
      // Buscar usuário por email ou username
      const user = await User.findOne({
        $or: [
          { email: login.toLowerCase() },
          { username: login }
        ]
      }).select('+password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciais inválidas'
        });
      }
      
      // Verificar se a conta está bloqueada
      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Conta bloqueada temporariamente devido a muitas tentativas de login'
        });
      }
      
      // Verificar senha
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        await user.incLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Credenciais inválidas'
        });
      }
      
      // Verificar se a conta está ativa
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Conta desativada'
        });
      }
      
      // Reset login attempts e atualizar último login
      await user.resetLoginAttempts();
      user.lastLogin = Date.now();
      await user.save();
      
      // Gerar tokens
      const token = generateToken(user._id, rememberMe);
      const refreshToken = generateRefreshToken();
      
      // Remover dados sensíveis da resposta
      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.emailVerificationToken;
      delete userResponse.passwordResetToken;
      delete userResponse.twoFactorSecret;
      
      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          user: userResponse,
          token,
          refreshToken,
          expiresIn: rememberMe ? '30d' : '24h'
        }
      });
      
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/auth/refresh - Renovar token
router.post('/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token é obrigatório'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      // Aqui você implementaria a lógica de validação do refresh token
      // Por simplicidade, vamos apenas verificar se o token existe
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token inválido'
        });
      }
      
      // Em uma implementação real, você salvaria os refresh tokens no banco
      // e verificaria se ainda são válidos
      
      res.json({
        success: true,
        message: 'Token renovado com sucesso',
        data: {
          token: 'new_token_here',
          expiresIn: '24h'
        }
      });
      
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/auth/logout - Logout
router.post('/logout',
  authenticateToken,
  logActivity('user_logout'),
  async (req, res) => {
    try {
      // Em uma implementação real, você invalidaria o token
      // adicionando-o a uma blacklist ou removendo do banco
      
      res.json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
      
    } catch (error) {
      console.error('Erro no logout:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/auth/forgot-password - Esqueci minha senha
router.post('/forgot-password',
  authRateLimit,
  [
    body('email').isEmail().withMessage('Email inválido'),
    handleValidationErrors
  ],
  logActivity('password_reset_request'),
  async (req, res) => {
    try {
      const { email } = req.body;
      
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        // Por segurança, sempre retornamos sucesso mesmo se o email não existir
        return res.json({
          success: true,
          message: 'Se o email existir, você receberá instruções para redefinir sua senha'
        });
      }
      
      // Gerar token de reset
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = resetToken;
      user.passwordResetExpires = Date.now() + 3600000; // 1 hora
      
      await user.save();
      
      // Aqui você enviaria o email com o link de reset
      // const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      res.json({
        success: true,
        message: 'Se o email existir, você receberá instruções para redefinir sua senha'
      });
      
    } catch (error) {
      console.error('Erro ao solicitar reset de senha:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/auth/reset-password - Redefinir senha
router.post('/reset-password',
  authRateLimit,
  [
    body('token').notEmpty().withMessage('Token é obrigatório'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Senha deve ter pelo menos 8 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial'),
    handleValidationErrors
  ],
  logActivity('password_reset'),
  async (req, res) => {
    try {
      const { token, password } = req.body;
      
      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
      });
      
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido ou expirado'
        });
      }
      
      // Atualizar senha
      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      
      await user.save();
      
      res.json({
        success: true,
        message: 'Senha redefinida com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/auth/change-password - Alterar senha (usuário logado)
router.post('/change-password',
  authenticateToken,
  validatePasswordChange,
  logActivity('password_change'),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const user = await User.findById(req.user._id).select('+password');
      
      // Verificar senha atual
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Senha atual incorreta'
        });
      }
      
      // Atualizar senha
      user.password = newPassword;
      await user.save();
      
      res.json({
        success: true,
        message: 'Senha alterada com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/auth/verify-email/:token - Verificar email
router.get('/verify-email/:token',
  logActivity('email_verification'),
  async (req, res) => {
    try {
      const { token } = req.params;
      
      const user = await User.findOne({ emailVerificationToken: token });
      
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Token de verificação inválido'
        });
      }
      
      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      await user.save();
      
      res.json({
        success: true,
        message: 'Email verificado com sucesso'
      });
      
    } catch (error) {
      console.error('Erro na verificação de email:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/auth/me - Obter dados do usuário logado
router.get('/me',
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
        .populate('subscription')
        .select('-password -emailVerificationToken -passwordResetToken -twoFactorSecret');
      
      res.json({
        success: true,
        data: { user }
      });
      
    } catch (error) {
      console.error('Erro ao obter dados do usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

module.exports = router;