// popup.js - 弹窗逻辑

// 暴露给 editor.js 调用
window.PopupMain = {
  loadRules,
  loadCurrentDomain
};

document.addEventListener('DOMContentLoaded', async () => {
  await initPopup();
});

async function initPopup() {
  await loadCurrentDomain();
  await loadRules();
  bindEvents();

  // 初始化编辑器模块
  if (window.RuleEditor) {
    window.RuleEditor.init();
  }
}

async function loadCurrentDomain() {
  const domainEl = document.getElementById('current-domain');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      domainEl.textContent = url.hostname || '无法获取';
    } else {
      domainEl.textContent = '无法获取';
    }
  } catch (error) {
    domainEl.textContent = '无法获取';
    console.error('获取域名失败:', error);
  }
}

async function loadRules() {
  const rulesList = document.getElementById('rules-list');

  try {
    const rules = await EasyFindStorage.getRules();

    if (!rules || rules.length === 0) {
      rulesList.innerHTML = '<div class="empty-state">暂无规则，点击下方按钮添加</div>';
      return;
    }

    rulesList.innerHTML = rules.map((rule) => `
      <div class="rule-item" data-id="${rule.id}">
        <div class="rule-info">
          <div class="rule-name">${escapeHtml(rule.name)}</div>
          <div class="rule-domain">${escapeHtml(rule.extractPattern || rule.conditions?.[0]?.value || '正则')}</div>
        </div>
        <div class="rule-toggle ${rule.enabled ? 'active' : ''}" data-id="${rule.id}"></div>
        <div class="rule-actions">
          <button class="btn-edit" data-id="${rule.id}">编辑</button>
          <button class="btn-delete" data-id="${rule.id}">删除</button>
        </div>
      </div>
    `).join('');

    // 绑定事件
    bindRuleEvents();

  } catch (error) {
    rulesList.innerHTML = '<div class="empty-state">加载规则失败</div>';
    console.error('加载规则失败:', error);
  }
}

function bindRuleEvents() {
  // 切换开关
  document.querySelectorAll('.rule-toggle').forEach(toggle => {
    toggle.addEventListener('click', async (e) => {
      const ruleId = e.target.dataset.id;
      await toggleRule(ruleId);
    });
  });

  // 编辑按钮
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const ruleId = e.target.dataset.id;
      const rules = await EasyFindStorage.getRules();
      const rule = rules.find(r => r.id === ruleId);
      if (rule && window.RuleEditor) {
        window.RuleEditor.open(rule);
      }
    });
  });

  // 删除按钮
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const ruleId = e.target.dataset.id;
      if (confirm('确定要删除这条规则吗？')) {
        await EasyFindStorage.deleteRule(ruleId);
        await loadRules();
      }
    });
  });
}

async function toggleRule(ruleId) {
  const rules = await EasyFindStorage.getRules();
  const rule = rules.find(r => r.id === ruleId);
  if (rule) {
    await EasyFindStorage.updateRule(ruleId, { enabled: !rule.enabled });
    await loadRules();
  }
}

function bindEvents() {
  // 新建规则按钮
  document.getElementById('btn-new').addEventListener('click', () => {
    if (window.RuleEditor) {
      window.RuleEditor.open(null);
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 暴露给全局，供 popup.js 使用
window.RuleEditor = RuleEditor;
