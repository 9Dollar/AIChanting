(function (global) {
  'use strict';

  const BUDDHIST_UNITS = [
    { exponent: 0, unit: '一', label: '个' },
    { exponent: 1, unit: '十', label: '十' },
    { exponent: 2, unit: '百', label: '百' },
    { exponent: 3, unit: '千', label: '千' },
    { exponent: 4, unit: '万', label: '万' },
    { exponent: 5, unit: '十万', label: '十万' },
    { exponent: 6, unit: '百万', label: '百万' },
    { exponent: 7, unit: '千万', label: '千万' },
    { exponent: 8, unit: '亿', label: '亿' },
    { exponent: 9, unit: '十亿', label: '十亿' },
    { exponent: 10, unit: '百亿', label: '百亿' },
    { exponent: 11, unit: '千亿', label: '千亿' },
    { exponent: 12, unit: '兆', label: '兆' },
    { exponent: 16, unit: '京', label: '京' },
    { exponent: 20, unit: '垓', label: '垓' },
    { exponent: 24, unit: '秭', label: '秭' },
    { exponent: 28, unit: '穰', label: '穰' },
    { exponent: 32, unit: '沟', label: '沟' },
    { exponent: 36, unit: '涧', label: '涧' },
    { exponent: 40, unit: '正', label: '正' },
    { exponent: 44, unit: '载', label: '载' },
    { exponent: 48, unit: '极', label: '极' },
    { exponent: 52, unit: '恒河沙', label: '恒河沙' },
    { exponent: 56, unit: '阿僧祇', label: '阿僧祇' },
    { exponent: 60, unit: '那由他', label: '那由他' },
    { exponent: 64, unit: '不可思议', label: '不可思议' },
    { exponent: 68, unit: '无量数', label: '无量数' },
  ];

  function toBigInt(value) {
    if (typeof value === 'bigint') return value;
    if (value === undefined || value === null) return 0n;
    try {
      return BigInt(String(value));
    } catch (e) {
      return 0n;
    }
  }

  function meritToString(value) {
    const n = toBigInt(value);
    return n.toString();
  }

  function formatScientific(value) {
    const n = toBigInt(value);
    const s = n.toString();
    if (s.length <= 4) return s;
    const exp = s.length - 1;
    const mantissa = s[0] + '.' + s.slice(1, 4);
    return `${mantissa} × 10^${exp}`;
  }

  function formatTraditional(value) {
    const n = toBigInt(value);
    if (n === 0n) return '零';

    const s = n.toString();
    const len = s.length;

    const unit = BUDDHIST_UNITS.slice()
      .reverse()
      .find((u) => u.exponent < len);

    if (!unit || unit.exponent === 0) {
      return s;
    }

    const unitValue = 10n ** BigInt(unit.exponent);
    const quotient = n / unitValue;
    const remainder = n % unitValue;

    let result = quotient.toString() + unit.unit;
    if (remainder !== 0n) {
      result += '又' + remainder.toString();
    }
    return result;
  }

  function formatMerit(value) {
    return {
      raw: meritToString(value),
      scientific: formatScientific(value),
      traditional: formatTraditional(value),
    };
  }

  global.NumberUtils = {
    toBigInt,
    meritToString,
    formatScientific,
    formatTraditional,
    formatMerit,
    BUDDHIST_UNITS,
  };
})(window);
