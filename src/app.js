(function (global) {
  'use strict';

  const UI = global.UiModule;
  const User = global.UserSystem;
  const Storage = global.StorageManager;
  const Merit = global.MeritSystem;
  const Api = global.ApiModule;

  let user = null;
  let records = [];
  let selectedScriptureId = '';
  let userMerit = 0n;
  let modelMerit = 0n;

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
    userMerit = global.NumberUtils.toBigInt(user.totalMerit);
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
    UI.renderProviderOptions('openai', 'openai');
    UI.updateMeritDisplay(userMerit, modelMerit, null);
    UI.renderRecords(records);
    UI.createParticles('user-particles', 12);
    UI.createParticles('model-particles', 12);
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
        userMerit = global.NumberUtils.toBigInt(user.totalMerit);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
