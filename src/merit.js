(function (global) {
  'use strict';

  const DEVOTION_TIERS = [
    { min: 1, max: 100, numerator: 10, title: '初入门' },
    { min: 101, max: 1000, numerator: 11, title: '虔诚者' },
    { min: 1001, max: 10000, numerator: 12, title: '精进者' },
    { min: 10001, max: 100000, numerator: 13, title: '得道者' },
    { min: 100001, max: 1000000, numerator: 14, title: '罗汉果' },
    { min: 1000001, max: 10000000, numerator: 15, title: '菩萨道' },
    { min: 10000001, max: 100000000, numerator: 16, title: '佛境界' },
    { min: 100000001, max: 1000000000, numerator: 17, title: '如来藏' },
    { min: 1000000001, max: 10000000000, numerator: 18, title: '真如性' },
    { min: 10000000001, max: Infinity, numerator: 19, title: '无量寿佛' },
  ];

  const DENOMINATOR = 10n;

  function getDevotionInfo(count) {
    const n = Math.max(0, Number(count) || 0);
    if (n === 0) {
      return { count: 0, coefficient: 1.0, numerator: 10, title: '初入门' };
    }
    const tier =
      DEVOTION_TIERS.find((t) => n >= t.min && n <= t.max) ||
      DEVOTION_TIERS[DEVOTION_TIERS.length - 1];
    return {
      count: n,
      coefficient: tier.numerator / 10,
      numerator: tier.numerator,
      title: tier.title,
    };
  }

  function calculateSingleMerit(baseMerit, currentCount) {
    const base = global.NumberUtils ? global.NumberUtils.toBigInt(baseMerit) : BigInt(baseMerit);
    const info = getDevotionInfo(currentCount);
    const numerator = BigInt(info.numerator);
    const raw = base * numerator;
    const rounded = (raw + 5n) / DENOMINATOR;
    return {
      merit: rounded,
      coefficient: info.coefficient,
      title: info.title,
    };
  }

  function addMerit(total, delta) {
    const a = global.NumberUtils ? global.NumberUtils.toBigInt(total) : BigInt(total);
    const b = global.NumberUtils ? global.NumberUtils.toBigInt(delta) : BigInt(delta);
    return a + b;
  }

  function getLevelInfo(totalMerit) {
    const merit = global.NumberUtils ? global.NumberUtils.toBigInt(totalMerit) : BigInt(totalMerit);
    const s = merit.toString();
    const len = s.length;
    let level = 1;
    if (len >= 2) level = Math.max(level, len - 1);
    if (len >= 4) level = Math.max(level, len + 2);
    if (len >= 7) level = Math.max(level, len + 5);

    return {
      level,
      title: getDevotionInfo(level).title,
    };
  }

  global.MeritSystem = {
    DEVOTION_TIERS,
    getDevotionInfo,
    calculateSingleMerit,
    addMerit,
    getLevelInfo,
  };
})(window);
