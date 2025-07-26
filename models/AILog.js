const mongoose = require('mongoose');

const aiLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Usuário é obrigatório']
  },
  sessionId: {
    type: String,
    required: [true, 'ID da sessão é obrigatório'],
    index: true
  },
  requestType: {
    type: String,
    enum: ['text_generation', 'code_generation', 'image_analysis', 'chat', 'hacking_tools', 'vulnerability_scan', 'penetration_test'],
    required: [true, 'Tipo de requisição é obrigatório']
  },
  model: {
    type: String,
    required: [true, 'Modelo de IA é obrigatório'],
    enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-pro', 'custom-hacking-ai']
  },
  input: {
    prompt: {
      type: String,
      required: [true, 'Prompt é obrigatório'],
      maxlength: [10000, 'Prompt deve ter no máximo 10000 caracteres']
    },
    parameters: {
      temperature: {
        type: Number,
        min: 0,
        max: 2,
        default: 0.7
      },
      maxTokens: {
        type: Number,
        min: 1,
        max: 4000,
        default: 1000
      },
      topP: {
        type: Number,
        min: 0,
        max: 1,
        default: 1
      },
      frequencyPenalty: {
        type: Number,
        min: -2,
        max: 2,
        default: 0
      },
      presencePenalty: {
        type: Number,
        min: -2,
        max: 2,
        default: 0
      }
    },
    files: [{
      filename: String,
      path: String,
      size: Number,
      mimeType: String
    }],
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  output: {
    response: {
      type: String,
      maxlength: [50000, 'Resposta deve ter no máximo 50000 caracteres']
    },
    tokensUsed: {
      input: {
        type: Number,
        default: 0
      },
      output: {
        type: Number,
        default: 0
      },
      total: {
        type: Number,
        default: 0
      }
    },
    finishReason: {
      type: String,
      enum: ['stop', 'length', 'content_filter', 'error'],
      default: 'stop'
    },
    quality: {
      type: String,
      enum: ['excellent', 'good', 'average', 'poor'],
      default: null
    },
    userRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    userFeedback: {
      type: String,
      maxlength: [1000, 'Feedback deve ter no máximo 1000 caracteres'],
      default: null
    }
  },
  performance: {
    processingTime: {
      type: Number,
      required: [true, 'Tempo de processamento é obrigatório'],
      min: [0, 'Tempo de processamento deve ser positivo']
    },
    queueTime: {
      type: Number,
      default: 0
    },
    totalTime: {
      type: Number,
      default: 0
    },
    serverLoad: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    }
  },
  cost: {
    credits: {
      type: Number,
      required: [true, 'Créditos gastos são obrigatórios'],
      min: [0, 'Créditos devem ser positivos']
    },
    usdCost: {
      type: Number,
      default: 0
    },
    calculation: {
      inputCost: {
        type: Number,
        default: 0
      },
      outputCost: {
        type: Number,
        default: 0
      },
      additionalCost: {
        type: Number,
        default: 0
      }
    }
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  error: {
    code: {
      type: String,
      default: null
    },
    message: {
      type: String,
      default: null
    },
    stack: {
      type: String,
      default: null
    },
    retryCount: {
      type: Number,
      default: 0
    }
  },
  metadata: {
    ipAddress: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    platform: {
      type: String,
      enum: ['web', 'mobile', 'api', 'cli'],
      default: 'web'
    },
    version: {
      type: String,
      default: '1.0.0'
    },
    tags: [{
      type: String,
      maxlength: 50
    }],
    category: {
      type: String,
      enum: ['general', 'hacking', 'security', 'development', 'analysis', 'research'],
      default: 'general'
    }
  },
  security: {
    contentFiltered: {
      type: Boolean,
      default: false
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    flaggedContent: [{
      type: String,
      enum: ['violence', 'hate', 'harassment', 'self-harm', 'sexual', 'illegal', 'malware']
    }],
    approved: {
      type: Boolean,
      default: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted processing time
aiLogSchema.virtual('formattedProcessingTime').get(function() {
  if (this.performance.processingTime < 1000) {
    return `${this.performance.processingTime}ms`;
  }
  return `${(this.performance.processingTime / 1000).toFixed(2)}s`;
});

// Virtual for efficiency score
aiLogSchema.virtual('efficiencyScore').get(function() {
  if (!this.output.tokensUsed.total || !this.performance.processingTime) return 0;
  return Math.round((this.output.tokensUsed.total / this.performance.processingTime) * 1000);
});

// Pre-save middleware
aiLogSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate total tokens
  if (this.output.tokensUsed.input && this.output.tokensUsed.output) {
    this.output.tokensUsed.total = this.output.tokensUsed.input + this.output.tokensUsed.output;
  }
  
  // Calculate total time
  if (this.performance.processingTime && this.performance.queueTime) {
    this.performance.totalTime = this.performance.processingTime + this.performance.queueTime;
  }
  
  // Set completion date
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = Date.now();
  }
  
  next();
});

// Static method to get user usage statistics
aiLogSchema.statics.getUserStats = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        totalCredits: { $sum: '$cost.credits' },
        totalTokens: { $sum: '$output.tokensUsed.total' },
        avgProcessingTime: { $avg: '$performance.processingTime' },
        avgRating: { $avg: '$output.userRating' },
        requestTypes: {
          $push: '$requestType'
        }
      }
    }
  ]);
};

// Static method to get popular models
aiLogSchema.statics.getPopularModels = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$model',
        count: { $sum: 1 },
        avgRating: { $avg: '$output.userRating' },
        avgProcessingTime: { $avg: '$performance.processingTime' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
};

// Method to mark as completed
aiLogSchema.methods.markCompleted = function(response, tokensUsed, processingTime) {
  this.status = 'completed';
  this.output.response = response;
  this.output.tokensUsed = tokensUsed;
  this.performance.processingTime = processingTime;
  this.completedAt = Date.now();
  return this.save();
};

// Method to mark as failed
aiLogSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.error.code = error.code || 'UNKNOWN_ERROR';
  this.error.message = error.message;
  this.error.stack = error.stack;
  return this.save();
};

// Indexes
aiLogSchema.index({ user: 1, createdAt: -1 });
aiLogSchema.index({ sessionId: 1 });
aiLogSchema.index({ status: 1 });
aiLogSchema.index({ requestType: 1 });
aiLogSchema.index({ model: 1 });
aiLogSchema.index({ createdAt: -1 });
aiLogSchema.index({ 'metadata.category': 1 });
aiLogSchema.index({ 'security.riskLevel': 1 });

module.exports = mongoose.model('AILog', aiLogSchema);