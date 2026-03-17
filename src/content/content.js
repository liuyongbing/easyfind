// content.js - 内容脚本主入口

(function() {
  'use strict';

  console.log('[EasyFind] 内容脚本已加载 v1.0.0');

  // ===== 状态管理 =====
  const state = {
    activeRules: [],
    isInitialized: false,
    isProcessing: false,
    currentDomain: window.location.hostname,
    debugMode: false
  };

  // ===== 初始化 =====
  async function init() {
    if (state.isInitialized) return;

    const startTime = performance.now();

    try {
      // 初始化性能监控
      if (window.PerformanceMonitor) {
        window.PerformanceMonitor.init({
          enabled: true,
          logToConsole: state.debugMode
        });
      }

      // 加载规则
      await loadRules();

      // 初始化 DOM 监听器
      if (window.DOMWatcher) {
        window.DOMWatcher.init({
          throttleInterval: 300,
          batchSize: 50
        });

        window.DOMWatcher.start(
          handleNewElements,
          handleRemovedElements
        );
      }

      // 监听消息
      chrome.runtime.onMessage.addListener(handleMessage);

      // 初始应用规则
      await applyAllRules();

      // 监听 URL 变化（SPA 支持）
      observeUrlChanges();

      state.isInitialized = true;

      const initTime = performance.now() - startTime;
      if (window.PerformanceMonitor) {
        window.PerformanceMonitor.recordDOMProcess(initTime);
      }

      console.log('[EasyFind] 初始化完成 (' + initTime.toFixed(2) + 'ms)，已加载', state.activeRules.length, '条规则');

    } catch (error) {
      console.error('[EasyFind] 初始化失败:', error);
    }
  }

  // ===== 规则管理 =====
  async function loadRules() {
    try {
      const rules = await getRulesFromStorage();
      state.activeRules = rules.filter(rule => {
        if (!rule.enabled) return false;
        return matchesDomain(rule, state.currentDomain);
      });
    } catch (error) {
      console.error('[EasyFind] 加载规则失败:', error);
      state.activeRules = [];
    }
  }

  function getRulesFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['easyfind_rules'], (result) => {
        resolve(result.easyfind_rules || []);
      });
    });
  }

  function matchesDomain(rule, domain) {
    const domains = rule.domains || [rule.domainPattern || '*'];
    return domains.some(d => {
      if (d === '*') return true;
      const pattern = d.replace(/\*/g, '.*');
      try {
        const regex = new RegExp(`^${pattern}$`, 'i');
        return regex.test(domain);
      } catch (e) {
        return false;
      }
    });
  }

  // ===== 规则应用 =====
  async function applyAllRules() {
    if (state.activeRules.length === 0) return;
    if (state.isProcessing) return;

    state.isProcessing = true;

    try {
      // 清除之前的效果
      clearAllEffects();

      // 使用 RuleProcessor（如果可用）
      if (window.RuleProcessor) {
        state.activeRules.forEach(rule => {
          const startTime = performance.now();
          const selector = rule.targetSelector || rule.selector;

          if (selector) {
            const elements = document.querySelectorAll(selector);
            const stats = window.RuleProcessor.apply(rule, Array.from(elements));

            const processTime = performance.now() - startTime;
            if (window.PerformanceMonitor) {
              window.PerformanceMonitor.recordRuleProcess(rule.id, processTime);
            }

            if (state.debugMode) {
              console.log(`[EasyFind] 规则 "${rule.name}": ${stats.matched} 匹配, ${stats.notMatched} 不匹配, ${stats.skipped} 跳过`);
            }
          }
        });
      } else {
        // 后备实现
        state.activeRules.forEach(rule => applyRule(rule));
      }
    } finally {
      state.isProcessing = false;
    }
  }

  function applyRule(rule) {
    const selector = rule.targetSelector || rule.selector;
    if (!selector) return;

    const startTime = performance.now();

    try {
      const elements = document.querySelectorAll(selector);

      elements.forEach(el => {
        const result = checkElementMatch(el, rule);
        const actions = rule.actions || {
          match: rule.action || 'highlight',
          noMatch: 'none'
        };

        if (result.matches) {
          applyAction(el, actions.match);
        } else {
          applyAction(el, actions.noMatch);
        }
      });

      const processTime = performance.now() - startTime;
      if (window.PerformanceMonitor) {
        window.PerformanceMonitor.recordRuleProcess(rule.id, processTime);
      }

    } catch (error) {
      console.error('[EasyFind] 应用规则失败:', error);
    }
  }

  function checkElementMatch(element, rule) {
    // 使用 FilterEngine（如果可用）
    if (window.FilterEngine) {
      return window.FilterEngine.checkElementMatch(element, rule);
    }

    // 后备实现
    if (!rule.conditions || rule.conditions.length === 0) {
      return { matches: true };
    }

    let dataElement = element;
    if (rule.dataSelector) {
      dataElement = element.querySelector(rule.dataSelector);
      if (!dataElement) return { matches: false };
    }

    const text = dataElement.textContent || '';

    for (const cond of rule.conditions) {
      if (!evaluateCondition(text, cond)) return { matches: false };
    }

    return { matches: true };
  }

  function evaluateCondition(text, cond) {
    const value = cond.value || '';

    switch (cond.operator) {
      case 'contains': return text.includes(value);
      case 'notContains': return !text.includes(value);
      case '==': return text.trim() === value;
      case '!=': return text.trim() !== value;
      case '>': return parseFloat(text) > parseFloat(value);
      case '>=': return parseFloat(text) >= parseFloat(value);
      case '<': return parseFloat(text) < parseFloat(value);
      case '<=': return parseFloat(text) <= parseFloat(value);
      case 'matches':
        try { return new RegExp(value, 'i').test(text); }
        catch (e) { return false; }
      case 'isEmpty': return !text || text.trim() === '';
      case 'isNotEmpty': return text && text.trim() !== '';
      default: return true;
    }
  }

  function applyAction(element, action) {
    element.classList.remove('easyfind-highlight', 'easyfind-dim', 'easyfind-hide');

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
  }

  function clearAllEffects() {
    document.querySelectorAll('.easyfind-highlight, .easyfind-dim, .easyfind-hide').forEach(el => {
      el.classList.remove('easyfind-highlight', 'easyfind-dim', 'easyfind-hide');
    });

    if (window.ElementCache) {
      window.ElementCache.clear();
    }
  }

  // ===== DOM 变化处理 =====
  function handleNewElements(elements) {
    if (state.activeRules.length === 0) return;

    const startTime = performance.now();

    state.activeRules.forEach(rule => {
      const selector = rule.targetSelector || rule.selector;
      if (!selector) return;

      elements.forEach(element => {
        // 检查元素是否匹配选择器
        let matchingElements = [];

        if (element.matches && element.matches(selector)) {
          matchingElements.push(element);
        }

        // 检查子元素
        if (element.querySelectorAll) {
          const children = element.querySelectorAll(selector);
          matchingElements.push(...children);
        }

        // 处理匹配的元素
        matchingElements.forEach(el => {
          // 检查缓存
          if (window.ElementCache && window.ElementCache.has(el)) {
            if (window.PerformanceMonitor) {
              window.PerformanceMonitor.recordCacheAccess(true);
            }
            return;
          }

          if (window.PerformanceMonitor) {
            window.PerformanceMonitor.recordCacheAccess(false);
          }

          const result = checkElementMatch(el, rule);
          const actions = rule.actions || {
            match: rule.action || 'highlight',
            noMatch: 'none'
          };

          if (result.matches) {
            applyAction(el, actions.match);
          } else {
            applyAction(el, actions.noMatch);
          }

          if (window.ElementCache) {
            window.ElementCache.add(el);
          }
        });
      });
    });

    const processTime = performance.now() - startTime;
    if (window.PerformanceMonitor) {
      window.PerformanceMonitor.recordDOMProcess(processTime, elements.length);
    }
  }

  function handleRemovedElements(elements) {
    // 元素移除时的清理工作
    if (window.PerformanceMonitor) {
      window.PerformanceMonitor.recordMutation();
    }
  }

  // ===== SPA 路由支持 =====
  let lastUrl = location.href;
  let urlChangeTimeout = null;

  function observeUrlChanges() {
    // 监听 popstate 事件
    window.addEventListener('popstate', handleUrlChange);

    // 监听 pushState 和 replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      handleUrlChange();
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      handleUrlChange();
    };

    // 监听 hashchange
    window.addEventListener('hashchange', handleUrlChange);
  }

  function handleUrlChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;

      // 更新当前域名
      state.currentDomain = window.location.hostname;

      // 防抖处理
      if (urlChangeTimeout) {
        clearTimeout(urlChangeTimeout);
      }

      urlChangeTimeout = setTimeout(async () => {
        await loadRules();
        clearAllEffects();
        await applyAllRules();
        urlChangeTimeout = null;
      }, 500);
    }
  }

  // ===== 消息处理 =====
  function handleMessage(request, sender, sendResponse) {
    console.log('[EasyFind] 收到消息:', request.action);

    switch (request.action) {
      case 'testRule':
        const result = testRule(request.rule);
        sendResponse(result);
        break;

      case 'applyRules':
        if (request.rules) {
          state.activeRules = request.rules;
          applyAllRules();
        }
        sendResponse({ success: true });
        break;

      case 'refresh':
        (async () => {
          await loadRules();
          clearAllEffects();
          await applyAllRules();
          sendResponse({ success: true, ruleCount: state.activeRules.length });
        })();
        return true; // 异步响应

      case 'getStats':
        sendResponse(getStats());
        break;

      case 'getPerformance':
        if (window.PerformanceMonitor) {
          sendResponse(window.PerformanceMonitor.getReport());
        } else {
          sendResponse({ error: '性能监控未启用' });
        }
        break;

      case 'clearEffects':
        clearAllEffects();
        sendResponse({ success: true });
        break;

      case 'ping':
        sendResponse({ success: true, initialized: state.isInitialized });
        break;

      case 'enableDebug':
        state.debugMode = true;
        if (window.DebugTools) {
          window.DebugTools.enable();
        }
        sendResponse({ success: true });
        break;

      case 'disableDebug':
        state.debugMode = false;
        if (window.DebugTools) {
          window.DebugTools.disable();
        }
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: '未知操作' });
    }
  }

  function testRule(rule) {
    try {
      const selector = rule.targetSelector || rule.selector;
      if (!selector) {
        return { matchCount: 0, error: '未提供选择器' };
      }

      clearAllEffects();

      const startTime = performance.now();
      const elements = document.querySelectorAll(selector);
      let matchCount = 0;

      elements.forEach(el => {
        const result = checkElementMatch(el, rule);
        if (result.matches) {
          matchCount++;
          applyAction(el, 'highlight');
        }
      });

      const processTime = performance.now() - startTime;

      return {
        matchCount,
        totalElements: elements.length,
        processTime: processTime.toFixed(2) + 'ms',
        success: true
      };
    } catch (error) {
      return { matchCount: 0, error: error.message };
    }
  }

  function getStats() {
    const stats = {
      initialized: state.isInitialized,
      ruleCount: state.activeRules.length,
      domain: state.currentDomain,
      highlighted: document.querySelectorAll('.easyfind-highlight').length,
      dimmed: document.querySelectorAll('.easyfind-dim').length,
      hidden: document.querySelectorAll('.easyfind-hide').length,
      cacheStats: window.ElementCache?.getStats() || null
    };

    if (window.PerformanceMonitor) {
      stats.performance = window.PerformanceMonitor.getReport();
    }

    return stats;
  }

  // ===== 启动 =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
