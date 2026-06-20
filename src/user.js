(function (global) {
  'use strict';

  function generateGUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function generateDharmaName() {
    const pool = global.NAME_POOL || { prefixes: ['慧'], suffixes: ['空'] };
    const prefix = pool.prefixes[Math.floor(Math.random() * pool.prefixes.length)];
    const suffix = pool.suffixes[Math.floor(Math.random() * pool.suffixes.length)];
    return prefix + suffix;
  }

  function createUser(nameOverride) {
    return {
      id: generateGUID(),
      name: nameOverride || generateDharmaName(),
      createdAt: Date.now(),
      totalMerit: '0',
      chantCount: 0,
      byScripture: {},
      byModel: {},
      activePresetId: null,
      records: [],
    };
  }

  function isValidUser(data) {
    return (
      data &&
      typeof data.id === 'string' &&
      data.id.length > 0 &&
      typeof data.name === 'string' &&
      typeof data.totalMerit === 'string'
    );
  }

  function migrateUser(data) {
    if (!data) return null;
    return {
      id: data.id || generateGUID(),
      name: data.name || generateDharmaName(),
      createdAt: data.createdAt || Date.now(),
      totalMerit: String(data.totalMerit || '0'),
      chantCount: Number(data.chantCount || 0),
      byScripture: data.byScripture || {},
      byModel: data.byModel || {},
      activePresetId: data.activePresetId || null,
      records: Array.isArray(data.records) ? data.records : [],
    };
  }

  global.UserSystem = {
    generateGUID,
    generateDharmaName,
    createUser,
    isValidUser,
    migrateUser,
  };
})(window);
