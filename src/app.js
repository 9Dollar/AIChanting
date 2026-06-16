(function (global) {
  'use strict';

  function init() {
    const app = document.getElementById('app');
    if (!app) return;

    let user = global.StorageManager.loadUser();
    if (!user || !global.UserSystem.isValidUser(user)) {
      user = global.UserSystem.createUser();
      global.StorageManager.saveUser(user);
    } else {
      user = global.UserSystem.migrateUser(user);
    }

    const scriptures = global.SCRIPTURES || [];
    const heartSutra = scriptures.find((s) => s.id === 'heart-sutra');
    const baseMerit = heartSutra ? heartSutra.baseMerit : 0;

    const result = global.MeritSystem
      ? global.MeritSystem.calculateSingleMerit(baseMerit, 1)
      : { merit: '0', coefficient: 1.0, title: '初入门' };

    const formatted = global.NumberUtils
      ? global.NumberUtils.formatMerit(global.NumberUtils.toBigInt(result.merit))
      : null;

    app.innerHTML =
      '<div class="card p-6 text-center space-y-2">' +
      '<h2 class="text-2xl font-bold mb-4">欢迎，' + escapeHtml(user.name) + '</h2>' +
      '<p class="text-sm text-gray-600">GUID: ' + escapeHtml(user.id) + '</p>' +
      '<p class="text-lg">当前虔诚称号：<span class="font-bold text-yellow-700">' + escapeHtml(result.title) + '</span></p>' +
      '<p class="text-lg">单次功德：<span class="font-bold text-yellow-700">' + (formatted ? formatted.traditional : result.merit) + '</span></p>' +
      '</div>';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
