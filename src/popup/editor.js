// editor.js - 规则编辑器模块

const RuleEditor = {
  currentRule: null,  // 当前编辑的规则 (null = 新建)

  // 初始化
  init() {
    this.bindEvents();
  },

  // 绑定事件
  bindEvents() {
    // 返回按钮
    document.getElementById('btn-back').addEventListener('click', () => this.close());

    // 取消按钮
    document.getElementById('btn-cancel').addEventListener('click', () => this.close());

    // 表单提交
    document.getElementById('rule-form').addEventListener('submit', (e) => this.save(e));

    // 测试按钮
    document.getElementById('btn-test').addEventListener('click', () => this.test());

    // 高级设置折叠
    document.getElementById('btn-advanced').addEventListener('click', (e) => {
      const content = document.getElementById('advanced-content');
      content.classList.toggle('collapsed');
      e.target.textContent = content.classList.contains('collapsed')
        ? '高级设置 ▼' : '高级设置 ▲';
    });
  },

  // 打开编辑器 (rule = null 表示新建)
  open(rule = null) {
    this.currentRule = rule;

    // 更新标题
    document.getElementById('editor-title').textContent = rule ? '编辑规则' : '新建规则';

    // 填充表单
    if (rule) {
      this.populateForm(rule);
    } else {
      this.clearForm();
    }

    // 切换视图
    document.getElementById('view-main').classList.remove('active');
    document.getElementById('view-editor').classList.add('active');
  },

  // 关闭编辑器
  close() {
    document.getElementById('view-editor').classList.remove('active');
    document.getElementById('view-main').classList.add('active');
    this.currentRule = null;
  },

  // 填充表单
  populateForm(rule) {
    document.getElementById('input-name').value = rule.name || '';

    // 域名处理
    const domains = rule.domains
      ? rule.domains.join(', ')
      : (rule.domainPattern || '');
    document.getElementById('input-domains').value = domains;

    // 选择器处理
    document.getElementById('input-selector').value =
      rule.targetSelector || rule.selector || '';

    // 操作处理
    document.getElementById('select-match-action').value =
      rule.actions?.match || rule.action || 'highlight';
    document.getElementById('select-nomatch-action').value =
      rule.actions?.noMatch || 'none';

    // 高级设置
    const dataSelector = document.getElementById('input-data-selector');
    const pattern = document.getElementById('input-pattern');
    const conditionOp = document.getElementById('select-condition-op');
    const conditionValue = document.getElementById('input-condition-value');

    if (dataSelector) {
      dataSelector.value = rule.dataSelector || '';
    }
    if (pattern) {
      pattern.value = rule.extractPattern || '';
    }

    // 条件表达式
    if (rule.conditions && rule.conditions.length > 0) {
      const cond = rule.conditions[0];
      if (conditionOp) conditionOp.value = cond.operator || 'contains';
      if (conditionValue) conditionValue.value = cond.value || '';
    }
  },

  // 清空表单
  clearForm() {
    document.getElementById('rule-form').reset();
  },

  // 从表单获取规则数据
  getFormData() {
    const domainsInput = document.getElementById('input-domains').value.trim();
    const domains = domainsInput
      ? domainsInput.split(',').map(d => d.trim()).filter(d => d)
      : ['*'];

    const data = {
      name: document.getElementById('input-name').value.trim(),
      domains: domains,
      domainPattern: domains[0],  // 向后兼容
      targetSelector: document.getElementById('input-selector').value.trim(),
      selector: document.getElementById('input-selector').value.trim(),  // 向后兼容
      actions: {
        match: document.getElementById('select-match-action').value,
        noMatch: document.getElementById('select-nomatch-action').value
      },
      action: document.getElementById('select-match-action').value,  // 向后兼容
      enabled: true
    };

    // 高级设置
    const dataSelector = document.getElementById('input-data-selector')?.value.trim();
    const pattern = document.getElementById('input-pattern')?.value.trim();
    const conditionOp = document.getElementById('select-condition-op')?.value;
    const conditionValue = document.getElementById('input-condition-value')?.value.trim();

    if (dataSelector) {
      data.dataSelector = dataSelector;
    }

    if (pattern) {
      data.extractPattern = pattern;
    }

    // 条件表达式 - 对于 isEmpty 和 isNotEmpty 不需要 value
    if (conditionOp && !['isEmpty', 'isNotEmpty'].includes(conditionOp)) {
      if (conditionValue) {
        data.conditions = [{
          field: 'text',
          operator: conditionOp,
          value: conditionValue
        }];
      }
    } else if (conditionOp && ['isEmpty', 'isNotEmpty'].includes(conditionOp)) {
      data.conditions = [{
        field: 'text',
        operator: conditionOp
      }];
    }

    return data;
  },

  // 保存规则
  async save(e) {
    e.preventDefault();

    const formData = this.getFormData();

    if (!formData.name) {
      alert('请填写规则名称');
      return;
    }

    if (!formData.targetSelector) {
      alert('请填写目标选择器');
      return;
    }

    try {
      if (this.currentRule) {
        // 更新
        await EasyFindStorage.updateRule(this.currentRule.id, formData);
      } else {
        // 新建
        await EasyFindStorage.addRule(formData);
      }

      this.close();

      // 刷新主视图规则列表
      if (window.PopupMain && window.PopupMain.loadRules) {
        await window.PopupMain.loadRules();
      }
    } catch (error) {
      console.error('保存规则失败:', error);
      alert('保存失败: ' + error.message);
    }
  },

  // 测试规则
  async test() {
    const formData = this.getFormData();

    if (!formData.targetSelector) {
      alert('请先填写目标选择器');
      return;
    }

    // 发送到 content script 进行测试
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'testRule',
          rule: formData
        });

        if (response && response.matchCount !== undefined) {
          const action = response.matchCount > 0 ? '已高亮' : '未找到';
          alert(`测试结果: ${action} ${response.matchCount} 个元素`);
        }
      }
    } catch (error) {
      alert('测试失败: 无法连接到当前页面\n请刷新页面后重试');
    }
  }
};
