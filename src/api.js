(function (global) {
  'use strict';

  const OPENAI_PROVIDERS = {
    openai: {
      name: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      authType: 'bearer',
      defaultModel: 'gpt-4o-mini',
    },
    deepseek: {
      name: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      authType: 'bearer',
      defaultModel: 'deepseek-v4-flash',
    },
    zhipu: {
      name: '智谱AI',
      endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      authType: 'bearer',
      defaultModel: 'glm-4-flash',
    },
    gemini: {
      name: 'Google Gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      authType: 'goog',
      defaultModel: 'gemini-2.5-flash',
    },
    minimax: {
      name: 'MiniMax',
      endpoint: 'https://api.minimax.chat/v1/chat/completions',
      authType: 'bearer',
      defaultModel: 'MiniMax-M1',
    },
    custom: {
      name: '自定义',
      endpoint: '',
      authType: 'bearer',
      defaultModel: '',
    },
  };

  const ANTHROPIC_PROVIDERS = {
    anthropic: {
      name: 'Anthropic',
      endpoint: 'https://api.anthropic.com/v1/messages',
      authType: 'anthropic',
      defaultModel: 'claude-3-5-haiku',
    },
    deepseekAnthropic: {
      name: 'DeepSeek (Anthropic)',
      endpoint: 'https://api.deepseek.com/anthropic/v1/messages',
      authType: 'anthropic',
      defaultModel: '',
    },
    customAnthropic: {
      name: '自定义 (Anthropic)',
      endpoint: '',
      authType: 'anthropic',
      defaultModel: '',
    },
  };

  function getProviders(apiType) {
    if (apiType === 'anthropic') return ANTHROPIC_PROVIDERS;
    return OPENAI_PROVIDERS;
  }

  function getProviderConfig(apiType, providerKey, customEndpoint, customModel) {
    const providers = getProviders(apiType);
    const base = providers[providerKey] || providers.custom;
    return {
      name: base.name,
      endpoint: customEndpoint || base.endpoint,
      authType: base.authType,
      model: customModel || base.defaultModel,
    };
  }

  function buildHeaders(config, apiKey) {
    const headers = { 'Content-Type': 'application/json' };
    if (config.authType === 'bearer') {
      headers.Authorization = 'Bearer ' + apiKey;
    } else if (config.authType === 'goog') {
      headers['x-goog-api-key'] = apiKey;
    } else if (config.authType === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    }
    return headers;
  }

  function buildOpenAIBody(config, history, scripture) {
    const messages = [{ role: 'system', content: '你是一个虔诚的佛教信徒' }];
    const exchanges = history || [];
    exchanges.forEach((ex, index) => {
      const isFirst = index === 0;
      messages.push({
        role: 'user',
        content: isFirst
          ? '现在请重复这段内容1次：' + scripture
          : '请再次重复这段经文：' + scripture,
      });
      if (ex.reply) {
        messages.push({ role: 'assistant', content: ex.reply });
      }
    });

    if (exchanges.length === 0 || exchanges[exchanges.length - 1].reply) {
      messages.push({
        role: 'user',
        content:
          exchanges.length === 0
            ? '现在请重复这段内容1次：' + scripture
            : '请再次重复这段经文：' + scripture,
      });
    }

    return {
      model: config.model,
      messages: messages,
      temperature: 0.1,
      max_tokens: 1000,
    };
  }

  function buildAnthropicBody(config, history, scripture) {
    const messages = [];
    const exchanges = history || [];
    exchanges.forEach((ex, index) => {
      const isFirst = index === 0;
      messages.push({
        role: 'user',
        content: isFirst
          ? '现在请重复这段内容1次：' + scripture
          : '请再次重复这段经文：' + scripture,
      });
      if (ex.reply) {
        messages.push({ role: 'assistant', content: ex.reply });
      }
    });

    if (exchanges.length === 0 || exchanges[exchanges.length - 1].reply) {
      messages.push({
        role: 'user',
        content:
          exchanges.length === 0
            ? '现在请重复这段内容1次：' + scripture
            : '请再次重复这段经文：' + scripture,
      });
    }

    return {
      model: config.model,
      system: '你是一个虔诚的佛教信徒',
      messages: messages,
      temperature: 0.1,
      max_tokens: 1000,
    };
  }

  function createApiClient(options) {
    const apiType = options.apiType || 'openai';
    const providerKey = options.provider || 'openai';
    const apiKey = options.apiKey || '';
    const customEndpoint = options.endpoint || '';
    const customModel = options.model || '';

    const config = getProviderConfig(apiType, providerKey, customEndpoint, customModel);

    if (!config.endpoint) {
      throw new Error('未配置 API 端点');
    }
    if (!config.model) {
      throw new Error('未配置模型名称');
    }
    if (!apiKey) {
      throw new Error('未配置 API 密钥');
    }

    let currentAbortController = null;

    function abort() {
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
    }

    async function chat(history, scripture) {
      currentAbortController = new AbortController();
      const body =
        apiType === 'anthropic'
          ? buildAnthropicBody(config, history, scripture)
          : buildOpenAIBody(config, history, scripture);

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: buildHeaders(config, apiKey),
        body: JSON.stringify(body),
        signal: currentAbortController.signal,
      });

      currentAbortController = null;

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error('API 请求失败 (' + response.status + '): ' + text);
      }

      const data = await response.json();
      const reply = extractReply(data, apiType);
      return {
        reply: reply,
        usage: data.usage || null,
        raw: data,
      };
    }

    return {
      config: function () {
        return config;
      },
      chat,
      abort,
    };
  }

  function extractReply(data, apiType) {
    if (apiType === 'anthropic') {
      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        return data.content[0].text || '';
      }
      return data.content || '';
    }
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message?.content || data.choices[0].text || '';
    }
    return '';
  }

  global.ApiModule = {
    OPENAI_PROVIDERS,
    ANTHROPIC_PROVIDERS,
    getProviders,
    getProviderConfig,
    createApiClient,
  };
})(window);
