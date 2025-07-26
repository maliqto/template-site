// Main JavaScript - Funcionalidades principais do site

// Configurações globais
const CONFIG = {
    API_BASE_URL: '/api',
    ANIMATION_DURATION: 300,
    NOTIFICATION_DURATION: 5000,
    TYPING_SPEED: 50
};

// Estado global da aplicação
const AppState = {
    user: null,
    isAuthenticated: false,
    currentPage: 'home',
    notifications: [],
    modals: new Map()
};

// Utilitários
const Utils = {
    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Format currency
    formatCurrency(amount, currency = 'BRL') {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },

    // Format date
    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return new Intl.DateTimeFormat('pt-BR', { ...defaultOptions, ...options }).format(new Date(date));
    },

    // Generate random ID
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    },

    // Validate email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Validate password strength
    validatePassword(password) {
        const minLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        return {
            isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial,
            score: [minLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length,
            requirements: {
                minLength,
                hasUpper,
                hasLower,
                hasNumber,
                hasSpecial
            }
        };
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            NotificationSystem.show('Copiado para a área de transferência!', 'success');
        } catch (err) {
            console.error('Erro ao copiar:', err);
            NotificationSystem.show('Erro ao copiar para a área de transferência', 'error');
        }
    },

    // Smooth scroll to element
    scrollTo(element, offset = 0) {
        const targetElement = typeof element === 'string' ? document.querySelector(element) : element;
        if (targetElement) {
            const targetPosition = targetElement.offsetTop - offset;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    }
};

// Sistema de Notificações
const NotificationSystem = {
    container: null,

    init() {
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 3000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(this.container);
    },

    show(message, type = 'info', duration = CONFIG.NOTIFICATION_DURATION) {
        const notification = document.createElement('div');
        const id = Utils.generateId();
        
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">${this.getTitle(type)}</span>
                <button class="notification-close" onclick="NotificationSystem.remove('${id}')">&times;</button>
            </div>
            <div class="notification-message">${message}</div>
        `;
        
        notification.id = id;
        this.container.appendChild(notification);
        
        // Auto remove
        setTimeout(() => this.remove(id), duration);
        
        return id;
    },

    remove(id) {
        const notification = document.getElementById(id);
        if (notification) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    },

    getTitle(type) {
        const titles = {
            success: 'Sucesso',
            error: 'Erro',
            warning: 'Aviso',
            info: 'Informação'
        };
        return titles[type] || 'Notificação';
    }
};

// Sistema de Loading
const LoadingSystem = {
    overlay: null,

    init() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'loading-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(10, 10, 10, 0.8);
            backdrop-filter: blur(5px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 4000;
        `;
        
        this.overlay.innerHTML = `
            <div class="loading-content" style="text-align: center; color: white;">
                <div class="spinner spinner-large"></div>
                <div style="margin-top: 20px; font-size: 16px;">Carregando...</div>
            </div>
        `;
        
        document.body.appendChild(this.overlay);
    },

    show(message = 'Carregando...') {
        const messageElement = this.overlay.querySelector('.loading-content div:last-child');
        messageElement.textContent = message;
        this.overlay.style.display = 'flex';
    },

    hide() {
        this.overlay.style.display = 'none';
    }
};

// Sistema de Modais
const ModalSystem = {
    init() {
        // Event listeners para modais
        document.addEventListener('click', (e) => {
            // Fechar modal ao clicar no overlay
            if (e.target.classList.contains('modal')) {
                this.close(e.target.id);
            }
            
            // Fechar modal ao clicar no botão de fechar
            if (e.target.classList.contains('modal-close')) {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.close(modal.id);
                }
            }
        });
        
        // Fechar modal com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    this.close(activeModal.id);
                }
            }
        });
    },

    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Focus no primeiro input
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    },

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            
            // Reset form if exists
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
            }
        }
    }
};

// Navegação
const Navigation = {
    init() {
        this.setupScrollEffect();
        this.setupMobileMenu();
        this.setupSmoothScroll();
        this.setupActiveLinks();
    },

    setupScrollEffect() {
        const navbar = document.getElementById('navbar');
        
        if (navbar) {
            window.addEventListener('scroll', Utils.throttle(() => {
                if (window.scrollY > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            }, 100));
        }
    },

    setupMobileMenu() {
        const navToggle = document.getElementById('nav-toggle');
        const navMenu = document.getElementById('nav-menu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navToggle.classList.toggle('active');
                navMenu.classList.toggle('active');
            });
            
            // Fechar menu ao clicar em um link
            navMenu.addEventListener('click', (e) => {
                if (e.target.classList.contains('nav-link')) {
                    navToggle.classList.remove('active');
                    navMenu.classList.remove('active');
                }
            });
        }
    },

    setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const href = anchor.getAttribute('href');
                if (href && href !== '#') {
                    const target = document.querySelector(href);
                    if (target) {
                        Utils.scrollTo(target, 80);
                    }
                }
            });
        });
    },

    setupActiveLinks() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link');
        
        window.addEventListener('scroll', Utils.throttle(() => {
            let current = '';
            
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.clientHeight;
                if (window.scrollY >= sectionTop - 100) {
                    current = section.getAttribute('id');
                }
            });
            
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${current}`) {
                    link.classList.add('active');
                }
            });
        }, 100));
    }
};

// Animações
const Animations = {
    init() {
        this.setupAOS();
        this.setupTypingEffect();
        this.setupCounters();
    },

    setupAOS() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('aos-animate');
                }
            });
        }, observerOptions);
        
        document.querySelectorAll('[data-aos]').forEach(el => {
            observer.observe(el);
        });
    },

    setupTypingEffect() {
        const typingElements = document.querySelectorAll('.typing-text');
        
        typingElements.forEach(element => {
            const text = element.textContent;
            element.textContent = '';
            
            let i = 0;
            const typeWriter = () => {
                if (i < text.length) {
                    element.textContent += text.charAt(i);
                    i++;
                    setTimeout(typeWriter, CONFIG.TYPING_SPEED);
                }
            };
            
            // Iniciar animação quando elemento estiver visível
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        typeWriter();
                        observer.unobserve(entry.target);
                    }
                });
            });
            
            observer.observe(element);
        });
    },

    setupCounters() {
        const counters = document.querySelectorAll('.stat-number');
        
        counters.forEach(counter => {
            const target = parseInt(counter.textContent.replace(/[^0-9]/g, ''));
            const suffix = counter.textContent.replace(/[0-9]/g, '');
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.animateCounter(counter, target, suffix);
                        observer.unobserve(entry.target);
                    }
                });
            });
            
            observer.observe(counter);
        });
    },

    animateCounter(element, target, suffix = '') {
        let current = 0;
        const increment = target / 100;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target + suffix;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current) + suffix;
            }
        }, 20);
    }
};

// Event Handlers
const EventHandlers = {
    init() {
        this.setupButtonHandlers();
        this.setupFormHandlers();
    },

    setupButtonHandlers() {
        // Login button
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                ModalSystem.open('login-modal');
            });
        }
        
        // Register button
        const registerBtn = document.getElementById('register-btn');
        if (registerBtn) {
            registerBtn.addEventListener('click', () => {
                ModalSystem.open('register-modal');
            });
        }
        
        // Switch between login and register
        const switchToRegister = document.getElementById('switch-to-register');
        if (switchToRegister) {
            switchToRegister.addEventListener('click', (e) => {
                e.preventDefault();
                ModalSystem.close('login-modal');
                ModalSystem.open('register-modal');
            });
        }
        
        const switchToLogin = document.getElementById('switch-to-login');
        if (switchToLogin) {
            switchToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                ModalSystem.close('register-modal');
                ModalSystem.open('login-modal');
            });
        }
        
        // Start hacking button
        const startHackingBtn = document.getElementById('start-hacking-btn');
        if (startHackingBtn) {
            startHackingBtn.addEventListener('click', () => {
                if (AppState.isAuthenticated) {
                    window.location.href = '/dashboard';
                } else {
                    ModalSystem.open('register-modal');
                }
            });
        }
        
        // Demo button
        const demoBtn = document.getElementById('demo-btn');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                Utils.scrollTo('#features');
            });
        }
    },

    setupFormHandlers() {
        // Contact form
        const contactForm = document.querySelector('.contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', this.handleContactForm);
        }
    },

    async handleContactForm(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            subject: formData.get('subject'),
            message: formData.get('message')
        };
        
        try {
            LoadingSystem.show('Enviando mensagem...');
            
            // Simular envio (substituir por chamada real da API)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            NotificationSystem.show('Mensagem enviada com sucesso! Entraremos em contato em breve.', 'success');
            e.target.reset();
            
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            NotificationSystem.show('Erro ao enviar mensagem. Tente novamente.', 'error');
        } finally {
            LoadingSystem.hide();
        }
    }
};

// Inicialização
class App {
    constructor() {
        this.init();
    }

    init() {
        // Aguardar DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
    }

    start() {
        console.log('🚀 Black Digital AI - Iniciando aplicação...');
        
        // Inicializar sistemas
        NotificationSystem.init();
        LoadingSystem.init();
        ModalSystem.init();
        Navigation.init();
        Animations.init();
        EventHandlers.init();
        
        // Remover loading screen
        this.removeLoadingScreen();
        
        // Verificar autenticação
        this.checkAuthentication();
        
        console.log('✅ Aplicação iniciada com sucesso!');
    }

    removeLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                setTimeout(() => {
                    loadingScreen.remove();
                }, 500);
            }, 1500);
        }
    }

    async checkAuthentication() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                // Verificar se o token ainda é válido
                const response = await fetch(`${CONFIG.API_BASE_URL}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const userData = await response.json();
                    AppState.user = userData.data.user;
                    AppState.isAuthenticated = true;
                    this.updateUIForAuthenticatedUser();
                }
            } catch (error) {
                console.error('Erro ao verificar autenticação:', error);
                localStorage.removeItem('token');
            }
        }
    }

    updateUIForAuthenticatedUser() {
        // Atualizar interface para usuário logado
        const loginBtn = document.getElementById('login-btn');
        const registerBtn = document.getElementById('register-btn');
        
        if (loginBtn && registerBtn) {
            loginBtn.textContent = 'Dashboard';
            loginBtn.onclick = () => window.location.href = '/dashboard';
            
            registerBtn.textContent = 'Logout';
            registerBtn.onclick = () => this.logout();
        }
    }

    async logout() {
        try {
            await fetch(`${CONFIG.API_BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        } finally {
            localStorage.removeItem('token');
            AppState.user = null;
            AppState.isAuthenticated = false;
            window.location.reload();
        }
    }
}

// Inicializar aplicação
const app = new App();

// Exportar para uso global
window.App = app;
window.Utils = Utils;
window.NotificationSystem = NotificationSystem;
window.LoadingSystem = LoadingSystem;
window.ModalSystem = ModalSystem;
window.CONFIG = CONFIG;
window.AppState = AppState;

// CSS adicional para animações
const additionalCSS = `
@keyframes slideOutRight {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}

.notification-container {
    pointer-events: none;
}

.notification {
    pointer-events: all;
}
`;

const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);