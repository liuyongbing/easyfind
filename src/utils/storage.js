// storage.js - 存储工具

const EasyFindStorage = {
  // 获取所有规则
  async getRules() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['easyfind_rules'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.easyfind_rules || []);
        }
      });
    });
  },

  // 保存规则
  async saveRules(rules) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ easyfind_rules: rules }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },

  // 添加单条规则
  async addRule(rule) {
    const rules = await this.getRules();
    const normalized = this.normalizeRule(rule);
    normalized.id = normalized.id || generateId();
    normalized.createdAt = Date.now();
    normalized.updatedAt = Date.now();
    rules.push(normalized);
    await this.saveRules(rules);
    return normalized;
  },

  // 更新规则
  async updateRule(ruleId, updates) {
    const rules = await this.getRules();
    const index = rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      const normalized = this.normalizeRule({ ...rules[index], ...updates });
      normalized.updatedAt = Date.now();
      rules[index] = normalized;
      await this.saveRules(rules);
      return rules[index];
    }
    return null;
  },

  // 删除规则
  async deleteRule(ruleId) {
    const rules = await this.getRules();
    const filtered = rules.filter(r => r.id !== ruleId);
    await this.saveRules(filtered);
    return filtered.length < rules.length;
  },

  // 获取域名匹配的规则
  async getRulesForDomain(domain) {
    const rules = await this.getRules();
    return rules.filter(rule => {
      if (!rule.enabled) return false;

      // 使用 domains 数组匹配
      if (rule.domains && rule.domains.length > 0) {
        return rule.domains.some(d => {
          if (d === '*') return true;
          const pattern = d.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`, 'i');
          return regex.test(domain);
        });
      }

      // 兼容旧的 domainPattern 字段
      if (rule.domainPattern === '*') return true;
      if (rule.domainPattern) {
        const pattern = rule.domainPattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        return regex.test(domain);
      }

      return true; // 没有域名限制时匹配所有
    });
  },

  // 导入规则 (合并模式)
  async importRules(newRules) {
    const existingRules = await this.getRules();
    const existingIds = new Set(existingRules.map(r => r.id));

    // 为新规则生成 ID (避免冲突)
    const rulesToAdd = newRules.map(rule => {
      const normalized = this.normalizeRule(rule);

      // 如果 ID 已存在，生成新 ID
      if (existingIds.has(normalized.id)) {
        normalized.id = generateId();
      }

      normalized.createdAt = Date.now();
      normalized.updatedAt = Date.now();

      return normalized;
    });

    const allRules = [...existingRules, ...rulesToAdd];
    await this.saveRules(allRules);

    return rulesToAdd.length;
  },

  // 规则标准化 (确保向后兼容)
  normalizeRule(rule) {
    const normalized = { ...rule };

    // 确保 ID 存在
    if (!normalized.id) {
      normalized.id = generateId();
    }

    // 域名处理
    if (!normalized.domains && normalized.domainPattern) {
      normalized.domains = [normalized.domainPattern];
    }
    if (!normalized.domainPattern && normalized.domains?.length > 0) {
      normalized.domainPattern = normalized.domains[0];
    }
    if (!normalized.domains) {
      normalized.domains = ['*'];
    }
    if (!normalized.domainPattern) {
      normalized.domainPattern = '*';
    }

    // 选择器处理
    if (!normalized.targetSelector && normalized.selector) {
      normalized.targetSelector = normalized.selector;
    }
    if (!normalized.selector && normalized.targetSelector) {
      normalized.selector = normalized.targetSelector;
    }

    // 操作处理
    if (!normalized.actions) {
      normalized.actions = {
        match: normalized.action || 'highlight',
        noMatch: 'none'
      };
    }
    if (!normalized.action) {
      normalized.action = normalized.actions.match;
    }

    // 确保启用状态
    if (normalized.enabled === undefined) {
      normalized.enabled = true;
    }

    return normalized;
  },

  // 清除所有规则
  async clearRules() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(['easyfind_rules'], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
};

// 生成唯一 ID
function generateId() {
  return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
