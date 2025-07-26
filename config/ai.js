const axios = require('axios');
const crypto = require('crypto');

// Configurações reais dos provedores de IA
const AI_PROVIDERS = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    models: {
      'gpt-4': {
        name: 'GPT-4',
        endpoint: '/chat/completions',
        costPerToken: 0.00003,
        maxTokens: 8192,
        capabilities: ['text', 'code', 'analysis']
      },
      'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        endpoint: '/chat/completions',
        costPerToken: 0.000002,
        maxTokens: 4096,
        capabilities: ['text', 'code', 'chat']
      }
    }
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: process.env.ANTHROPIC_API_KEY,
    models: {
      'claude-3-sonnet': {
        name: 'Claude 3 Sonnet',
        endpoint: '/messages',
        costPerToken: 0.000015,
        maxTokens: 4096,
        capabilities: ['text', 'analysis', 'code']
      }
    }
  }
};

// Função para fazer chamadas reais para APIs de IA
async function callRealAI(prompt, model, parameters = {}) {
  const provider = getProviderForModel(model);
  if (!provider) {
    throw new Error(`Modelo ${model} não suportado`);
  }

  const config = AI_PROVIDERS[provider];
  const modelConfig = config.models[model];
  
  if (!config.apiKey) {
    throw new Error(`API key não configurada para ${provider}`);
  }

  const startTime = Date.now();
  
  try {
    let response;
    
    if (provider === 'openai') {
      response = await callOpenAI(prompt, model, parameters, config, modelConfig);
    } else if (provider === 'anthropic') {
      response = await callAnthropic(prompt, model, parameters, config, modelConfig);
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      response: response.content,
      tokensUsed: response.tokensUsed,
      processingTime,
      finishReason: response.finishReason || 'stop',
      provider,
      model
    };
    
  } catch (error) {
    console.error(`Erro ao chamar ${provider}:`, error);
    throw new Error(`Falha na comunicação com ${provider}: ${error.message}`);
  }
}

// Função para chamar OpenAI
async function callOpenAI(prompt, model, parameters, config, modelConfig) {
  const response = await axios.post(
    `${config.baseURL}${modelConfig.endpoint}`,
    {
      model,
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente especializado em marketing digital e análise de dados. Forneça respostas precisas e profissionais.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: parameters.maxTokens || 1000,
      temperature: parameters.temperature || 0.7,
      top_p: parameters.topP || 1,
      frequency_penalty: parameters.frequencyPenalty || 0,
      presence_penalty: parameters.presencePenalty || 0
    },
    {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  const choice = response.data.choices[0];
  
  return {
    content: choice.message.content,
    tokensUsed: {
      input: response.data.usage.prompt_tokens,
      output: response.data.usage.completion_tokens,
      total: response.data.usage.total_tokens
    },
    finishReason: choice.finish_reason
  };
}

// Função para chamar Anthropic
async function callAnthropic(prompt, model, parameters, config, modelConfig) {
  const response = await axios.post(
    `${config.baseURL}${modelConfig.endpoint}`,
    {
      model,
      max_tokens: parameters.maxTokens || 1000,
      temperature: parameters.temperature || 0.7,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    {
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    }
  );

  return {
    content: response.data.content[0].text,
    tokensUsed: {
      input: response.data.usage.input_tokens,
      output: response.data.usage.output_tokens,
      total: response.data.usage.input_tokens + response.data.usage.output_tokens
    },
    finishReason: response.data.stop_reason
  };
}

// Função para determinar o provedor baseado no modelo
function getProviderForModel(model) {
  for (const [provider, config] of Object.entries(AI_PROVIDERS)) {
    if (config.models[model]) {
      return provider;
    }
  }
  return null;
}

// Função para calcular custo em créditos
function calculateCredits(tokens, model) {
  const provider = getProviderForModel(model);
  if (!provider) return 1;
  
  const modelConfig = AI_PROVIDERS[provider].models[model];
  const usdCost = tokens * modelConfig.costPerToken;
  const credits = Math.max(1, Math.ceil(usdCost * 100)); // 1 crédito = $0.01
  return credits;
}

// Função para validar se o modelo está disponível
function isModelAvailable(model) {
  return getProviderForModel(model) !== null;
}

// Função para obter informações do modelo
function getModelInfo(model) {
  const provider = getProviderForModel(model);
  if (!provider) return null;
  
  return {
    ...AI_PROVIDERS[provider].models[model],
    provider
  };
}

// Função para listar todos os modelos disponíveis
function getAllModels() {
  const models = {};
  
  for (const [provider, config] of Object.entries(AI_PROVIDERS)) {
    for (const [modelId, modelConfig] of Object.entries(config.models)) {
      models[modelId] = {
        ...modelConfig,
        provider,
        available: !!config.apiKey
      };
    }
  }
  
  return models;
}

module.exports = {
  callRealAI,
  calculateCredits,
  isModelAvailable,
  getModelInfo,
  getAllModels,
  AI_PROVIDERS
};