(function (global) {
  'use strict';

  const STORAGE_KEY = 'aichanting_user_v1';
  const RECORDS_KEY = 'aichanting_records_v1';
  const API_CONFIG_KEY = 'aichanting_api_config_v1';
  const PENDING_MODEL_KEY = 'aichanting_pending_model_v1';

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

  function exportData(user, records) {
    return {
      version: 1,
      exportedAt: Date.now(),
      user: user,
      records: records || [],
    };
  }

  function importData(data) {
    if (!data || data.version !== 1) {
      throw new Error('不支持的存档格式');
    }
    return {
      user: data.user,
      records: Array.isArray(data.records) ? data.records : [],
    };
  }

  function loadApiConfig() {
    try {
      const raw = getStorage().getItem(API_CONFIG_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('读取 API 配置失败', e);
      return null;
    }
  }

  function saveApiConfig(config) {
    try {
      getStorage().setItem(API_CONFIG_KEY, JSON.stringify(config));
      return true;
    } catch (e) {
      console.warn('保存 API 配置失败', e);
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
      getStorage().removeItem(API_CONFIG_KEY);
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
    loadApiConfig,
    saveApiConfig,
    loadPendingModelIncrements,
    savePendingModelIncrements,
    exportData,
    importData,
    clearAll,
  };
})(window);
