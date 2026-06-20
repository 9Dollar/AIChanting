(function (global) {
  'use strict';

  const STORAGE_KEY = 'aichanting_user_v1';
  const RECORDS_KEY = 'aichanting_records_v1';
  const PRESETS_KEY = 'aichanting_api_presets_v1';
  const SERVER_URL_KEY = 'aichanting_server_url_v1';
  const PENDING_MODEL_KEY = 'aichanting_pending_model_v1';
  const DEFAULT_SERVER_URL = 'http://localhost:3000';

  function getStorage() {
    return global.localStorage;
  }

  function loadUser() {
    try {
      const raw = getStorage().getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('读取本地存档失败', e);
      return null;
    }
  }

  function saveUser(user) {
    try {
      getStorage().setItem(STORAGE_KEY, JSON.stringify(user));
      return true;
    } catch (e) {
      console.warn('保存本地存档失败', e);
      return false;
    }
  }

  function loadRecords() {
    try {
      const raw = getStorage().getItem(RECORDS_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.warn('读取诵经记录失败', e);
      return [];
    }
  }

  function saveRecords(records) {
    try {
      getStorage().setItem(RECORDS_KEY, JSON.stringify(records));
      return true;
    } catch (e) {
      console.warn('保存诵经记录失败', e);
      return false;
    }
  }

  function exportData(user, records, presets) {
    return {
      version: 1,
      exportedAt: Date.now(),
      user: user,
      records: records || [],
      presets: presets || [],
    };
  }

  function importData(data) {
    if (!data || data.version !== 1) {
      throw new Error('不支持的存档格式');
    }
    return {
      user: data.user,
      records: Array.isArray(data.records) ? data.records : [],
      presets: Array.isArray(data.presets) ? data.presets : [],
    };
  }

  function loadPresets() {
    try {
      const raw = getStorage().getItem(PRESETS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('读取模型配置预设失败', e);
      return [];
    }
  }

  function savePresets(list) {
    try {
      getStorage().setItem(PRESETS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
      return true;
    } catch (e) {
      console.warn('保存模型配置预设失败', e);
      return false;
    }
  }

  function getPreset(id) {
    const list = loadPresets();
    return list.find(function (p) { return p.id === id; }) || null;
  }

  function addPreset(preset) {
    const list = loadPresets();
    list.push(preset);
    return savePresets(list);
  }

  function updatePreset(preset) {
    const list = loadPresets();
    const idx = list.findIndex(function (p) { return p.id === preset.id; });
    if (idx === -1) return false;
    list[idx] = preset;
    return savePresets(list);
  }

  function deletePreset(id) {
    const list = loadPresets();
    const filtered = list.filter(function (p) { return p.id !== id; });
    return savePresets(filtered);
  }

  function loadServerUrl() {
    try {
      const raw = getStorage().getItem(SERVER_URL_KEY);
      if (!raw) return DEFAULT_SERVER_URL;
      return raw || DEFAULT_SERVER_URL;
    } catch (e) {
      console.warn('读取同步服务器地址失败', e);
      return DEFAULT_SERVER_URL;
    }
  }

  function saveServerUrl(url) {
    try {
      getStorage().setItem(SERVER_URL_KEY, url || DEFAULT_SERVER_URL);
      return true;
    } catch (e) {
      console.warn('保存同步服务器地址失败', e);
      return false;
    }
  }

  function loadPendingModelIncrements() {
    try {
      const raw = getStorage().getItem(PENDING_MODEL_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.warn('读取未同步模型增量失败', e);
      return [];
    }
  }

  function savePendingModelIncrements(list) {
    try {
      getStorage().setItem(PENDING_MODEL_KEY, JSON.stringify(list || []));
      return true;
    } catch (e) {
      console.warn('保存未同步模型增量失败', e);
      return false;
    }
  }

  function clearAll() {
    try {
      getStorage().removeItem(STORAGE_KEY);
      getStorage().removeItem(RECORDS_KEY);
      getStorage().removeItem(PRESETS_KEY);
      getStorage().removeItem(SERVER_URL_KEY);
      getStorage().removeItem(PENDING_MODEL_KEY);
      return true;
    } catch (e) {
      console.warn('清除本地存档失败', e);
      return false;
    }
  }

  global.StorageManager = {
    loadUser,
    saveUser,
    loadRecords,
    saveRecords,
    loadPresets,
    savePresets,
    getPreset,
    addPreset,
    updatePreset,
    deletePreset,
    loadServerUrl,
    saveServerUrl,
    loadPendingModelIncrements,
    savePendingModelIncrements,
    exportData,
    importData,
    clearAll,
  };
})(window);
