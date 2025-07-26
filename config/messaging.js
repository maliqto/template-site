const nodemailer = require('nodemailer');
const twilio = require('twilio');
const axios = require('axios');

// Configuração do Twilio para SMS
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Configuração do Nodemailer para Email
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Função para enviar SMS
async function sendSMS(to, message, options = {}) {
  if (!twilioClient) {
    throw new Error('Twilio não configurado. Verifique as credenciais.');
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
      ...options
    });

    return {
      success: true,
      messageId: result.sid,
      status: result.status,
      to: result.to,
      cost: result.price || 0,
      provider: 'twilio'
    };
  } catch (error) {
    console.error('Erro ao enviar SMS:', error);
    throw new Error(`Falha no envio de SMS: ${error.message}`);
  }
}

// Função para enviar Email
async function sendEmail(to, subject, content, options = {}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP não configurado. Verifique as credenciais.');
  }

  try {
    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || 'CyberNex'}" <${process.env.SMTP_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      html: content,
      text: content.replace(/<[^>]*>/g, ''), // Remove HTML tags for text version
      ...options
    };

    const result = await emailTransporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      response: result.response,
      to: mailOptions.to,
      provider: 'smtp'
    };
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw new Error(`Falha no envio de email: ${error.message}`);
  }
}

// Função para envio em massa de SMS
async function sendBulkSMS(recipients, message, options = {}) {
  const results = [];
  const errors = [];
  
  for (const recipient of recipients) {
    try {
      const result = await sendSMS(recipient.phone, message, {
        ...options,
        // Personalizar mensagem se houver dados do recipient
        body: personalizeMessage(message, recipient)
      });
      
      results.push({
        recipient: recipient.phone,
        ...result
      });
      
      // Delay entre envios para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      errors.push({
        recipient: recipient.phone,
        error: error.message
      });
    }
  }
  
  return {
    success: errors.length === 0,
    totalSent: results.length,
    totalErrors: errors.length,
    results,
    errors
  };
}

// Função para envio em massa de Email
async function sendBulkEmail(recipients, subject, content, options = {}) {
  const results = [];
  const errors = [];
  
  for (const recipient of recipients) {
    try {
      const personalizedContent = personalizeMessage(content, recipient);
      const personalizedSubject = personalizeMessage(subject, recipient);
      
      const result = await sendEmail(
        recipient.email, 
        personalizedSubject, 
        personalizedContent, 
        options
      );
      
      results.push({
        recipient: recipient.email,
        ...result
      });
      
      // Delay entre envios para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      errors.push({
        recipient: recipient.email,
        error: error.message
      });
    }
  }
  
  return {
    success: errors.length === 0,
    totalSent: results.length,
    totalErrors: errors.length,
    results,
    errors
  };
}

// Função para personalizar mensagens
function personalizeMessage(message, recipient) {
  let personalizedMessage = message;
  
  // Substituir placeholders comuns
  const placeholders = {
    '{{name}}': recipient.name || recipient.firstName || 'Cliente',
    '{{firstName}}': recipient.firstName || recipient.name || 'Cliente',
    '{{lastName}}': recipient.lastName || '',
    '{{email}}': recipient.email || '',
    '{{phone}}': recipient.phone || '',
    '{{company}}': recipient.company || ''
  };
  
  Object.entries(placeholders).forEach(([placeholder, value]) => {
    personalizedMessage = personalizedMessage.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return personalizedMessage;
}

// Função para validar número de telefone
function validatePhoneNumber(phone) {
  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Verifica se tem pelo menos 10 dígitos
  if (cleanPhone.length < 10) {
    return { valid: false, error: 'Número muito curto' };
  }
  
  // Adiciona código do país se não tiver
  let formattedPhone = cleanPhone;
  if (!cleanPhone.startsWith('55') && cleanPhone.length === 11) {
    formattedPhone = '55' + cleanPhone;
  }
  
  return {
    valid: true,
    formatted: '+' + formattedPhone
  };
}

// Função para validar email
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return {
    valid: emailRegex.test(email),
    error: emailRegex.test(email) ? null : 'Email inválido'
  };
}

// Função para verificar status de entrega (Twilio)
async function checkSMSStatus(messageId) {
  if (!twilioClient) {
    throw new Error('Twilio não configurado');
  }
  
  try {
    const message = await twilioClient.messages(messageId).fetch();
    return {
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      dateUpdated: message.dateUpdated
    };
  } catch (error) {
    throw new Error(`Erro ao verificar status: ${error.message}`);
  }
}

// Função para obter estatísticas de envio
function getMessagingStats(results) {
  const stats = {
    total: results.length,
    sent: 0,
    failed: 0,
    pending: 0,
    delivered: 0
  };
  
  results.forEach(result => {
    if (result.success) {
      stats.sent++;
      if (result.status === 'delivered') {
        stats.delivered++;
      } else if (result.status === 'sent' || result.status === 'queued') {
        stats.pending++;
      }
    } else {
      stats.failed++;
    }
  });
  
  return stats;
}

module.exports = {
  sendSMS,
  sendEmail,
  sendBulkSMS,
  sendBulkEmail,
  validatePhoneNumber,
  validateEmail,
  checkSMSStatus,
  getMessagingStats,
  personalizeMessage
};