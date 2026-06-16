(function (global) {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function bindEvent(id, event, handler) {
    const el = $(id);
    if (el) el.addEventListener(event, handler);
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function setHtml(id, html) {
    const el = $(id);
    if (el) el.innerHTML = html;
  }

  function toggleClass(id, className, force) {
    const el = $(id);
    if (el) el.classList.toggle(className, force);
  }

  function showElement(id) {
    const el = $(id);
    if (el) el.classList.remove('hidden');
  }

  function hideElement(id) {
    const el = $(id);
    if (el) el.classList.add('hidden');
  }

  function setDisabled(id, disabled) {
    const el = $(id);
    if (el) el.disabled = disabled;
  }

  function renderScriptureOptions(scriptures, selectedId) {
    const select = $('scripture-select');
    if (!select) return;
    select.innerHTML = '<option value="">请选择一部经典</option>';
    (scriptures || []).forEach((s) => {
      const option = document.createElement('option');
      option.value = s.id;
      option.textContent = s.name;
      if (s.id === selectedId) option.selected = true;
      select.appendChild(option);
    });
  }

  function renderScripturePreview(scripture) {
    if (!scripture) {
      hideElement('scripture-preview');
      return;
    }
    setText('scripture-name', scripture.name);
    setText('scripture-description', scripture.description || '');
    setText('scripture-content', scripture.content || '');
    setText('scripture-merit', String(scripture.baseMerit || 0));
    showElement('scripture-preview');
  }

  function updateUserDisplay(user) {
    if (!user) return;
    setText('user-name', user.name || '-');
    setText('user-id', user.id || '-');
    const input = $('user-name-input');
    if (input) input.value = user.name || '';
  }

  function updateMeritDisplay(userMerit, modelMerit, delta) {
    const userFmt = global.NumberUtils
      ? global.NumberUtils.formatMerit(global.NumberUtils.toBigInt(userMerit))
      : { raw: String(userMerit), traditional: String(userMerit) };
    const modelFmt = global.NumberUtils
      ? global.NumberUtils.formatMerit(global.NumberUtils.toBigInt(modelMerit))
      : { raw: String(modelMerit), traditional: String(modelMerit) };

    setText('user-merit-display', userFmt.raw);
    setText('user-merit-traditional', userFmt.traditional);
    setText('model-merit-display', modelFmt.raw);
    setText('model-merit-traditional', modelFmt.traditional);

    if (delta) {
      const deltaFmt = global.NumberUtils
        ? global.NumberUtils.formatMerit(global.NumberUtils.toBigInt(delta))
        : { raw: String(delta) };
      setText('user-merit-delta', '+' + deltaFmt.raw);
      setText('model-merit-delta', '+' + deltaFmt.raw);
      showElement('user-merit-delta');
      showElement('model-merit-delta');
    } else {
      hideElement('user-merit-delta');
      hideElement('model-merit-delta');
    }
  }

  function updateDevotionTitle(title) {
    setText('devotion-title', title || '初入门');
  }

  function updateProgress(text, detail) {
    setText('progress-text', text || '准备就绪');
    setText('progress-detail', detail || '-');
  }

  function renderProviderOptions(apiType, selectedKey) {
    const providers = global.ApiModule ? global.ApiModule.getProviders(apiType) : {};
    const select = $('api-provider');
    if (!select) return;
    select.innerHTML = '';
    Object.keys(providers).forEach((key) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = providers[key].name;
      if (key === selectedKey) option.selected = true;
      select.appendChild(option);
    });
  }

  function getApiConfig() {
    const apiType = $('api-type') ? $('api-type').value : 'openai';
    const provider = $('api-provider') ? $('api-provider').value : 'openai';
    return {
      apiType: apiType,
      provider: provider,
      apiKey: $('api-key') ? $('api-key').value : '',
      endpoint: $('api-endpoint') ? $('api-endpoint').value : '',
      model: $('api-model') ? $('api-model').value : '',
    };
  }

  function getServerUrl() {
    const input = $('server-url');
    return input ? input.value.trim() || 'http://localhost:3000' : 'http://localhost:3000';
  }

  function getChantSettings() {
    return {
      count: parseInt($('chant-count')?.value || '0', 10),
      interval: parseInt($('chant-interval')?.value || '5', 10),
    };
  }

  function getSelectedScriptureId() {
    return $('scripture-select') ? $('scripture-select').value : '';
  }

  function renderRecords(records) {
    const container = $('records-list');
    if (!container) return;
    if (!records || records.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">暂无记录</p>';
      return;
    }
    container.innerHTML = records
      .slice()
      .reverse()
      .map((r) => {
        const date = new Date(r.timestamp).toLocaleString('zh-CN');
        return (
          '<div class="bg-white/60 rounded p-2 text-sm border border-yellow-100">' +
          '<p class="font-semibold">' + escapeHtml(r.scriptureName || '未知经文') + ' · ' + date + '</p>' +
          '<p class="text-gray-600">次数: ' + (r.count || 0) + ' · 状态: ' + escapeHtml(r.status || '-') + '</p>' +
          '<p class="text-yellow-700">功德: ' + escapeHtml(String(r.userMerit || 0)) + '</p>' +
          '</div>'
        );
      })
      .join('');
  }

  function renderRankings(users, models) {
    const userList = $('user-ranking');
    const modelList = $('model-ranking');
    if (userList) {
      if (!users || users.length === 0) {
        userList.innerHTML = '<li class="text-gray-500">暂无数据</li>';
      } else {
        userList.innerHTML = users
          .slice(0, 10)
          .map(
            (u) =>
              '<li>' + escapeHtml(u.user_name || '无名氏') + ': ' + escapeHtml(String(u.total_merit || u.totalMerit || 0)) + '</li>'
          )
          .join('');
      }
    }
    if (modelList) {
      if (!models || models.length === 0) {
        modelList.innerHTML = '<li class="text-gray-500">暂无数据</li>';
      } else {
        modelList.innerHTML = models
          .slice(0, 10)
          .map(
            (m) =>
              '<li>' + escapeHtml(m.name || '未知模型') + ': ' + escapeHtml(String(m.total_merit || m.totalMerit || 0)) + '</li>'
          )
          .join('');
      }
    }
  }

  function showToast(message, type) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className =
      'fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg text-sm z-50 ' +
      (type === 'error' ? 'bg-red-800 text-white' : 'bg-yellow-700 text-white');
    showElement('toast');
    setTimeout(() => hideElement('toast'), 3000);
  }

  function renderDevotionTable() {
    const tbody = $('devotion-table-body');
    if (!tbody || !global.MeritSystem) return;
    tbody.innerHTML = global.MeritSystem.DEVOTION_TIERS.map((t) => {
      const range = t.max === Infinity ? t.min + '+' : t.min + '-' + t.max;
      return '<tr class="border-b border-yellow-100"><td class="py-1">' + range + '</td><td class="py-1">' + t.numerator / 10 + '</td><td class="py-1">' + escapeHtml(t.title) + '</td></tr>';
    }).join('');
  }

  function openDevotionModal() {
    renderDevotionTable();
    const modal = $('devotion-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  function closeDevotionModal() {
    const modal = $('devotion-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function createParticles(containerId, count) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < (count || 12); i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.bottom = Math.random() * 20 + '%';
      p.style.animationDelay = Math.random() * 6 + 's';
      p.style.animationDuration = 4 + Math.random() * 4 + 's';
      container.appendChild(p);
    }
  }

  function setChantingState(isChanting, isPaused) {
    setDisabled('btn-start', isChanting && !isPaused);
    setDisabled('btn-pause', !isChanting);
    setDisabled('btn-stop', !isChanting);

    const visual = $('chanting-visual');
    if (visual) {
      visual.classList.toggle('opacity-50', isPaused);
    }

    const panel = $('llm-output-panel');
    if (panel) {
      if (isChanting) {
        showElement('llm-output-panel');
      }
    }
  }

  let currentTypewriter = null;

  function clearLlmOutput() {
    const output = $('llm-output');
    if (output) output.textContent = '';
    setText('llm-output-counter', '第 0 次');
    if (currentTypewriter) {
      currentTypewriter.stop();
      currentTypewriter = null;
    }
  }

  function showLlmOutput(text, count) {
    const output = $('llm-output');
    if (!output) return;
    showElement('llm-output-panel');
    setText('llm-output-counter', '第 ' + (count || 0) + ' 次');

    if (currentTypewriter) {
      currentTypewriter.stop();
    }

    output.textContent = '';
    currentTypewriter = typewriter(text, output, 8);
  }

  function typewriter(text, container, charDelayMs) {
    let index = 0;
    let stopped = false;
    const delay = Math.max(4, charDelayMs || 8);

    function tick() {
      if (stopped) return;
      if (index >= text.length) return;

      const chunkSize = Math.max(1, Math.min(3, Math.ceil(text.length / 120)));
      const end = Math.min(index + chunkSize, text.length);
      container.textContent += text.slice(index, end);
      index = end;
      container.scrollTop = container.scrollHeight;

      if (index < text.length) {
        setTimeout(tick, delay);
      }
    }

    tick();

    return {
      stop: function () {
        stopped = true;
      },
      finish: function () {
        stopped = true;
        container.textContent = text;
        container.scrollTop = container.scrollHeight;
      },
    };
  }

  global.UiModule = {
    $,
    escapeHtml,
    bindEvent,
    setText,
    setHtml,
    toggleClass,
    showElement,
    hideElement,
    setDisabled,
    renderScriptureOptions,
    renderScripturePreview,
    updateUserDisplay,
    updateMeritDisplay,
    updateDevotionTitle,
    updateProgress,
    renderProviderOptions,
    getApiConfig,
    getServerUrl,
    getChantSettings,
    getSelectedScriptureId,
    renderRecords,
    renderRankings,
    showToast,
    renderDevotionTable,
    openDevotionModal,
    closeDevotionModal,
    createParticles,
    setChantingState,
    clearLlmOutput,
    showLlmOutput,
    typewriter,
  };
})(window);
