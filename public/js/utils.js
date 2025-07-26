/**
 * Utility functions for Black Digital AI Dashboard
 * Version: 1.0.0
 */

// DOM Utilities
const DOM = {
    /**
     * Get element by ID
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    get(id) {
        return document.getElementById(id);
    },

    /**
     * Query selector
     * @param {string} selector - CSS selector
     * @returns {HTMLElement|null}
     */
    query(selector) {
        return document.querySelector(selector);
    },

    /**
     * Query all elements
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    queryAll(selector) {
        return document.querySelectorAll(selector);
    },

    /**
     * Create element with attributes
     * @param {string} tag - HTML tag
     * @param {Object} attributes - Element attributes
     * @param {string} content - Element content
     * @returns {HTMLElement}
     */
    create(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        if (content) {
            element.innerHTML = content;
        }
        return element;
    },

    /**
     * Add event listener with cleanup
     * @param {HTMLElement} element - Target element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @returns {Function} Cleanup function
     */
    on(element, event, handler) {
        element.addEventListener(event, handler);
        return () => element.removeEventListener(event, handler);
    }
};

// Format Utilities
const Format = {
    /**
     * Format number with commas
     * @param {number} num - Number to format
     * @returns {string}
     */
    number(num) {
        return new Intl.NumberFormat('pt-BR').format(num);
    },

    /**
     * Format currency
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code
     * @returns {string}
     */
    currency(amount, currency = 'BRL') {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },

    /**
     * Format date
     * @param {Date|string} date - Date to format
     * @param {Object} options - Formatting options
     * @returns {string}
     */
    date(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Intl.DateTimeFormat('pt-BR', { ...defaultOptions, ...options })
            .format(new Date(date));
    },

    /**
     * Format relative time
     * @param {Date|string} date - Date to format
     * @returns {string}
     */
    relativeTime(date) {
        const now = new Date();
        const target = new Date(date);
        const diffInSeconds = Math.floor((now - target) / 1000);

        if (diffInSeconds < 60) return 'agora mesmo';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min atrás`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} h atrás`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} dias atrás`;
        
        return Format.date(date, { month: 'short', day: 'numeric' });
    },

    /**
     * Format file size
     * @param {number} bytes - Size in bytes
     * @returns {string}
     */
    fileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
};

// Storage Utilities
const Storage = {
    /**
     * Get item from localStorage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*}
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Storage get error:', error);
            return defaultValue;
        }
    },

    /**
     * Set item in localStorage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn('Storage set error:', error);
        }
    },

    /**
     * Remove item from localStorage
     * @param {string} key - Storage key
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('Storage remove error:', error);
        }
    },

    /**
     * Clear all localStorage
     */
    clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.warn('Storage clear error:', error);
        }
    }
};

// Animation Utilities
const Animation = {
    /**
     * Animate number counting
     * @param {HTMLElement} element - Target element
     * @param {number} start - Start value
     * @param {number} end - End value
     * @param {number} duration - Animation duration in ms
     */
    countUp(element, start, end, duration = 1000) {
        const startTime = performance.now();
        const difference = end - start;

        function updateCount(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = start + (difference * this.easeOutQuart(progress));
            
            element.textContent = Math.floor(current).toLocaleString('pt-BR');
            
            if (progress < 1) {
                requestAnimationFrame(updateCount);
            }
        }

        requestAnimationFrame(updateCount);
    },

    /**
     * Easing function - ease out quart
     * @param {number} t - Progress (0-1)
     * @returns {number}
     */
    easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    },

    /**
     * Fade in element
     * @param {HTMLElement} element - Target element
     * @param {number} duration - Animation duration in ms
     */
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        const startTime = performance.now();
        
        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = progress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        requestAnimationFrame(animate);
    },

    /**
     * Fade out element
     * @param {HTMLElement} element - Target element
     * @param {number} duration - Animation duration in ms
     */
    fadeOut(element, duration = 300) {
        const startTime = performance.now();
        const startOpacity = parseFloat(getComputedStyle(element).opacity);
        
        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = startOpacity * (1 - progress);
            
            if (progress >= 1) {
                element.style.display = 'none';
            } else {
                requestAnimationFrame(animate);
            }
        }
        
        requestAnimationFrame(animate);
    }
};

// Validation Utilities
const Validate = {
    /**
     * Validate email
     * @param {string} email - Email to validate
     * @returns {boolean}
     */
    email(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    /**
     * Validate URL
     * @param {string} url - URL to validate
     * @returns {boolean}
     */
    url(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Validate required field
     * @param {*} value - Value to validate
     * @returns {boolean}
     */
    required(value) {
        return value !== null && value !== undefined && value !== '';
    },

    /**
     * Validate minimum length
     * @param {string} value - Value to validate
     * @param {number} min - Minimum length
     * @returns {boolean}
     */
    minLength(value, min) {
        return value && value.length >= min;
    }
};

// Debounce and Throttle
const Timing = {
    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function}
     */
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

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in ms
     * @returns {Function}
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DOM,
        Format,
        Storage,
        Animation,
        Validate,
        Timing
    };
} else {
    window.Utils = {
        DOM,
        Format,
        Storage,
        Animation,
        Validate,
        Timing
    };
}