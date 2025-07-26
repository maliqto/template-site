const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const validator = require('validator');

// Middleware de autenticação simplificado
const simpleAuth = (req, res, next) => {
  // Por enquanto, apenas passa adiante
  req.user = { _id: 'test', id: 'test', username: 'test', email: 'test@test.com' };
  next();
};

// Rota para obter estatísticas do usuário
router.get('/stats', simpleAuth, async (req, res) => {
    try {
        // Para o middleware simpleAuth, retornar dados mockados
        const stats = {
            totalRequests: 0,
            totalCredits: 10,
            securityScans: 0,
            daysActive: 1,
            recentActivityCount: 0
        };
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Rota para obter histórico de atividades
router.get('/activity', simpleAuth, async (req, res) => {
    try {
        const activities = [
            {
                id: '1',
                type: 'login',
                description: 'Login realizado',
                createdAt: new Date(),
                read: false
            }
        ];
        
        res.json({
            success: true,
            data: activities,
            pagination: {
                page: 1,
                limit: 10,
                total: 1,
                pages: 1
            }
        });
        
    } catch (error) {
        console.error('Erro ao buscar atividades:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Rota para obter histórico detalhado
router.get('/history', simpleAuth, async (req, res) => {
    try {
        const activities = [
            {
                id: '1',
                type: 'register',
                description: 'Conta criada',
                createdAt: new Date(),
                read: true
            }
        ];
        
        res.json({
            success: true,
            data: activities,
            pagination: {
                page: 1,
                limit: 50,
                total: 1,
                pages: 1
            }
        });
        
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Rota para atualizar perfil do usuário
router.put('/profile', simpleAuth, async (req, res) => {
    try {
        const { email, firstName, lastName, phone, bio } = req.body;
        
        // Validação básica de email
        if (email && !validator.isEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido'
            });
        }

        // Simular atualização bem-sucedida
        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso',
            user: {
                _id: req.user._id,
                username: req.user.username,
                email: email || req.user.email,
                firstName: firstName || 'Nome',
                lastName: lastName || 'Sobrenome',
                phone: phone || '',
                bio: bio || ''
            }
        });
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;