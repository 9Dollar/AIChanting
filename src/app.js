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
  let editingPresetId = null;

  function init() {
    loadUser();
    loadRecords();
    setupUI();
    setupEvents();
    refreshUI();
    retryPendingModelIncrements();
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
    loadServerUrlToUI();
    refreshPresetList();
    UI.updateMeritDisplay(userMerit, modelMerit, null);
    UI.renderRecords(records);
    UI.createParticles('user-particles', 12);
    UI.createParticles('model-particles', 12);
    fetchRankings();
  }

  function loadServerUrlToUI() {
    const url = Storage.loadServerUrl();
    if (UI.$('server-url')) UI.$('server-url').value = url;
  }

  function saveServerUrlFromUI() {
    Storage.saveServerUrl(UI.getServerUrl());
  }

  function refreshPresetList() {
    const presets = Storage.loadPresets();
    UI.renderPresetList(presets, user ? user.activePresetId : null, isChanting);
  }

  function getActivePreset() {
    if (!user || !user.activePresetId) return null;
    return Storage.getPreset(user.activePresetId);
  }

  function setActivePreset(id) {
    user.activePresetId = id;
    Storage.saveUser(user);
    refreshPresetList();
  }

  function getNextOrder(pinned) {
    const presets = Storage.loadPresets();
    const sameGroup = presets.filter(function (p) { return p.pinned === pinned; });
    if (sameGroup.length === 0) return 0;
    return Math.max.apply(null, sameGroup.map(function (p) { return p.order || 0; })) + 1;
  }

  function handleAddPreset() {
    editingPresetId = null;
    UI.openPresetModal('add');
  }

  function handleEditPreset(id) {
    editingPresetId = id;
    const preset = Storage.getPreset(id);
    if (preset) UI.openPresetModal('edit', preset);
  }

  function handleSavePreset() {
    const data = UI.getPresetFormData();
    if (!data.apiKey) {
      UI.showToast('请填写 API 密钥', 'error');
      return;
    }
    if (!data.model) {
      UI.showToast('请填写模型名称', 'error');
      return;
    }
    if (!data.name) data.name = data.model;

    if (editingPresetId) {
      const existing = Storage.getPreset(editingPresetId);
      if (!existing) {
        UI.showToast('预设不存在', 'error');
        return;
      }
      const updated = Object.assign({}, existing, {
        name: data.name,
        apiType: data.apiType,
        provider: data.provider,
        apiKey: data.apiKey,
        endpoint: data.endpoint,
        model: data.model,
        updatedAt: Date.now(),
      });
      Storage.updatePreset(updated);
      UI.showToast('模型配置已更新');
    } else {
      const preset = {
        id: User.generateGUID(),
        name: data.name,
        apiType: data.apiType,
        provider: data.provider,
        apiKey: data.apiKey,
        endpoint: data.endpoint,
        model: data.model,
        pinned: false,
        order: getNextOrder(false),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      Storage.addPreset(preset);
      UI.showToast('模型配置已新增');
    }

    editingPresetId = null;
    UI.closePresetModal();
    refreshPresetList();
  }

  function handleDeletePreset(id) {
    Storage.deletePreset(id);
    if (user.activePresetId === id) {
      user.activePresetId = null;
      Storage.saveUser(user);
      UI.showToast('已删除当前选中的配置，请重新选择');
    } else {
      UI.showToast('模型配置已删除');
    }
    refreshPresetList();
  }

  function handleTogglePin(id) {
    const preset = Storage.getPreset(id);
    if (!preset) return;
    const newPinned = !preset.pinned;
    const newOrder = getNextOrder(newPinned);
    Storage.updatePreset(Object.assign({}, preset, {
      pinned: newPinned,
      order: newOrder,
      updatedAt: Date.now(),
    }));
    refreshPresetList();
  }

  function movePreset(id, direction) {
    const presets = Storage.loadPresets();
    const preset = presets.find(function (p) { return p.id === id; });
    if (!preset) return;

    const sameGroup = presets
      .filter(function (p) { return p.pinned === preset.pinned; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

    const idx = sameGroup.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return;

    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sameGroup.length) return;

    const target = sameGroup[targetIdx];
    const tmpOrder = preset.order;
    Storage.updatePreset(Object.assign({}, preset, { order: target.order, updatedAt: Date.now() }));
    Storage.updatePreset(Object.assign({}, target, { order: tmpOrder, updatedAt: Date.now() }));

    refreshPresetList();
  }

  function handleMoveUp(id) {
    movePreset(id, -1);
  }

  function handleMoveDown(id) {
    movePreset(id, 1);
  }

  function handleSelectPreset(id) {
    setActivePreset(id);
  }

  function setupPresetListEvents() {
    const container = UI.$('preset-list');
    if (!container) return;

    container.addEventListener('click', function (e) {
      const target = e.target;
      const action = target.getAttribute('data-action');
      const id = target.getAttribute('data-id');
      if (!action || !id) return;
      if (action === 'select') return; // radio 由 change 事件处理

      switch (action) {
        case 'edit':
          handleEditPreset(id);
          break;
        case 'delete':
          handleDeletePreset(id);
          break;
        case 'pin':
          handleTogglePin(id);
          break;
        case 'up':
          handleMoveUp(id);
          break;
        case 'down':
          handleMoveDown(id);
          break;
      }
    });

    container.addEventListener('change', function (e) {
      if (e.target.type === 'radio' && e.target.name === 'preset-radio') {
        handleSelectPreset(e.target.value);
      }
    });
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
    UI.bindEvent('btn-sync', 'click', uploadUserData);

    // server-url 变更即保存
    UI.bindEvent('server-url', 'change', saveServerUrlFromUI);

    // 预设列表事件委托
    setupPresetListEvents();

    // 预设 modal 事件
    UI.bindEvent('btn-add-preset', 'click', handleAddPreset);
    UI.bindEvent('btn-save-preset', 'click', handleSavePreset);
    UI.bindEvent('btn-cancel-preset', 'click', () => {
      editingPresetId = null;
      UI.closePresetModal();
    });
    UI.bindEvent('btn-close-preset-modal', 'click', () => {
      editingPresetId = null;
      UI.closePresetModal();
    });
    UI.bindEvent('preset-modal', 'click', (e) => {
      if (e.target.id === 'preset-modal') {
        editingPresetId = null;
        UI.closePresetModal();
      }
    });

    UI.bindEvent('btn-start', 'click', startChanting);
    UI.bindEvent('btn-pause', 'click', pauseChanting);
    UI.bindEvent('btn-stop', 'click', stopChanting);

    UI.bindEvent('btn-ok-confirm', 'click', () => {
      const cb = UI.getConfirmCallback();
      UI.closeConfirmModal();
      if (cb) cb();
    });
    UI.bindEvent('btn-cancel-confirm', 'click', () => UI.closeConfirmModal());
    UI.bindEvent('btn-close-confirm-modal', 'click', () => UI.closeConfirmModal());
    UI.bindEvent('confirm-modal', 'click', (e) => {
      if (e.target.id === 'confirm-modal') UI.closeConfirmModal();
    });
  }

  function exportArchive() {
    const presets = Storage.loadPresets();
    const hasSensitive = presets.some((p) => p.apiKey);
    const doExport = () => {
      const data = Storage.exportData(user, records, presets);
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
    };
    if (hasSensitive) {
      UI.openConfirmModal(
        '导出存档',
        '导出的存档包含 API 密钥等敏感信息。\n请勿将此存档分享给他人，否则可能导致密钥泄露。\n\n是否继续导出？',
        doExport
      );
    } else {
      doExport();
    }
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
        if (imported.presets && imported.presets.length > 0) {
          Storage.savePresets(imported.presets);
        }
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

    const preset = getActivePreset();
    if (!preset) {
      UI.showToast('请先选择模型配置', 'error');
      return;
    }

    try {
      apiClient = Api.createApiClient(preset);
    } catch (err) {
      UI.showToast('API 配置错误：' + err.message, 'error');
      return;
    }

    const settings = UI.getChantSettings();
    const resolvedModel = preset.model || apiClient.config().model;
    isChanting = true;
    isPaused = false;
    modelMerit = NumberUtils.toBigInt((user.byModel || {})[resolvedModel] ? user.byModel[resolvedModel].merit : '0');
    session = {
      startTime: Date.now(),
      scriptureId: scripture.id,
      scriptureName: scripture.name,
      apiType: preset.apiType,
      provider: preset.provider,
      model: resolvedModel,
      history: [],
      count: 0,
      maxCount: settings.count,
      interval: settings.interval,
      userMeritBefore: userMerit,
      modelMeritBefore: modelMerit,
      status: 'stopped',
    };

    refreshPresetList();

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
    refreshPresetList();
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
        updateByModel(session.model, delta, session.provider);

        UI.updateMeritDisplay(userMerit, modelMerit, delta);
        UI.updateDevotionTitle(calc.title);
        UI.updateProgress('诵经完成一次', '第 ' + session.count + ' 次 · 系数 ' + calc.coefficient);

        // 每次诵经完成，增量上传模型功德（失败入队重试）
        uploadModelMeritIncrement(session.provider, session.model, delta, 1);

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
    refreshPresetList();
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

  function updateByModel(model, delta, provider) {
    if (!user.byModel) user.byModel = {};
    const key = model || 'unknown';
    const existing = user.byModel[key] || { provider: provider || 'unknown', model: key, merit: '0', chantCount: 0 };
    const current = NumberUtils.toBigInt(existing.merit || '0');
    user.byModel[key] = {
      provider: provider || existing.provider || 'unknown',
      model: key,
      merit: (current + delta).toString(),
      chantCount: (existing.chantCount || 0) + 1,
    };
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

  // 模型功德增量上传：每次诵经完成调用，失败入队重试
  async function uploadModelMeritIncrement(provider, model, meritDelta, chantDelta) {
    const serverUrl = UI.getServerUrl();
    try {
      const res = await fetch(serverUrl + '/api/model/merit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider || 'unknown',
          model: model || 'unknown',
          merit: meritDelta.toString(),
          chantCount: chantDelta || 0,
        }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (err) {
      // 失败：入队，下次重试
      const pending = Storage.loadPendingModelIncrements() || [];
      pending.push({
        provider: provider || 'unknown',
        model: model || 'unknown',
        merit: meritDelta.toString(),
        chantCount: chantDelta || 0,
      });
      Storage.savePendingModelIncrements(pending);
      console.warn('模型功德增量上传失败，已入队', err);
    }
  }

  // 页面加载时重试未同步的模型增量（合并同一 provider+model 的条目）
  async function retryPendingModelIncrements() {
    const pending = Storage.loadPendingModelIncrements() || [];
    if (pending.length === 0) return;

    // 按 provider+model 合并
    const merged = {};
    pending.forEach((item) => {
      const key = item.provider + '|' + item.model;
      if (!merged[key]) {
        merged[key] = { provider: item.provider, model: item.model, merit: 0n, chantCount: 0 };
      }
      merged[key].merit += NumberUtils.toBigInt(item.merit || '0');
      merged[key].chantCount += Number(item.chantCount || 0);
    });

    const serverUrl = UI.getServerUrl();
    const failedKeys = new Set();

    await Promise.all(
      Object.entries(merged).map(async ([key, item]) => {
        try {
          const res = await fetch(serverUrl + '/api/model/merit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: item.provider,
              model: item.model,
              merit: item.merit.toString(),
              chantCount: item.chantCount,
            }),
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
        } catch (err) {
          failedKeys.add(key);
          console.warn('重试模型增量失败: ' + key, err);
        }
      })
    );

    // 只保留失败条目
    const remaining = pending.filter((item) => failedKeys.has(item.provider + '|' + item.model));
    Storage.savePendingModelIncrements(remaining);
  }

  // 用户功德全量上传（用户主动点击按钮）
  async function uploadUserData() {
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
      if (!userRes.ok) throw new Error('上传用户数据失败');
      UI.showToast('用户数据已上传');
      await fetchRankings();
    } catch (err) {
      UI.showToast('上传失败：' + err.message, 'error');
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
