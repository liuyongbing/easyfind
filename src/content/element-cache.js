// element-cache.js - 元素缓存模块

/**
 * 元素缓存
 * 用于避免重复处理已经处理过的元素
 */
const ElementCache = {
  // 已处理元素的 WeakSet（自动垃圾回收）
  processedElements: new WeakSet(),

  // 元素哈希缓存（用于检测内容变化）
  elementHashes: new WeakMap(),

  // 统计
  stats: {
    totalCached: 0,
    cacheHits: 0,
    cacheMisses: 0
  },

  /**
   * 检查元素是否已处理
   * @param {Element} element - DOM 元素
   * @returns {boolean} 是否已处理
   */
  has(element) {
    const exists = this.processedElements.has(element);
    if (exists) {
      this.stats.cacheHits++;
    }
    return exists;
  },

  /**
   * 标记元素为已处理
   * @param {Element} element - DOM 元素
   */
  add(element) {
    if (!element) return;

    this.processedElements.add(element);
    this.stats.totalCached++;
    this.stats.cacheMisses++;

    // 存储内容哈希（用于检测变化）
    const hash = this.hashContent(element);
    if (hash) {
      this.elementHashes.set(element, hash);
    }
  },

  /**
   * 批量添加元素
   * @param {Element[]} elements - 元素数组
   */
  addAll(elements) {
    elements.forEach(el => this.add(el));
  },

  /**
   * 移除元素（由 WeakSet 自动处理）
   * @param {Element} element - DOM 元素
   */
  remove(element) {
    // WeakSet 不需要手动移除，会自动垃圾回收
    // 这里只是为了 API 完整性
  },

  /**
   * 检查元素内容是否变化
   * @param {Element} element - DOM 元素
   * @returns {boolean} 是否变化
   */
  hasContentChanged(element) {
    const oldHash = this.elementHashes.get(element);
    if (!oldHash) return true;

    const newHash = this.hashContent(element);
    return oldHash !== newHash;
  },

  /**
   * 更新元素哈希
   * @param {Element} element - DOM 元素
   */
  updateHash(element) {
    const hash = this.hashContent(element);
    if (hash) {
      this.elementHashes.set(element, hash);
    }
  },

  /**
   * 计算元素内容哈希
   * @param {Element} element - DOM 元素
   * @returns {string} 哈希值
   */
  hashContent(element) {
    if (!element) return null;

    // 简单哈希：使用文本内容的特征
    const text = element.textContent || '';
    const className = element.className || '';
    const attributes = Array.from(element.attributes || [])
      .map(attr => `${attr.name}=${attr.value}`)
      .join(',');

    // 简单的字符串哈希
    const str = `${text}|${className}|${attributes}`;
    return this.simpleHash(str);
  },

  /**
   * 简单字符串哈希
   * @param {string} str - 输入字符串
   * @returns {string} 哈希值
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  },

  /**
   * 清除所有缓存
   */
  clear() {
    // WeakSet 无法手动清除，创建新的实例
    this.processedElements = new WeakSet();
    this.elementHashes = new WeakMap();
    this.stats.totalCached = 0;
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  },

  /**
   * 获取统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
        ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2) + '%'
        : '0%'
    };
  }
};

/**
 * 选择器缓存
 * 缓存选择器查询结果
 */
const SelectorCache = {
  // 缓存存储
  cache: new Map(),

  // 配置
  config: {
    maxSize: 100,
    ttl: 5000 // 5秒过期
  },

  /**
   * 获取缓存的选择器结果
   * @param {string} selector - CSS 选择器
   * @returns {NodeList|null} 缓存结果
   */
  get(selector) {
    const cached = this.cache.get(selector);
    if (!cached) return null;

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.config.ttl) {
      this.cache.delete(selector);
      return null;
    }

    return cached.elements;
  },

  /**
   * 设置选择器缓存
   * @param {string} selector - CSS 选择器
   * @param {NodeList} elements - 元素列表
   */
  set(selector, elements) {
    // LRU 淘汰
    if (this.cache.size >= this.config.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(selector, {
      elements,
      timestamp: Date.now()
    });
  },

  /**
   * 使缓存失效
   * @param {string} selector - CSS 选择器（可选，不传则清除所有）
   */
  invalidate(selector = null) {
    if (selector) {
      this.cache.delete(selector);
    } else {
      this.cache.clear();
    }
  },

  /**
   * 获取缓存大小
   * @returns {number} 缓存大小
   */
  size() {
    return this.cache.size;
  }
};

/**
 * 规则处理器
 * 管理规则的应用和撤销
 */
const RuleProcessor = {
  // 当前应用的规则
  appliedRules: new Map(), // ruleId -> { rule, stats }

  // 元素到规则的映射
  elementRules: new WeakMap(), // element -> Set<ruleId>

  /**
   * 应用规则
   * @param {object} rule - 规则对象
   * @param {Element[]} elements - 元素数组
   * @returns {object} 处理统计
   */
  apply(rule, elements) {
    const stats = {
      matched: 0,
      notMatched: 0,
      skipped: 0,
      errors: 0
    };

    const selector = rule.targetSelector || rule.selector;
    if (!selector) return stats;

    elements.forEach(element => {
      try {
        // 检查是否已处理且内容未变
        if (ElementCache.has(element) && !ElementCache.hasContentChanged(element)) {
          stats.skipped++;
          return;
        }

        // 检查是否匹配规则
        const result = this.checkMatch(element, rule);

        if (result.matches) {
          stats.matched++;
          this.applyAction(element, rule, 'match');
        } else {
          stats.notMatched++;
          this.applyAction(element, rule, 'noMatch');
        }

        // 标记为已处理
        ElementCache.add(element);

        // 记录元素-规则映射
        this.addElementRule(element, rule.id);

      } catch (error) {
        stats.errors++;
        console.error('[EasyFind] 处理元素错误:', error);
      }
    });

    // 保存规则应用状态
    this.appliedRules.set(rule.id, { rule, stats });

    return stats;
  },

  /**
   * 检查元素是否匹配规则
   * @param {Element} element - DOM 元素
   * @param {object} rule - 规则对象
   * @returns {object} { matches, reason }
   */
  checkMatch(element, rule) {
    // 使用 FilterEngine（如果可用）
    if (window.FilterEngine) {
      return window.FilterEngine.checkElementMatch(element, rule);
    }

    // 后备实现
    if (!rule.conditions || rule.conditions.length === 0) {
      return { matches: true };
    }

    // 获取数据元素
    let dataElement = element;
    if (rule.dataSelector) {
      dataElement = element.querySelector(rule.dataSelector);
      if (!dataElement) return { matches: false, reason: '数据元素未找到' };
    }

    const text = dataElement.textContent || '';

    // 简单条件检查
    for (const cond of rule.conditions) {
      if (!this.evaluateCondition(text, cond)) {
        return { matches: false };
      }
    }

    return { matches: true };
  },

  /**
   * 评估条件
   * @param {string} text - 文本内容
   * @param {object} cond - 条件对象
   * @returns {boolean} 是否满足
   */
  evaluateCondition(text, cond) {
    const value = cond.value || '';

    switch (cond.operator) {
      case 'contains':
        return text.includes(value);
      case 'notContains':
        return !text.includes(value);
      case '==':
        return text.trim() === value;
      case '!=':
        return text.trim() !== value;
      case '>':
        return parseFloat(text) > parseFloat(value);
      case '>=':
        return parseFloat(text) >= parseFloat(value);
      case '<':
        return parseFloat(text) < parseFloat(value);
      case '<=':
        return parseFloat(text) <= parseFloat(value);
      case 'matches':
        try {
          return new RegExp(value, 'i').test(text);
        } catch (e) {
          return false;
        }
      case 'isEmpty':
        return !text || text.trim() === '';
      case 'isNotEmpty':
        return text && text.trim() !== '';
      default:
        return true;
    }
  },

  /**
   * 应用操作到元素
   * @param {Element} element - DOM 元素
   * @param {object} rule - 规则对象
   * @param {string} type - 'match' 或 'noMatch'
   */
  applyAction(element, rule, type) {
    const actions = rule.actions || { match: rule.action || 'highlight', noMatch: 'none' };
    const action = actions[type] || 'none';

    // 清除之前的效果
    element.classList.remove('easyfind-highlight', 'easyfind-dim', 'easyfind-hide');

    // 应用新效果
    switch (action) {
      case 'highlight':
        element.classList.add('easyfind-highlight');
        break;
      case 'dim':
        element.classList.add('easyfind-dim');
        break;
      case 'hide':
        element.classList.add('easyfind-hide');
        break;
    }
  },

  /**
   * 添加元素-规则映射
   * @param {Element} element - DOM 元素
   * @param {string} ruleId - 规则 ID
   */
  addElementRule(element, ruleId) {
    if (!this.elementRules.has(element)) {
      this.elementRules.set(element, new Set());
    }
    this.elementRules.get(element).add(ruleId);
  },

  /**
   * 撤销规则
   * @param {string} ruleId - 规则 ID
   */
  revoke(ruleId) {
    const applied = this.appliedRules.get(ruleId);
    if (!applied) return;

    // 清除效果
    document.querySelectorAll('.easyfind-highlight, .easyfind-dim, .easyfind-hide').forEach(el => {
      const rules = this.elementRules.get(el);
      if (rules && rules.has(ruleId)) {
        el.classList.remove('easyfind-highlight', 'easyfind-dim', 'easyfind-hide');
        rules.delete(ruleId);
      }
    });

    this.appliedRules.delete(ruleId);
  },

  /**
   * 撤销所有规则
   */
  revokeAll() {
    document.querySelectorAll('.easyfind-highlight, .easyfind-dim, .easyfind-hide').forEach(el => {
      el.classList.remove('easyfind-highlight', 'easyfind-dim', 'easyfind-hide');
    });

    this.appliedRules.clear();
    ElementCache.clear();
  },

  /**
   * 获取规则统计
   * @param {string} ruleId - 规则 ID
   * @returns {object|null} 统计信息
   */
  getRuleStats(ruleId) {
    const applied = this.appliedRules.get(ruleId);
    return applied ? applied.stats : null;
  },

  /**
   * 获取所有应用中的规则
   * @returns {string[]} 规则 ID 数组
   */
  getAppliedRuleIds() {
    return Array.from(this.appliedRules.keys());
  }
};

// 导出
if (typeof window !== 'undefined') {
  window.ElementCache = ElementCache;
  window.SelectorCache = SelectorCache;
  window.RuleProcessor = RuleProcessor;
}
