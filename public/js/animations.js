// Animation System - Sistema de Animações

// Configurações de animação
const AnimationConfig = {
    duration: 300,
    easing: 'ease-in-out',
    stagger: 100
};

// Sistema de animações
const AnimationSystem = {
    // Inicializar animações
    init() {
        this.setupScrollAnimations();
        this.setupHoverAnimations();
        this.setupLoadAnimations();
    },

    // Configurar animações de scroll
    setupScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);

        // Observar elementos com data-aos
        document.querySelectorAll('[data-aos]').forEach(el => {
            observer.observe(el);
        });
    },

    // Configurar animações de hover
    setupHoverAnimations() {
        document.querySelectorAll('.btn, .card, .feature-item').forEach(el => {
            el.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.transition = 'transform 0.2s ease';
            });

            el.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });
    },

    // Configurar animações de carregamento
    setupLoadAnimations() {
        // Fade in da página
        document.body.style.opacity = '0';
        window.addEventListener('load', () => {
            document.body.style.transition = 'opacity 0.5s ease';
            document.body.style.opacity = '1';
        });
    },

    // Animar entrada de elementos
    fadeIn(element, duration = AnimationConfig.duration) {
        element.style.opacity = '0';
        element.style.transition = `opacity ${duration}ms ${AnimationConfig.easing}`;
        
        requestAnimationFrame(() => {
            element.style.opacity = '1';
        });
    },

    // Animar saída de elementos
    fadeOut(element, duration = AnimationConfig.duration) {
        element.style.transition = `opacity ${duration}ms ${AnimationConfig.easing}`;
        element.style.opacity = '0';
        
        return new Promise(resolve => {
            setTimeout(resolve, duration);
        });
    },

    // Slide up animation
    slideUp(element, duration = AnimationConfig.duration) {
        element.style.transform = 'translateY(20px)';
        element.style.opacity = '0';
        element.style.transition = `all ${duration}ms ${AnimationConfig.easing}`;
        
        requestAnimationFrame(() => {
            element.style.transform = 'translateY(0)';
            element.style.opacity = '1';
        });
    },

    // Stagger animation para múltiplos elementos
    staggerIn(elements, delay = AnimationConfig.stagger) {
        elements.forEach((element, index) => {
            setTimeout(() => {
                this.slideUp(element);
            }, index * delay);
        });
    }
};

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AnimationSystem.init());
} else {
    AnimationSystem.init();
}

// Exportar para uso global
window.AnimationSystem = AnimationSystem;