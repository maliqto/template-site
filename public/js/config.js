/**
 * Configuration file for Black Digital AI Dashboard
 * Version: 1.0.0
 */

// API Configuration
const API_CONFIG = {
    baseURL: '/api',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
};

// Dashboard Configuration
const DASHBOARD_CONFIG = {
    refreshInterval: 30000, // 30 seconds
    animationDuration: 300,
    maxNotifications: 5,
    autoSaveInterval: 60000, // 1 minute
    theme: {
        default: 'dark',
        options: ['light', 'dark', 'auto']
    },
    sidebar: {
        defaultCollapsed: false,
        breakpoint: 1024
    }
};

// Feature Flags
const FEATURES = {
    analytics: true,
    realTimeUpdates: true,
    notifications: true,
    darkMode: true,
    exportData: true,
    advancedSearch: true
};

// Tool Configuration
const TOOLS_CONFIG = {
    textGeneration: {
        enabled: true,
        maxLength: 4000,
        models: ['gpt-4', 'gpt-3.5-turbo', 'claude-3']
    },
    codeGeneration: {
        enabled: true,
        languages: ['javascript', 'python', 'java', 'cpp', 'html', 'css'],
        maxLines: 1000
    },
    imageAnalysis: {
        enabled: true,
        maxFileSize: 10485760, // 10MB
        supportedFormats: ['jpg', 'jpeg', 'png', 'webp']
    },
    security: {
        vulnerabilityScanning: true,
        penetrationTesting: true,
        networkAnalysis: true,
        passwordAudit: true
    }
};

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_CONFIG,
        DASHBOARD_CONFIG,
        FEATURES,
        TOOLS_CONFIG
    };
} else {
    window.CONFIG = {
        API_CONFIG,
        DASHBOARD_CONFIG,
        FEATURES,
        TOOLS_CONFIG
    };
}