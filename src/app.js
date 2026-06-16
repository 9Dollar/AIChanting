(function (global) {
  'use strict';

  const UI = global.UiModule;
  const User = global.UserSystem;
  const Storage = global.StorageManager;
  const Merit = global.MeritSystem;
  const Api = global.ApiModule;
  const NumberUtils = global.NumberUtils;

  let user = null;
  let records = [];
  let selectedScriptureId = '';
  let userMerit = 0n;
  let modelMerit = 0n;

  let isChanting = false;
  let isPaused = false;
  let apiClient = null;
  let session = null;

  function init() {
    loadUser();
    loadRecords();
    setupUI();
    setupEvents();
    refreshUI();
  }

  function loadUser() {
    const saved = Storage.loadUser();
    if (!saved || !User.isValidUser(saved)) {
      user = User.createUser();
      Storage.saveUser(user);
    } else {
      user = User.migrateUser(saved);
    }
    userMerit = NumberUtils.toBigInt(user.totalMerit);
  }

  function loadRecords() {
    records = Storage.loadRecords() || [];
  }

  function saveState() {
    user.totalMerit = userMerit.toString();
    Storage.saveUser(user);
    Storage.saveRecords(records);
  }

  function setupUI() {
    UI.updateUserDisplay(user);
    UI.renderScriptureOptions(global.SCRIPTURES, selectedScriptureId);
    loadApiConfigToUI();
    UI.updateMeritDisplay(userMerit, modelMerit, null);
    UI.renderRecords(records);
    UI.createParticles('user-particles', 12);
    UI.createParticles('model-particles', 12);
    fetchRankings();
  }

  function loadApiConfigToUI() {
    const saved = Storage.loadApiConfig() || {};
    const apiType = saved.apiType || 'openai';
    const provider = saved.provider || 'openai';

    const apiTypeInput = UI.$('api-type');
    if (apiTypeInput) apiTypeInput.value = apiType;
    UI.renderProviderOptions(apiType, provider);

    const providerInput = UI.$('api-provider');
    if (providerInput) providerInput.value = provider;
    if (UI.$('api-key')) UI.$('api-key').value = saved.apiKey || '';
    if (UI.$('api-endpoint')) UI.$('api-endpoint').value = saved.endpoint || '';
    if (UI.$('api-model')) UI.$('api-model').value = saved.model || '';
    if (UI.$('server-url')) UI.$('server-url').value = saved.serverUrl || 'http://localhost:3000';
  }

  function saveCurrentApiConfig() {
    const config = UI.getApiConfig();
    config.serverUrl = UI.getServerUrl();
    Storage.saveApiConfig(config);
  }

  function refreshUI() {
    const scripture = (global.SCRIPTURES || []).find((s) => s.id === selectedScriptureId);
    UI.renderScripturePreview(scripture);
    const info = Merit.getDevotionInfo(user.chantCount);
    UI.updateDevotionTitle(info.title);
  }

  function setupEvents() {
    UI.bindEvent('scripture-select', 'change', (e) => {
      selectedScriptureId = e.target.value;
      refreshUI();
    });

    UI.bindEvent('api-type', 'change', (e) => {
      UI.renderProviderOptions(e.target.value, 'custom');
      saveCurrentApiConfig();
    });

    UI.bindEvent('api-config-toggle', 'click', () => {
      const panel = UI.$('api-config-panel');
      const arrow = UI.$('api-config-arrow');
      if (!panel || !arrow) return;
      const hidden = panel.classList.toggle('hidden');
      arrow.textContent = hidden ? '▼' : '▲';
    });

    UI.bindEvent('btn-update-name', 'click', () => {
      const input = UI.$('user-name-input');
      const name = input ? input.value.trim() : '';
      if (!name) return;
      user.name = name;
      Storage.saveUser(user);
      UI.updateUserDisplay(user);
      UI.showToast('法名已更新');
    });

    UI.bindEvent('btn-devotion-table', 'click', () => UI.openDevotionModal());
    UI.bindEvent('btn-close-modal', 'click', () => UI.closeDevotionModal());
    UI.bindEvent('devotion-modal', 'click', (e) => {
      if (e.target.id === 'devotion-modal') UI.closeDevotionModal();
    });

    UI.bindEvent('btn-export', 'click', exportArchive);
    UI.bindEvent('btn-import', 'click', () => UI.$('import-file')?.click());
    UI.bindEvent('import-file', 'change', importArchive);
    UI.bindEvent('btn-sync', 'click', syncToServer);

    ['api-provider', 'api-key', 'api-endpoint', 'api-model', 'server-url'].forEach((id) => {
      UI.bindEvent(id, 'change', saveCurrentApiConfig);
    });

    UI.bindEvent('btn-start', 'click', startChanting);
    UI.bindEvent('btn-pause', 'click', pauseChanting);
    UI.bindEvent('btn-stop', 'click', stopChanting);
  }

  function exportArchive() {
    const data = Storage.exportData(user, records);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aichanting-archive-' + user.id + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.showToast('存档已导出');
  }

  function importArchive(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const imported = Storage.importData(data);
        user = User.migrateUser(imported.user);
        records = imported.records || [];
        userMerit = NumberUtils.toBigInt(user.totalMerit);
        saveState();
        setupUI();
        UI.showToast('存档已导入');
      } catch (err) {
        UI.showToast('导入失败：' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function startChanting() {
    if (isChanting) {
      if (isPaused) {
        isPaused = false;
        UI.setChantingState(true, false);
        UI.updateProgress('继续诵经...', '进行中');
      }
      return;
    }

    const scripture = (global.SCRIPTURES || []).find((s) => s.id === selectedScriptureId);
    if (!scripture) {
      UI.showToast('请先选择一部经文', 'error');
      return;
    }

    const apiConfig = UI.getApiConfig();
    if (!apiConfig.apiKey) {
      UI.showToast('请输入 API 密钥', 'error');
      return;
    }

    try {
      apiClient = Api.createApiClient(apiConfig);
    } catch (err) {
      UI.showToast('API 配置错误：' + err.message, 'error');
      return;
    }

    const settings = UI.getChantSettings();
    const resolvedModel = apiConfig.model || apiClient.config().model;
    isChanting = true;
    isPaused = false;
    modelMerit = NumberUtils.toBigInt((user.byModel || {})[resolvedModel] || '0');
    session = {
      startTime: Date.now(),
      scriptureId: scripture.id,
      scriptureName: scripture.name,
      apiType: apiConfig.apiType,
      provider: apiConfig.provider,
      model: resolvedModel,
      history: [],
      count: 0,
      maxCount: settings.count,
      interval: settings.interval,
      userMeritBefore: userMerit,
      modelMeritBefore: modelMerit,
      status: 'stopped',
    };

    saveCurrentApiConfig();

    UI.setChantingState(true, false);
    UI.clearLlmOutput();
    UI.updateProgress('开始诵经', '第 0 次');
    chantingLoop(scripture);
  }

  function pauseChanting() {
    if (!isChanting) return;
    isPaused = !isPaused;
    UI.setChantingState(true, isPaused);
    UI.updateProgress(isPaused ? '已暂停' : '继续诵经...', isPaused ? '点击开始继续' : '进行中');
  }

  function stopChanting() {
    if (!isChanting) return;
    isChanting = false;
    isPaused = false;
    if (apiClient) {
      apiClient.abort();
      apiClient = null;
    }
    finishSession('stopped');
    UI.setChantingState(false, false);
    UI.updateProgress('已停止', '-');
  }

  async function chantingLoop(scripture) {
    while (isChanting) {
      while (isPaused && isChanting) {
        await sleep(200);
      }
      if (!isChanting) break;

      const currentCount = session.count;
      try {
        UI.updateProgress('正在诵经...', '第 ' + (currentCount + 1) + ' 次');
        const result = await apiClient.chat(session.history, scripture.content);
        const exchange = { reply: result.reply };
        session.history.push(exchange);

        UI.showLlmOutput(result.reply, session.count + 1);

        const calc = Merit.calculateSingleMerit(scripture.baseMerit, currentCount);
        const delta = calc.merit;

        userMerit = Merit.addMerit(userMerit, delta);
        modelMerit = Merit.addMerit(modelMerit, delta);
        session.count += 1;
        user.chantCount += 1;

        updateByScripture(scripture.id, delta);
        updateByModel(session.model, delta);

        UI.updateMeritDisplay(userMerit, modelMerit, delta);
        UI.updateDevotionTitle(calc.title);
        UI.updateProgress('诵经完成一次', '第 ' + session.count + ' 次 · 系数 ' + calc.coefficient);

        if (isContextLimitReached()) {
          session.status = 'context_limit';
          UI.showToast('达到上下文限制，已停止', 'error');
          break;
        }

        if (session.maxCount > 0 && session.count >= session.maxCount) {
          session.status = 'completed';
          break;
        }

        await sleep(session.interval * 1000);
      } catch (err) {
        session.status = 'error';
        UI.showToast('诵经出错：' + err.message, 'error');
        break;
      }
    }

    if (session && session.status !== 'stopped') {
      finishSession(session.status);
    }

    isChanting = false;
    isPaused = false;
    UI.setChantingState(false, false);
    UI.updateProgress('诵经结束', '共 ' + (session ? session.count : 0) + ' 次');
  }

  function finishSession(status) {
    if (!session) return;
    session.status = status;
    session.totalDuration = Date.now() - session.startTime;
    session.userMerit = Merit.addMerit(userMerit, 0n) - session.userMeritBefore;
    session.modelMerit = Merit.addMerit(modelMerit, 0n) - session.modelMeritBefore;
    session.contextLength = estimateContextTokens();

    const record = {
      id: User.generateGUID(),
      timestamp: session.startTime,
      scriptureId: session.scriptureId,
      scriptureName: session.scriptureName,
      apiType: session.apiType,
      provider: session.provider,
      model: session.model,
      count: session.count,
      totalDuration: session.totalDuration,
      userMerit: session.userMerit.toString(),
      modelMerit: session.modelMerit.toString(),
      status: session.status,
      contextLength: session.contextLength,
    };

    records.push(record);
    user.records.push(record.id);
    saveState();
    UI.renderRecords(records);
    session = null;
  }

  function updateByScripture(id, delta) {
    if (!user.byScripture) user.byScripture = {};
    const current = NumberUtils.toBigInt(user.byScripture[id] || '0');
    user.byScripture[id] = (current + delta).toString();
  }

  function updateByModel(model, delta) {
    if (!user.byModel) user.byModel = {};
    const key = model || 'unknown';
    const current = NumberUtils.toBigInt(user.byModel[key] || '0');
    user.byModel[key] = (current + delta).toString();
  }

  function isContextLimitReached() {
    return estimateContextTokens() > 8000;
  }

  function estimateContextTokens() {
    let chars = 0;
    session.history.forEach((ex) => {
      chars += (ex.reply || '').length;
    });
    return Math.ceil(chars / 4);
  }

  async function syncToServer() {
    const serverUrl = UI.getServerUrl();
    try {
      const userRes = await fetch(serverUrl + '/api/user/merit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          merit: userMerit.toString(),
          chantCount: user.chantCount,
        }),
      });
      if (!userRes.ok) throw new Error('同步用户功德失败');

      const lastRecord = records[records.length - 1];
      if (lastRecord) {
        const modelRes = await fetch(serverUrl + '/api/model/merit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: lastRecord.provider || 'unknown',
            model: lastRecord.model || 'unknown',
            merit: lastRecord.modelMerit || '0',
            chantCount: lastRecord.count || 0,
          }),
        });
        if (!modelRes.ok) throw new Error('同步模型功德失败');
      }

      UI.showToast('已同步到服务器');
      await fetchRankings();
    } catch (err) {
      UI.showToast('同步失败：' + err.message, 'error');
    }
  }

  async function fetchRankings() {
    const serverUrl = UI.getServerUrl();
    try {
      const [userRes, modelRes] = await Promise.all([
        fetch(serverUrl + '/api/user/ranking'),
        fetch(serverUrl + '/api/model/ranking'),
      ]);
      const userData = await userRes.json();
      const modelData = await modelRes.json();
      UI.renderRankings(userData.data, modelData.data);
    } catch (err) {
      console.warn('获取排行榜失败', err);
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
