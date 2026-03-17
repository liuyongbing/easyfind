// service-worker.js - 后台服务

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[EasyFind] 扩展已安装/更新:', details.reason);

  if (details.reason === 'install') {
    // 首次安装，初始化默认规则
    await initializeDefaultRules();
  }
});

async function initializeDefaultRules() {
  try {
    // 检查是否已有规则
    const result = await chrome.storage.local.get(['easyfind_rules']);

    if (!result.easyfind_rules || result.easyfind_rules.length === 0) {
      // 加载默认规则
      const defaultRules = getDefaultRules();
      await chrome.storage.local.set({ easyfind_rules: defaultRules });
      console.log('[EasyFind] 已初始化默认规则');
    }
  } catch (error) {
    console.error('[EasyFind] 初始化默认规则失败:', error);
  }
}

function getDefaultRules() {
  return [
    {
      id: 'example-1',
      name: '示例规则 - 高亮价格',
      description: '高亮显示页面中的价格元素',
      domainPattern: '*',
      selector: '[class*="price"]',
      action: 'highlight',
      enabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'example-2',
      name: '示例规则 - 隐藏广告',
      description: '隐藏常见的广告元素',
      domainPattern: '*',
      selector: '[class*="ad-"], [id*="ad-"], .advertisement',
      action: 'hide',
      enabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];
}

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.easyfind_rules) {
    console.log('[EasyFind] 规则已更新');
    // 通知所有标签页刷新规则
    notifyAllTabs();
  }
});

async function notifyAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'refresh' });
        } catch (e) {
          // 忽略无法发送的标签页
        }
      }
    }
  } catch (error) {
    console.error('[EasyFind] 通知标签页失败:', error);
  }
}
