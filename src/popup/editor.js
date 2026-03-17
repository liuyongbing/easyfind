// editor.js - 规则编辑器模块 (简化版)

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
    // 从 conditions 中提取正则
    const pattern = rule.extractPattern || rule.conditions?.[0]?.value || '';
    document.getElementById('input-pattern').value = pattern;
  },

  // 清空表单
  clearForm() {
    document.getElementById('rule-form').reset();
  },

  // 从表单获取规则数据
  getFormData() {
    const name = document.getElementById('input-name').value.trim();
    const pattern = document.getElementById('input-pattern').value.trim();

    return {
      name,
      domains: ['*'],  // 默认适用所有网站
      // 使用正则匹配页面文本
      conditions: [{
        field: 'text',
        operator: 'matches',
        value: pattern
      }],
      extractPattern: pattern,
      actions: {
        match: 'highlight',
        noMatch: 'none'
      },
      enabled: true
    };
  },

  // 保存规则
  async save(e) {
    e.preventDefault();

    const formData = this.getFormData();

    if (!formData.name) {
      alert('请填写规则名称');
      return;
    }

    if (!formData.extractPattern) {
      alert('请填写正则表达式');
      return;
    }

    // 验证正则是否有效
    try {
      new RegExp(formData.extractPattern);
    } catch (err) {
      alert('正则表达式无效: ' + err.message);
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

    if (!formData.extractPattern) {
      alert('请先填写正则表达式');
      return;
    }

    // 验证正则
    try {
      new RegExp(formData.extractPattern);
    } catch (err) {
      alert('正则表达式无效: ' + err.message);
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
