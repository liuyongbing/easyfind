// performance-monitor.js - 性能监控模块

/**
 * 性能监控器
 * 用于跟踪和报告扩展性能指标
 */
const PerformanceMonitor = {
  // 指标存储
  metrics: {
    // 规则处理时间
    ruleProcessTime: [],
    // DOM 处理时间
    domProcessTime: [],
    // 缓存命中率
    cacheHits: 0,
    cacheMisses: 0,
    // DOM 变化次数
    mutationCount: 0,
    // 元素处理数量
    elementsProcessed: 0,
    // 初始化时间
    initTime: 0,
    // 内存使用峰值
    memoryPeak: 0
  },

  // 配置
  config: {
    // 是否启用监控
    enabled: true,
    // 最大记录数
    maxRecords: 100,
    // 采样间隔（毫秒）
    sampleInterval: 1000,
    // 是否报告到控制台
    logToConsole: false
  },

  // 定时器
  sampleTimer: null,

  /**
   * 初始化监控器
   * @param {object} options - 配置选项
   */
  init(options = {}) {
    Object.assign(this.config, options);
    this.metrics.initTime = Date.now();

    if (this.config.enabled) {
      this.startSampling();
    }

    console.log('[EasyFind] 性能监控器已初始化');
  },

  /**
   * 开始采样
   */
  startSampling() {
    this.sampleTimer = setInterval(() => {
      this.sample();
    }, this.config.sampleInterval);
  },

  /**
   * 停止采样
   */
  stopSampling() {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
  },

  /**
   * 执行采样
   */
  sample() {
    // 采样内存使用（如果可用）
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize;
      if (used > this.metrics.memoryPeak) {
        this.metrics.memoryPeak = used;
      }
    }
  },

  /**
   * 记录规则处理时间
   * @param {string} ruleId - 规则 ID
   * @param {number} time - 处理时间（毫秒）
   */
  recordRuleProcess(ruleId, time) {
    this.metrics.ruleProcessTime.push({
      ruleId,
      time,
      timestamp: Date.now()
    });

    // 限制记录数
    if (this.metrics.ruleProcessTime.length > this.config.maxRecords) {
      this.metrics.ruleProcessTime.shift();
    }
  },

  /**
   * 记录 DOM 处理时间
   * @param {number} time - 处理时间（毫秒）
   * @param {number} count - 处理元素数量
   */
  recordDOMProcess(time, count = 0) {
    this.metrics.domProcessTime.push({
      time,
      count,
      timestamp: Date.now()
    });

    this.metrics.elementsProcessed += count;

    if (this.metrics.domProcessTime.length > this.config.maxRecords) {
      this.metrics.domProcessTime.shift();
    }
  },

  /**
   * 记录缓存命中
   * @param {boolean} hit - 是否命中
   */
  recordCacheAccess(hit) {
    if (hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
  },

  /**
   * 记录 DOM 变化
   */
  recordMutation() {
    this.metrics.mutationCount++;
  },

  /**
   * 计算平均处理时间
   * @param {Array} records - 时间记录数组
   * @returns {number} 平均时间
   */
  calculateAverage(records) {
    if (records.length === 0) return 0;
    const sum = records.reduce((acc, r) => acc + r.time, 0);
    return sum / records.length;
  },

  /**
   * 获取统计报告
   * @returns {object} 统计报告
   */
  getReport() {
    const avgRuleTime = this.calculateAverage(this.metrics.ruleProcessTime);
    const avgDOMTime = this.calculateAverage(this.metrics.domProcessTime);
    const totalCacheAccess = this.metrics.cacheHits + this.metrics.cacheMisses;

    return {
      // 运行时间
      uptime: Date.now() - this.metrics.initTime,
      // 平均处理时间
      avgRuleProcessTime: avgRuleTime.toFixed(2) + 'ms',
      avgDOMProcessTime: avgDOMTime.toFixed(2) + 'ms',
      // 缓存统计
      cacheHitRate: totalCacheAccess > 0
        ? (this.metrics.cacheHits / totalCacheAccess * 100).toFixed(2) + '%'
        : 'N/A',
      // 元素处理
      elementsProcessed: this.metrics.elementsProcessed,
      mutationsHandled: this.metrics.mutationCount,
      // 内存使用（如果可用）
      memoryPeakMB: this.metrics.memoryPeak > 0
        ? (this.metrics.memoryPeak / 1024 / 1024).toFixed(2) + 'MB'
        : 'N/A',
      // 最近处理时间
      recentProcessTimes: this.metrics.domProcessTime.slice(-10).map(r => r.time)
    };
  },

  /**
   * 打印报告到控制台
   */
  printReport() {
    const report = this.getReport();
    console.group('[EasyFind] 性能报告');
    console.table({
      '运行时间': report.uptime + 'ms',
      '平均规则处理': report.avgRuleProcessTime,
      '平均DOM处理': report.avgDOMProcessTime,
      '缓存命中率': report.cacheHitRate,
      '已处理元素': report.elementsProcessed,
      'DOM变化次数': report.mutationsHandled,
      '内存峰值': report.memoryPeakMB
    });
    console.groupEnd();
  },

  /**
   * 重置统计
   */
  reset() {
    this.metrics = {
      ruleProcessTime: [],
      domProcessTime: [],
      cacheHits: 0,
      cacheMisses: 0,
      mutationCount: 0,
      elementsProcessed: 0,
      initTime: Date.now(),
      memoryPeak: 0
    };
  },

  /**
   * 销毁监控器
   */
  destroy() {
    this.stopSampling();
    this.reset();
  }
};

/**
 * 性能计时器
 * 用于精确测量代码执行时间
 */
const PerformanceTimer = {
  timers: new Map(),

  /**
   * 开始计时
   * @param {string} name - 计时器名称
   */
  start(name) {
    this.timers.set(name, {
      start: performance.now(),
      end: null
    });
  },

  /**
   * 结束计时
   * @param {string} name - 计时器名称
   * @returns {number} 耗时（毫秒）
   */
  end(name) {
    const timer = this.timers.get(name);
    if (!timer) return 0;

    timer.end = performance.now();
    const duration = timer.end - timer.start;

    // 记录到监控器
    if (window.PerformanceMonitor) {
      window.PerformanceMonitor.recordDOMProcess(duration);
    }

    return duration;
  },

  /**
   * 获取计时结果
   * @param {string} name - 计时器名称
   * @returns {object} 计时结果
   */
  get(name) {
    const timer = this.timers.get(name);
    if (!timer) return null;

    return {
      start: timer.start,
      end: timer.end,
      duration: timer.end ? timer.end - timer.start : null
    };
  },

  /**
   * 测量异步函数执行时间
   * @param {string} name - 计时器名称
   * @param {Function} fn - 异步函数
   * @returns {Promise<any>} 函数结果
   */
  async measure(name, fn) {
    this.start(name);
    try {
      const result = await fn();
      return result;
    } finally {
      this.end(name);
    }
  },

  /**
   * 测量同步函数执行时间
   * @param {string} name - 计时器名称
   * @param {Function} fn - 同步函数
   * @returns {any} 函数结果
   */
  measureSync(name, fn) {
    this.start(name);
    try {
      return fn();
    } finally {
      this.end(name);
    }
  }
};

/**
 * 调试工具
 */
const DebugTools = {
  config: {
    enabled: false,
    logLevel: 'info' // 'debug', 'info', 'warn', 'error'
  },

  /**
   * 启用调试模式
   */
  enable() {
    this.config.enabled = true;
    console.log('[EasyFind] 调试模式已启用');
  },

  /**
   * 禁用调试模式
   */
  disable() {
    this.config.enabled = false;
    console.log('[EasyFind] 调试模式已禁用');
  },

  /**
   * 打印调试日志
   * @param {string} level - 日志级别
   * @param {string} message - 消息
   * @param {any} data - 数据
   */
  log(level, message, data = null) {
    if (!this.config.enabled) return;

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.config.logLevel] || 1;
    const msgLevel = levels[level] || 1;

    if (msgLevel >= currentLevel) {
      const prefix = `[EasyFind ${level.toUpperCase()}]`;
      if (data !== null) {
        console[level](prefix, message, data);
      } else {
        console[level](prefix, message);
      }
    }
  },

  /**
   * 检查元素状态
   * @param {Element} element - DOM 元素
   * @returns {object} 元素状态
   */
  inspectElement(element) {
    return {
      tagName: element.tagName,
      className: element.className,
      id: element.id,
      hasHighlight: element.classList.contains('easyfind-highlight'),
      hasDim: element.classList.contains('easyfind-dim'),
      hasHide: element.classList.contains('easyfind-hide'),
      isVisible: this.isElementVisible(element),
      rect: element.getBoundingClientRect()
    };
  },

  /**
   * 检查元素是否可见
   * @param {Element} element - DOM 元素
   * @returns {boolean} 是否可见
   */
  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0';
  },

  /**
   * 高亮元素（调试用）
   * @param {Element} element - DOM 元素
   * @param {string} color - 颜色
   */
  highlightForDebug(element, color = 'red') {
    element.style.outline = `3px dashed ${color}`;
    element.style.outlineOffset = '2px';

    setTimeout(() => {
      element.style.outline = '';
      element.style.outlineOffset = '';
    }, 2000);
  },

  /**
   * 导出调试信息
   * @returns {object} 调试信息
   */
  exportDebugInfo() {
    return {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      performance: window.PerformanceMonitor?.getReport() || null,
      stats: {
        highlighted: document.querySelectorAll('.easyfind-highlight').length,
        dimmed: document.querySelectorAll('.easyfind-dim').length,
        hidden: document.querySelectorAll('.easyfind-hide').length
      },
      userAgent: navigator.userAgent
    };
  }
};

// 导出
if (typeof window !== 'undefined') {
  window.PerformanceMonitor = PerformanceMonitor;
  window.PerformanceTimer = PerformanceTimer;
  window.DebugTools = DebugTools;
}
