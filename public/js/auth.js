// Authentication System - Sistema de Autenticação

class AuthSystem {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = null;
        this.isAuthenticated = false;
        this.init();
    }

    init() {
        this.setupFormHandlers();
        this.setupPasswordValidation();
        this.checkAuthStatus();
    }

    setupFormHandlers() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Forgot password form
        const forgotPasswordForm = document.getElementById('forgot-password-form');
        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
        }
    }

    setupPasswordValidation() {
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        
        passwordInputs.forEach(input => {
            if (input.name === 'password' || input.name === 'newPassword') {
                input.addEventListener('input', (e) => this.validatePasswordStrength(e.target));
            }
        });

        // Confirm password validation
        const confirmPasswordInputs = document.querySelectorAll('input[name="confirmPassword"]');
        confirmPasswordInputs.forEach(input => {
            input.addEventListener('input', (e) => this.validatePasswordMatch(e.target));
        });
    }

    validatePasswordStrength(passwordInput) {
        const password = passwordInput.value;
        const validation = Utils.validatePassword(password);
        
        // Remove existing strength indicator
        const existingIndicator = passwordInput.parentNode.querySelector('.password-strength');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        if (password.length > 0) {
            const strengthIndicator = document.createElement('div');
            strengthIndicator.className = 'password-strength';
            
            const strengthLevels = ['Muito Fraca', 'Fraca', 'Regular', 'Boa', 'Forte'];
            const strengthColors = ['#ff4757', '#ff6b7a', '#ffa502', '#2ed573', '#20bf6b'];
            
            const strengthLevel = Math.min(validation.score, 4);
            const strengthText = strengthLevels[strengthLevel];
            const strengthColor = strengthColors[strengthLevel];
            
            strengthIndicator.innerHTML = `
                <div class="strength-bar">
                    <div class="strength-fill" style="width: ${(validation.score / 5) * 100}%; background-color: ${strengthColor};"></div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span class="strength-text" style="color: ${strengthColor}; font-size: 12px; font-weight: 500;">
                        ${strengthText}
                    </span>
                    <span style="font-size: 10px; color: #666; cursor: help;" title="${this.getPasswordRequirementsText(validation.requirements)}">
                        ${this.getPasswordRequirementsShort(validation.requirements)}
                    </span>
                </div>
            `;
            
            passwordInput.parentNode.appendChild(strengthIndicator);
        }
    }

    getPasswordRequirements(requirements) {
        const reqList = [
            { key: 'minLength', text: 'Mínimo 8 caracteres' },
            { key: 'hasUpper', text: 'Letra maiúscula' },
            { key: 'hasLower', text: 'Letra minúscula' },
            { key: 'hasNumber', text: 'Número' },
            { key: 'hasSpecial', text: 'Caractere especial' }
        ];

        return reqList.map(req => {
            const status = requirements[req.key] ? '✓' : '✗';
            const color = requirements[req.key] ? '#20bf6b' : '#ff4757';
            return `<span style="color: ${color};">${status} ${req.text}</span>`;
        }).join(' | ');
    }

    getPasswordRequirementsShort(requirements) {
        const reqList = [
            { key: 'minLength', symbol: '8+' },
            { key: 'hasUpper', symbol: 'A' },
            { key: 'hasLower', symbol: 'a' },
            { key: 'hasNumber', symbol: '1' },
            { key: 'hasSpecial', symbol: '@' }
        ];

        return reqList.map(req => {
            const color = requirements[req.key] ? '#20bf6b' : '#ff4757';
            return `<span style="color: ${color};">${req.symbol}</span>`;
        }).join(' ');
    }

    getPasswordRequirementsText(requirements) {
        const reqList = [
            { key: 'minLength', text: 'Mínimo 8 caracteres' },
            { key: 'hasUpper', text: 'Letra maiúscula' },
            { key: 'hasLower', text: 'Letra minúscula' },
            { key: 'hasNumber', text: 'Número' },
            { key: 'hasSpecial', text: 'Caractere especial' }
        ];

        return reqList.map(req => {
            const status = requirements[req.key] ? '✓' : '✗';
            return `${status} ${req.text}`;
        }).join('\n');
    }

    validatePasswordMatch(confirmPasswordInput) {
        const passwordInput = confirmPasswordInput.form.querySelector('input[name="password"]');
        const password = passwordInput ? passwordInput.value : '';
        const confirmPassword = confirmPasswordInput.value;
        
        // Remove existing match indicator
        const existingIndicator = confirmPasswordInput.parentNode.querySelector('.password-match');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        if (confirmPassword.length > 0) {
            const matchIndicator = document.createElement('div');
            matchIndicator.className = 'password-match';
            
            const isMatch = password === confirmPassword;
            const color = isMatch ? '#20bf6b' : '#ff4757';
            const text = isMatch ? '✓ Senhas coincidem' : '✗ Senhas não coincidem';
            
            matchIndicator.innerHTML = `
                <div style="color: ${color}; font-size: 12px; margin-top: 4px;">
                    ${text}
                </div>
            `;
            
            confirmPasswordInput.parentNode.appendChild(matchIndicator);
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const loginData = {
            login: formData.get('login'),
            password: formData.get('password')
        };

        // Validação básica
        if (!loginData.login || !loginData.password) {
            NotificationSystem.show('Por favor, preencha todos os campos', 'error');
            return;
        }

        try {
            LoadingSystem.show('Fazendo login...');
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });

            const result = await response.json();

            if (response.ok) {
                // Login bem-sucedido
                this.token = result.data.token;
                this.user = result.data.user;
                this.isAuthenticated = true;
                
                localStorage.setItem('token', this.token);
                
                NotificationSystem.show(`Bem-vindo de volta, ${this.user.username}!`, 'success');
                
                // Fechar modal e redirecionar
                ModalSystem.close('login-modal');
                
                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 1500);
                
            } else {
                // Erro no login
                NotificationSystem.show(result.message || 'Erro ao fazer login', 'error');
                
                // Limpar senha
                const passwordInput = e.target.querySelector('input[name="password"]');
                if (passwordInput) {
                    passwordInput.value = '';
                }
            }
            
        } catch (error) {
            console.error('Erro no login:', error);
            NotificationSystem.show('Erro de conexão. Tente novamente.', 'error');
        } finally {
            LoadingSystem.hide();
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const registerData = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            confirmPassword: formData.get('confirmPassword'),
            acceptTerms: formData.get('acceptTerms') === 'on'
        };

        // Validação básica
        if (!registerData.username || !registerData.email || !registerData.password || !registerData.confirmPassword) {
            NotificationSystem.show('Por favor, preencha todos os campos', 'error');
            return;
        }

        if (!registerData.acceptTerms) {
            NotificationSystem.show('Você deve aceitar os termos de uso', 'error');
            return;
        }

        if (!Utils.isValidEmail(registerData.email)) {
            NotificationSystem.show('Por favor, insira um email válido', 'error');
            return;
        }

        if (registerData.password !== registerData.confirmPassword) {
            NotificationSystem.show('As senhas não coincidem', 'error');
            return;
        }

        const passwordValidation = Utils.validatePassword(registerData.password);
        if (!passwordValidation.isValid) {
            NotificationSystem.show('A senha não atende aos requisitos mínimos', 'error');
            return;
        }

        if (registerData.username.length < 3) {
            NotificationSystem.show('O nome de usuário deve ter pelo menos 3 caracteres', 'error');
            return;
        }

        try {
            LoadingSystem.show('Criando conta...');
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: registerData.username,
                    email: registerData.email,
                    password: registerData.password,
                    confirmPassword: registerData.confirmPassword,
                    acceptTerms: registerData.acceptTerms
                })
            });

            const result = await response.json();

            if (response.ok) {
                // Registro bem-sucedido
                NotificationSystem.show('Conta criada com sucesso! Fazendo login...', 'success');
                
                // Fazer login automaticamente
                setTimeout(async () => {
                    try {
                        const loginResponse = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                login: registerData.email,
                                password: registerData.password
                            })
                        });

                        const loginResult = await loginResponse.json();

                        if (loginResponse.ok) {
                            this.token = loginResult.data.token;
                            this.user = loginResult.data.user;
                            this.isAuthenticated = true;
                            
                            localStorage.setItem('token', this.token);
                            
                            ModalSystem.close('register-modal');
                            
                            setTimeout(() => {
                                window.location.href = '/dashboard.html';
                            }, 1000);
                        }
                    } catch (error) {
                        console.error('Erro no login automático:', error);
                        ModalSystem.close('register-modal');
                        ModalSystem.open('login-modal');
                    }
                }, 1000);
                
            } else {
                // Erro no registro
                NotificationSystem.show(result.message || 'Erro ao criar conta', 'error');
            }
            
        } catch (error) {
            console.error('Erro no registro:', error);
            NotificationSystem.show('Erro de conexão. Tente novamente.', 'error');
        } finally {
            LoadingSystem.hide();
        }
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const email = formData.get('email');

        if (!email) {
            NotificationSystem.show('Por favor, insira seu email', 'error');
            return;
        }

        if (!Utils.isValidEmail(email)) {
            NotificationSystem.show('Por favor, insira um email válido', 'error');
            return;
        }

        try {
            LoadingSystem.show('Enviando email de recuperação...');
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const result = await response.json();

            if (response.ok) {
                NotificationSystem.show('Email de recuperação enviado! Verifique sua caixa de entrada.', 'success');
                e.target.reset();
            } else {
                NotificationSystem.show(result.message || 'Erro ao enviar email de recuperação', 'error');
            }
            
        } catch (error) {
            console.error('Erro na recuperação de senha:', error);
            NotificationSystem.show('Erro de conexão. Tente novamente.', 'error');
        } finally {
            LoadingSystem.hide();
        }
    }

    async checkAuthStatus() {
        if (this.token) {
            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    this.user = result.data.user;
                    this.isAuthenticated = true;
                    this.updateUI();
                } else {
                    this.logout();
                }
            } catch (error) {
                console.error('Erro ao verificar autenticação:', error);
                this.logout();
            }
        }
    }

    updateUI() {
        if (this.isAuthenticated && this.user) {
            // Atualizar botões de navegação
            const loginBtn = document.getElementById('login-btn');
            const registerBtn = document.getElementById('register-btn');
            
            if (loginBtn) {
                loginBtn.textContent = 'Dashboard';
                loginBtn.onclick = () => window.location.href = '/dashboard.html';
            }
            
            if (registerBtn) {
                registerBtn.textContent = 'Sair';
                registerBtn.onclick = () => this.logout();
            }

            // Atualizar AppState global
            AppState.user = this.user;
            AppState.isAuthenticated = this.isAuthenticated;
        }
    }

    async logout() {
        try {
            if (this.token) {
                await fetch(`${CONFIG.API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
            }
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        } finally {
            this.token = null;
            this.user = null;
            this.isAuthenticated = false;
            
            localStorage.removeItem('token');
            
            // Atualizar AppState global
            AppState.user = null;
            AppState.isAuthenticated = false;
            
            NotificationSystem.show('Logout realizado com sucesso', 'info');
            
            // Redirecionar para home se estiver em página protegida
            if (window.location.pathname !== '/') {
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                window.location.reload();
            }
        }
    }

    async refreshToken() {
        if (!this.token) return false;

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                this.token = result.data.token;
                localStorage.setItem('token', this.token);
                return true;
            } else {
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Erro ao renovar token:', error);
            this.logout();
            return false;
        }
    }

    // Método para fazer requisições autenticadas
    async authenticatedFetch(url, options = {}) {
        if (!this.token) {
            throw new Error('Usuário não autenticado');
        }

        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const response = await fetch(url, { ...options, ...defaultOptions });

        // Se token expirou, tentar renovar
        if (response.status === 401) {
            const refreshed = await this.refreshToken();
            if (refreshed) {
                // Tentar novamente com novo token
                defaultOptions.headers['Authorization'] = `Bearer ${this.token}`;
                return fetch(url, { ...options, ...defaultOptions });
            } else {
                throw new Error('Sessão expirada');
            }
        }

        return response;
    }

    // Getters
    getToken() {
        return this.token;
    }

    getUser() {
        return this.user;
    }

    isLoggedIn() {
        return this.isAuthenticated;
    }
}

// CSS adicional para validação de senha
const passwordValidationCSS = `
.password-strength {
    margin-top: 8px;
}

.strength-bar {
    width: 100%;
    height: 4px;
    background-color: #333;
    border-radius: 2px;
    overflow: hidden;
}

.strength-fill {
    height: 100%;
    transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-text {
    font-weight: 500;
}

.strength-requirements {
    line-height: 1.4;
}

.password-match {
    margin-top: 4px;
}

.form-group {
    position: relative;
}

.form-group .password-strength,
.form-group .password-match {
    position: relative;
    margin-top: 8px;
    padding: 8px;
    background: rgba(30, 30, 30, 0.8);
    border-radius: 6px;
    border: 1px solid #444;
    backdrop-filter: blur(5px);
    max-height: 120px;
    overflow-y: auto;
}
`;

const passwordStyle = document.createElement('style');
passwordStyle.textContent = passwordValidationCSS;
document.head.appendChild(passwordStyle);

// Inicializar sistema de autenticação
const authSystem = new AuthSystem();

// Exportar para uso global
window.AuthSystem = authSystem;

// Adicionar ao AppState
if (typeof AppState !== 'undefined') {
    AppState.auth = authSystem;
}