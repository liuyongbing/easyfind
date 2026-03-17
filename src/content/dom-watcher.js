// dom-watcher.js - DOM 监听模块

/**
 * DOM 监听器
 * 负责监听页面 DOM 变化，智能处理动态加载内容
 */
const DOMWatcher = {
  // MutationObserver 实例
  observer: null,

  // 配置
  config: {
    // 节流间隔（毫秒）
    throttleInterval: 300,
    // 防抖间隔（毫秒）
    debounceInterval: 500,
    // 批量处理阈值
    batchSize: 50,
    // 是否启用懒加载（只处理可见区域）
    lazyLoad: false,
    // 懒加载观察距离
    lazyLoadMargin: '200px'
  },

  // 状态
  state: {
    isWatching: false,
    pendingMutations: false,
    lastProcessTime: 0,
    processedCount: 0,
    throttleTimer: null,
    debounceTimer: null
  },

  // 回调函数
  callbacks: {
    onNewElements: null,
    onRemovedElements: null
  },

  // 懒加载观察器
  lazyLoadObserver: null,

  /**
   * 初始化监听器
   * @param {object} options - 配置选项
   */
  init(options = {}) {
    // 合并配置
    Object.assign(this.config, options);

    // 创建 MutationObserver
    this.observer = new MutationObserver(this.handleMutations.bind(this));

    console.log('[EasyFind] DOM 监听器已初始化');
  },

  /**
   * 开始监听
   * @param {function} onNewElements - 新元素回调
   * @param {function} onRemovedElements - 移除元素回调（可选）
   */
  start(onNewElements, onRemovedElements = null) {
    if (this.state.isWatching) {
      this.stop();
    }

    this.callbacks.onNewElements = onNewElements;
    this.callbacks.onRemovedElements = onRemovedElements;

    // 开始观察整个文档
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });

    this.state.isWatching = true;
    console.log('[EasyFind] DOM 监听已启动');
  },

  /**
   * 停止监听
   */
  stop() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.state.isWatching = false;
    this.clearTimers();
    console.log('[EasyFind] DOM 监听已停止');
  },

  /**
   * 暂停监听（临时）
   */
  pause() {
    if (this.observer && this.state.isWatching) {
      this.observer.disconnect();
    }
  },

  /**
   * 恢复监听
   */
  resume() {
    if (this.observer && this.state.isWatching) {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
    }
  },

  /**
   * 处理 DOM 变化
   * @param {MutationRecord[]} mutations - 变化记录
   */
  handleMutations(mutations) {
    const now = Date.now();
    const timeSinceLastProcess = now - this.state.lastProcessTime;

    // 收集新增节点
    const addedNodes = [];
    const removedNodes = [];

    mutations.forEach(mutation => {
      // 新增节点
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          addedNodes.push(node);
        }
      });

      // 移除节点
      mutation.removedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          removedNodes.push(node);
        }
      });
    });

    // 如果没有有效变化，跳过
    if (addedNodes.length === 0 && removedNodes.length === 0) {
      return;
    }

    // 节流处理：如果距离上次处理时间太短，延迟处理
    if (timeSinceLastProcess < this.config.throttleInterval) {
      if (!this.state.throttleTimer) {
        this.state.throttleTimer = setTimeout(() => {
          this.state.throttleTimer = null;
          this.processChanges(addedNodes, removedNodes);
        }, this.config.throttleInterval - timeSinceLastProcess);
      }
      return;
    }

    // 直接处理
    this.processChanges(addedNodes, removedNodes);
  },

  /**
   * 处理变化
   * @param {Element[]} addedNodes - 新增节点
   * @param {Element[]} removedNodes - 移除节点
   */
  processChanges(addedNodes, removedNodes) {
    this.state.lastProcessTime = Date.now();
    this.state.processedCount++;

    // 处理新增节点
    if (addedNodes.length > 0 && this.callbacks.onNewElements) {
      const flattenedNodes = this.flattenNodes(addedNodes);
      this.callbacks.onNewElements(flattenedNodes);
    }

    // 处理移除节点
    if (removedNodes.length > 0 && this.callbacks.onRemovedElements) {
      this.callbacks.onRemovedElements(removedNodes);
    }
  },

  /**
   * 扁平化节点（展开嵌套元素）
   * @param {Element[]} nodes - 节点数组
   * @returns {Element[]} 扁平化后的节点
   */
  flattenNodes(nodes) {
    const result = [];

    nodes.forEach(node => {
      // 添加节点本身
      result.push(node);

      // 递归添加子元素
      if (node.children && node.children.length > 0) {
        const children = Array.from(node.querySelectorAll('*'));
        result.push(...children);
      }
    });

    return result;
  },

  /**
   * 批量处理元素
   * @param {Element[]} elements - 元素数组
   * @param {function} processor - 处理函数
   */
  batchProcess(elements, processor) {
    const batchSize = this.config.batchSize;
    let index = 0;

    const processBatch = () => {
      const batch = elements.slice(index, index + batchSize);
      index += batchSize;

      batch.forEach(element => {
        try {
          processor(element);
        } catch (error) {
          console.error('[EasyFind] 批量处理错误:', error);
        }
      });

      // 如果还有元素，继续处理
      if (index < elements.length) {
        requestAnimationFrame(processBatch);
      }
    };

    processBatch();
  },

  /**
   * 智能检测是否需要重新处理
   * @param {MutationRecord[]} mutations - 变化记录
   * @returns {boolean} 是否需要处理
   */
  shouldProcess(mutations) {
    // 检查是否有实质性变化
    for (const mutation of mutations) {
      // 忽略特定类型的节点
      const hasSignificantChanges = Array.from(mutation.addedNodes).some(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;

        // 忽略脚本、样式等
        const tagName = node.tagName?.toLowerCase();
        if (['script', 'style', 'link', 'meta', 'noscript'].includes(tagName)) {
          return false;
        }

        // 忽略很小的元素（可能是装饰性元素）
        if (node.offsetWidth < 10 && node.offsetHeight < 10) {
          return false;
        }

        return true;
      });

      if (hasSignificantChanges) return true;
    }

    return false;
  },

  /**
   * 清除定时器
   */
  clearTimers() {
    if (this.state.throttleTimer) {
      clearTimeout(this.state.throttleTimer);
      this.state.throttleTimer = null;
    }
    if (this.state.debounceTimer) {
      clearTimeout(this.state.debounceTimer);
      this.state.debounceTimer = null;
    }
  },

  /**
   * 获取统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    return {
      isWatching: this.state.isWatching,
      processedCount: this.state.processedCount,
      lastProcessTime: this.state.lastProcessTime
    };
  },

  /**
   * 启用懒加载模式
   */
  enableLazyLoad() {
    if (!('IntersectionObserver' in window)) {
      console.warn('[EasyFind] 浏览器不支持 IntersectionObserver');
      return;
    }

    this.config.lazyLoad = true;
    this.lazyLoadObserver = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      {
        rootMargin: this.config.lazyLoadMargin,
        threshold: 0
      }
    );

    console.log('[EasyFind] 懒加载模式已启用');
  },

  /**
   * 处理可见性变化
   * @param {IntersectionObserverEntry[]} entries - 观察条目
   */
  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 元素进入可见区域
        if (this.callbacks.onNewElements) {
          this.callbacks.onNewElements([entry.target]);
        }
        // 停止观察该元素
        this.lazyLoadObserver.unobserve(entry.target);
      }
    });
  },

  /**
   * 观察元素（懒加载模式）
   * @param {Element} element - 要观察的元素
   */
  observeElement(element) {
    if (this.config.lazyLoad && this.lazyLoadObserver) {
      this.lazyLoadObserver.observe(element);
    }
  },

  /**
   * 销毁监听器
   */
  destroy() {
    this.stop();

    if (this.lazyLoadObserver) {
      this.lazyLoadObserver.disconnect();
      this.lazyLoadObserver = null;
    }

    this.callbacks = {
      onNewElements: null,
      onRemovedElements: null
    };

    console.log('[EasyFind] DOM 监听器已销毁');
  }
};

// 导出
if (typeof window !== 'undefined') {
  window.DOMWatcher = DOMWatcher;
}
