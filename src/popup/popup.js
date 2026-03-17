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
          <div class="rule-domain">${escapeHtml(rule.domains?.join(', ') || rule.domainPattern || '所有网站')}</div>
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

  // 导入按钮
  document.getElementById('btn-import').addEventListener('click', () => importRules());

  // 导出按钮
  document.getElementById('btn-export').addEventListener('click', async () => {
    const rules = await EasyFindStorage.getRules();
    downloadJSON(rules, 'easyfind-rules.json');
  });
}

// 导入规则
async function importRules() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 支持数组或 { rules: [...] } 格式
      const rules = Array.isArray(data) ? data : (data.rules || []);

      if (!rules.length) {
        alert('未找到有效规则');
        return;
      }

      // 确认导入
      const confirmed = confirm(`将导入 ${rules.length} 条规则，是否继续？`);
      if (!confirmed) return;

      // 合并导入
      const count = await EasyFindStorage.importRules(rules);
      await loadRules();

      alert(`成功导入 ${count} 条规则`);
    } catch (error) {
      alert('导入失败: ' + error.message);
    }
  };

  input.click();
}

// 下载 JSON 文件
function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
