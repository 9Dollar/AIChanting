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

    const openaiProviders = global.ApiModule
      ? Object.keys(global.ApiModule.OPENAI_PROVIDERS)
      : [];
    const anthropicProviders = global.ApiModule
      ? Object.keys(global.ApiModule.ANTHROPIC_PROVIDERS)
      : [];

    app.innerHTML =
      '<div class="card p-6 text-center space-y-2">' +
      '<h2 class="text-2xl font-bold mb-4">欢迎，' + escapeHtml(user.name) + '</h2>' +
      '<p class="text-sm text-gray-600">GUID: ' + escapeHtml(user.id) + '</p>' +
      '<p class="text-lg">OpenAI 格式服务商：<span class="font-bold text-yellow-700">' + openaiProviders.length + '</span> 个</p>' +
      '<p class="text-lg">Anthropic 格式服务商：<span class="font-bold text-yellow-700">' + anthropicProviders.length + '</span> 个</p>' +
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
