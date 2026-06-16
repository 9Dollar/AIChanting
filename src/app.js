(function (global) {
  'use strict';

  function init() {
    const app = document.getElementById('app');
    if (!app) return;

    const scriptures = global.SCRIPTURES || [];
    const formatted = global.NumberUtils ? global.NumberUtils.formatMerit(123456789n) : null;

    app.innerHTML =
      '<div class="card p-6 text-center">' +
      '<h2 class="text-2xl font-bold mb-4">应用加载成功</h2>' +
      '<p class="mb-2">已加载经文：' + scriptures.length + ' 部</p>' +
      '<p class="text-sm text-gray-500">' + (formatted ? '大数测试：' + formatted.traditional : '') + '</p>' +
      '</div>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
