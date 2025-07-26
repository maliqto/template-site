const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Usuário é obrigatório']
  },
  type: {
    type: String,
    enum: ['credit_purchase', 'credit_usage', 'subscription', 'refund', 'bonus'],
    required: [true, 'Tipo de transação é obrigatório']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: [true, 'Valor é obrigatório'],
    min: [0, 'Valor deve ser positivo']
  },
  currency: {
    type: String,
    default: 'BRL',
    enum: ['BRL', 'USD', 'EUR']
  },
  credits: {
    type: Number,
    default: 0,
    min: [0, 'Créditos devem ser positivos']
  },
  description: {
    type: String,
    required: [true, 'Descrição é obrigatória'],
    maxlength: [500, 'Descrição deve ter no máximo 500 caracteres']
  },
  package: {
    type: String,
    enum: ['basic', 'premium', 'enterprise', 'custom'],
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'pix', 'credit_card', 'bank_transfer', 'crypto'],
    default: 'stripe'
  },
  paymentProvider: {
    transactionId: {
      type: String,
      default: null
    },
    paymentIntentId: {
      type: String,
      default: null
    },
    subscriptionId: {
      type: String,
      default: null
    },
    customerId: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  aiUsage: {
    model: {
      type: String,
      default: null
    },
    tokens: {
      type: Number,
      default: 0
    },
    requestType: {
      type: String,
      enum: ['text', 'image', 'code', 'analysis', 'chat'],
      default: null
    },
    processingTime: {
      type: Number,
      default: 0
    }
  },
  refund: {
    isRefunded: {
      type: Boolean,
      default: false
    },
    refundAmount: {
      type: Number,
      default: 0
    },
    refundDate: {
      type: Date,
      default: null
    },
    refundReason: {
      type: String,
      default: null
    },
    refundTransactionId: {
      type: String,
      default: null
    }
  },
  invoice: {
    number: {
      type: String,
      default: null
    },
    url: {
      type: String,
      default: null
    },
    pdfPath: {
      type: String,
      default: null
    }
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notas devem ter no máximo 1000 caracteres'],
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  },
  failureReason: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: this.currency
  }).format(this.amount);
});

// Virtual for transaction age
transactionSchema.virtual('age').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1 dia atrás';
  if (diffDays < 30) return `${diffDays} dias atrás`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses atrás`;
  return `${Math.floor(diffDays / 365)} anos atrás`;
});

// Pre-save middleware to update updatedAt
transactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Set completion date when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = Date.now();
  }
  
  // Set failure date when status changes to failed
  if (this.isModified('status') && this.status === 'failed' && !this.failedAt) {
    this.failedAt = Date.now();
  }
  
  next();
});

// Static method to get user transaction summary
transactionSchema.statics.getUserSummary = function(userId) {
  return this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalCredits: { $sum: '$credits' }
      }
    }
  ]);
};

// Static method to get monthly revenue
transactionSchema.statics.getMonthlyRevenue = function(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed',
        type: { $in: ['credit_purchase', 'subscription'] }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalTransactions: { $sum: 1 },
        totalCredits: { $sum: '$credits' }
      }
    }
  ]);
};

// Method to mark as completed
transactionSchema.methods.markCompleted = function() {
  this.status = 'completed';
  this.completedAt = Date.now();
  return this.save();
};

// Method to mark as failed
transactionSchema.methods.markFailed = function(reason) {
  this.status = 'failed';
  this.failedAt = Date.now();
  this.failureReason = reason;
  return this.save();
};

// Method to process refund
transactionSchema.methods.processRefund = function(amount, reason, refundTransactionId) {
  this.refund.isRefunded = true;
  this.refund.refundAmount = amount || this.amount;
  this.refund.refundDate = Date.now();
  this.refund.refundReason = reason;
  this.refund.refundTransactionId = refundTransactionId;
  this.status = 'refunded';
  return this.save();
};

// Indexes
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ 'paymentProvider.transactionId': 1 });
transactionSchema.index({ 'paymentProvider.paymentIntentId': 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ completedAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);