// filter-engine.js - 筛选引擎模块

/**
 * 筛选引擎
 * 负责执行页面内容筛选逻辑
 */
const FilterEngine = {
  // 单位映射表
  unitMappings: {
    // 英文单位
    'K': 1000,
    'k': 1000,
    'M': 1000000,
    'm': 1000000,
    'B': 1000000000,
    'b': 1000000000,
    // 中文单位
    '万': 10000,
    '亿': 100000000,
    // 时间单位
    '秒': 1,
    '分钟': 60,
    '小时': 3600,
    '天': 86400
  },

  /**
   * 解析带单位的数值
   * @param {string} text - 包含数值的文本
   * @param {object} options - 解析选项
   * @returns {number|null} 解析后的数值
   */
  parseNumber(text, options = {}) {
    if (!text) return null;

    // 移除空格和逗号
    let cleanText = text.toString().replace(/[\s,]/g, '');

    // 提取数字部分
    const match = cleanText.match(/^([-+]?\d*\.?\d+)\s*(\S*)?$/);
    if (!match) {
      // 尝试更宽松的匹配
      const looseMatch = cleanText.match(/([-+]?\d*\.?\d+)/);
      if (!looseMatch) return null;

      const num = parseFloat(looseMatch[1]);
      const remaining = cleanText.replace(looseMatch[1], '').trim();
      const unit = this.parseUnit(remaining);
      return num * unit;
    }

    const num = parseFloat(match[1]);
    const unitStr = match[2] || '';

    // 检查是否有自定义单位映射
    if (options.unitMapping && options.unitMapping[unitStr] !== undefined) {
      return num * options.unitMapping[unitStr];
    }

    // 使用默认单位映射
    const unit = this.parseUnit(unitStr);
    return num * unit;
  },

  /**
   * 解析单位
   * @param {string} unitStr - 单位字符串
   * @returns {number} 单位乘数
   */
  parseUnit(unitStr) {
    if (!unitStr) return 1;
    return this.unitMappings[unitStr] || 1;
  },

  /**
   * 解析时间格式 (HH:MM:SS 或 MM:SS)
   * @param {string} text - 时间文本
   * @returns {object} { hours, minutes, seconds, totalSeconds }
   */
  parseTime(text) {
    if (!text) return null;

    // 匹配 H:MM:SS 或 MM:SS 格式
    const match = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);

    return {
      hours,
      minutes,
      seconds,
      totalSeconds: hours * 3600 + minutes * 60 + seconds
    };
  },

  /**
   * 使用正则提取数据
   * @param {string} text - 源文本
   * @param {string} pattern - 正则表达式
   * @returns {object|null} 提取结果 { match, groups }
   */
  extractWithRegex(text, pattern) {
    if (!text || !pattern) return null;

    try {
      // 防止 ReDoS - 限制正则执行时间
      const regex = new RegExp(pattern, 'i');
      const match = text.match(regex);

      if (!match) return null;

      return {
        match: match[0],
        groups: match.slice(1),
        fullMatch: match
      };
    } catch (error) {
      console.error('[EasyFind] 正则错误:', error);
      return null;
    }
  },

  /**
   * 评估单个条件
   * @param {string|number} actualValue - 实际值
   * @param {object} condition - 条件对象
   * @returns {boolean} 是否满足条件
   */
  evaluateCondition(actualValue, condition) {
    const operator = condition.operator || '==';
    let targetValue = condition.value;

    // 转换为数值比较（如果可能）
    const actualNum = this.parseNumber(actualValue, condition);
    const targetNum = this.parseNumber(targetValue, condition);

    // 对于数值比较，优先使用解析后的数值
    const useNumericComparison = actualNum !== null && targetNum !== null &&
      ['>', '>=', '<', '<='].includes(operator);

    const actual = useNumericComparison ? actualNum : actualValue.toString();
    const target = useNumericComparison ? targetNum : targetValue.toString();

    switch (operator) {
      case '==':
      case '===':
        return actual == target;

      case '!=':
      case '!==':
        return actual != target;

      case '>':
        return useNumericComparison ? actual > target : parseFloat(actual) > parseFloat(target);

      case '>=':
        return useNumericComparison ? actual >= target : parseFloat(actual) >= parseFloat(target);

      case '<':
        return useNumericComparison ? actual < target : parseFloat(actual) < parseFloat(target);

      case '<=':
        return useNumericComparison ? actual <= target : parseFloat(actual) <= parseFloat(target);

      case 'contains':
        return actual.toString().includes(target.toString());

      case 'notContains':
        return !actual.toString().includes(target.toString());

      case 'startsWith':
        return actual.toString().startsWith(target.toString());

      case 'endsWith':
        return actual.toString().endsWith(target.toString());

      case 'matches':
        try {
          const regex = new RegExp(target, 'i');
          return regex.test(actual.toString());
        } catch (e) {
          return false;
        }

      case 'notMatches':
        try {
          const regex = new RegExp(target, 'i');
          return !regex.test(actual.toString());
        } catch (e) {
          return true;
        }

      case 'isEmpty':
        return !actual || actual.toString().trim() === '';

      case 'isNotEmpty':
        return actual && actual.toString().trim() !== '';

      default:
        console.warn('[EasyFind] 未知操作符:', operator);
        return true;
    }
  },

  /**
   * 评估多个条件
   * @param {string} text - 源文本
   * @param {array} conditions - 条件数组
   * @param {object} options - 选项
   * @returns {boolean} 是否满足所有条件
   */
  evaluateConditions(text, conditions, options = {}) {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    // 获取条件组合模式 (AND 或 OR)
    const mode = options.conditionMode || 'AND';

    for (const condition of conditions) {
      let valueToCheck = text;

      // 如果指定了分组索引，使用正则提取的分组
      if (options.extractedGroups && condition.groupIndex !== undefined) {
        valueToCheck = options.extractedGroups[condition.groupIndex - 1] || '';
      }

      // 如果有默认值且值为空，使用默认值
      if (condition.defaultValue !== undefined &&
        (valueToCheck === '' || valueToCheck === null || valueToCheck === undefined)) {
        valueToCheck = condition.defaultValue;
      }

      const result = this.evaluateCondition(valueToCheck, condition);

      if (mode === 'OR' && result) return true;
      if (mode === 'AND' && !result) return false;
    }

    return mode === 'AND';
  },

  /**
   * 检查元素是否匹配规则
   * @param {Element} element - DOM 元素
   * @param {object} rule - 规则对象
   * @returns {boolean} 是否匹配
   */
  checkElementMatch(element, rule) {
    // 获取数据元素
    let dataElement = element;
    if (rule.dataSelector) {
      dataElement = element.querySelector(rule.dataSelector);
      if (!dataElement) return { matches: false, reason: '数据元素未找到' };
    }

    const text = dataElement.textContent || '';

    // 如果没有条件，所有元素都匹配
    if (!rule.conditions || rule.conditions.length === 0) {
      return { matches: true, text };
    }

    // 提取数据
    let extractedGroups = null;
    if (rule.extractPattern) {
      const extraction = this.extractWithRegex(text, rule.extractPattern);
      if (!extraction) {
        return { matches: false, reason: '正则未匹配', text };
      }
      extractedGroups = extraction.groups;
    }

    // 评估条件
    const matches = this.evaluateConditions(text, rule.conditions, {
      conditionMode: rule.conditionMode || 'AND',
      extractedGroups
    });

    return { matches, text, extractedGroups };
  },

  /**
   * 应用规则到元素
   * @param {Element} element - DOM 元素
   * @param {object} rule - 规则对象
   * @returns {object} 处理结果
   */
  applyRuleToElement(element, rule) {
    const result = this.checkElementMatch(element, rule);

    // 获取操作配置
    const actions = rule.actions || {
      match: rule.action || 'highlight',
      noMatch: 'none'
    };

    // 确定要执行的操作
    const action = result.matches ? actions.match : actions.noMatch;

    return {
      ...result,
      action
    };
  },

  /**
   * 批量处理元素
   * @param {NodeList|Array} elements - 元素集合
   * @param {object} rule - 规则对象
   * @returns {object} 处理统计
   */
  processElements(elements, rule) {
    const stats = {
      total: elements.length,
      matched: 0,
      notMatched: 0,
      errors: 0
    };

    elements.forEach(element => {
      try {
        const result = this.applyRuleToElement(element, rule);

        if (result.matches) {
          stats.matched++;
        } else {
          stats.notMatched++;
        }

        // 存储处理结果到元素上（供后续使用）
        element._easyfindResult = result;

      } catch (error) {
        stats.errors++;
        console.error('[EasyFind] 处理元素失败:', error);
      }
    });

    return stats;
  }
};

// 导出（用于 content script）
if (typeof window !== 'undefined') {
  window.FilterEngine = FilterEngine;
}
