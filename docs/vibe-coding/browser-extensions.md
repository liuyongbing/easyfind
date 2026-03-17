# 易寻 (EasyFind)

> 轻松找到你要的内容 | Find what you need, easily

## 命名寓意

**中文名 - 易寻**：易，容易；寻，寻找。简洁文雅，传达"轻松找到所需"的核心理念。

**英文名 - EasyFind**：与中文名完美对应，Easy = 易，Find = 寻。

## 📋 项目概述

### 背景
在日常浏览网页时，经常需要根据特定条件筛选内容：
- 在 B站找出时长超过 100 小时的视频教程
- 在极客时间找出下载量超过 10 万的课程
- 在 Docker Hub 找出下载量超过 1 万的镜像

目前这些筛选需要人眼扫描，效率低下。

### 目标
开发一款 Chrome/Edge 浏览器插件，支持：
1. 自定义正则表达式匹配页面内容
2. 数值条件判断（大于、小于、等于等）
3. 对匹配/不匹配的元素进行高亮或隐藏
4. 为常用网站提供预设规则模板

---

## 🎯 功能需求

### 核心功能

| 功能模块 | 描述 | 优先级 |
|---------|------|--------|
| 规则管理 | 创建、编辑、删除、导入/导出筛选规则 | P0 |
| 页面筛选 | 根据规则在页面上执行筛选操作 | P0 |
| 高亮/隐藏 | 对匹配的元素进行视觉标记或隐藏不匹配项 | P0 |
| 预设模板 | 提供常用网站的预配置规则 | P1 |
| 规则同步 | 同步规则到云端或本地存储 | P2 |

### 规则配置项

```yaml
规则结构:
  - 规则名称: "B站时长筛选"
  - 适用域名: ["search.bilibili.com", "www.bilibili.com"]
  - 目标选择器: ".bili-video-card"  # 要筛选的容器元素
  - 数据选择器: ".duration"          # 包含数据的子元素（可选）
  - 匹配正则: "(\d+):(\d{2}):(\d{2})"  # 提取数据的正则
  - 提取模式: "group"  # group(分组提取) | whole(整体匹配)
  - 条件表达式:
      - 字段: "hours"      # 从正则分组提取
      - 操作符: ">="
      - 值: 100
  - 操作:
      - 匹配时: "highlight"  # highlight(高亮) | none(无操作)
      - 不匹配时: "hide"     # hide(隐藏) | dim(变暗) | none
  - 启用状态: true
```

### 支持的条件操作符

| 操作符 | 描述 | 示例 |
|-------|------|------|
| `>` | 大于 | hours > 10 |
| `>=` | 大于等于 | downloads >= 10 |
| `<` | 小于 | price < 100 |
| `<=` | 小于等于 | rating <= 4.5 |
| `==` | 等于 | count == 100 |
| `!=` | 不等于 | status != "closed" |
| `contains` | 包含 | title contains "Java" |
| `matches` | 正则匹配 | tag matches "vip|pro" |

---

## 🏗️ 技术架构

### 技术栈

```
┌─────────────────────────────────────────┐
│           浏览器扩展 (Manifest V3)        │
├─────────────────────────────────────────┤
│  Popup UI    │  Content Script  │  Background  │
│  (原生JS)    │  (DOM操作+筛选)   │  (Service Worker)  │
├─────────────────────────────────────────┤
│              Chrome Extension APIs       │
│  storage | tabs | runtime | scripting   │
└─────────────────────────────────────────┘
```

### 文件结构

```
easyfind/
├── manifest.json           # 扩展配置文件
├── popup/                  # 弹窗界面
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/                # 内容脚本
│   ├── content.js          # 主逻辑
│   ├── filter.js           # 筛选引擎
│   ├── highlight.js        # 高亮处理
│   └── content.css         # 样式
├── background/             # 后台脚本
│   └── service-worker.js
├── icons/                  # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── presets/                # 预设规则
│   ├── bilibili.json
│   ├── geekbang.json
│   ├── dockerhub.json
│   └── maven.json
└── utils/                  # 工具函数
    ├── storage.js          # 存储操作
    └── matcher.js          # 正则匹配工具
```

---

## 📐 模块设计

### 1. 规则管理模块 (RuleManager)

**职责**：管理筛选规则的 CRUD 操作

```javascript
class RuleManager {
  // 获取所有规则
  async getAllRules()

  // 根据域名获取适用规则
  async getRulesForDomain(domain)

  // 添加规则
  async addRule(rule)

  // 更新规则
  async updateRule(ruleId, rule)

  // 删除规则
  async deleteRule(ruleId)

  // 导入规则
  async importRules(rulesJson)

  // 导出规则
  async exportRules()
}
```

### 2. 筛选引擎模块 (FilterEngine)

**职责**：执行页面内容筛选

```javascript
class FilterEngine {
  constructor(ruleManager)

  // 对页面应用规则
  async applyRules(rules)

  // 对单个元素应用规则
  applyRuleToElement(element, rule)

  // 提取元素中的数据
  extractData(element, rule)

  // 评估条件表达式
  evaluateCondition(data, condition)

  // 执行操作（高亮/隐藏）
  executeAction(element, action)
}
```

### 3. DOM 监听模块 (DOMWatcher)

**职责**：监听页面 DOM 变化，处理动态加载内容

```javascript
class DOMWatcher {
  constructor(filterEngine)

  // 开始监听
  startWatching(selector)

  // 停止监听
  stopWatching()

  // 处理新增节点
  handleMutations(mutations)
}
```

### 4. UI 模块 (PopupUI)

**职责**：管理扩展弹窗界面

```javascript
class PopupUI {
  // 初始化界面
  init()

  // 渲染规则列表
  renderRuleList(rules)

  // 显示规则编辑表单
  showRuleEditor(rule)

  // 显示/隐藏加载状态
  toggleLoading(show)
}
```

---

## 🔄 工作流程

### 筛选流程

```
┌──────────────────────────────────────────────────────────┐
│                      筛选执行流程                          │
└──────────────────────────────────────────────────────────┘

用户访问网页
     │
     ▼
Content Script 加载
     │
     ▼
获取当前域名 ──────► 查询匹配的规则
     │
     ▼
遍历目标元素 ◄─────── 应用每个规则
     │
     ├──► 提取数据 (正则匹配)
     │         │
     │         ▼
     │    解析数值/文本
     │         │
     │         ▼
     │    评估条件表达式
     │         │
     │         ├──► 条件满足 ──► 执行匹配操作 (高亮)
     │         │
     │         └──► 条件不满足 ──► 执行不匹配操作 (隐藏/变暗)
     │
     ▼
启动 DOM 监听 (处理动态内容)
     │
     ▼
完成筛选
```

### 规则配置流程

```
┌──────────────────────────────────────────────────────────┐
│                    规则配置流程                            │
└──────────────────────────────────────────────────────────┘

用户点击插件图标
     │
     ▼
打开 Popup 界面
     │
     ├──► 查看规则列表
     │         │
     │         ├──► 启用/禁用规则
     │         ├──► 编辑规则
     │         └──► 删除规则
     │
     ├──► 创建新规则
     │         │
     │         ├──► 输入规则名称
     │         ├──► 选择/输入域名
     │         ├──► 配置选择器
     │         ├──► 配置正则表达式
     │         ├──► 配置条件表达式
     │         └──► 选择操作类型
     │
     └──► 导入/导出规则
```

---

## 🎨 UI 设计

### Popup 界面布局

```
┌─────────────────────────────────────┐
│  🔍 易寻 EasyFind                    │
│     轻松找到你要的内容               │
├─────────────────────────────────────┤
│  当前网站: search.bilibili.com      │
├─────────────────────────────────────┤
│  筛选规则                            │
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │ ✅ 筛选视频教程         [编辑]  ││
│  │    视频|教程|课程               ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ ✅ 筛选高下载量         [编辑]  ││
│  │    [0-9]+万                     ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  [      + 新建规则      ]           │
└─────────────────────────────────────┘
```

### 规则编辑界面 (简化版)

```
┌─────────────────────────────────────┐
│  ← 返回    新建规则                  │
├─────────────────────────────────────┤
│  规则名称 *                          │
│  ┌─────────────────────────────────┐│
│  │ 筛选视频教程                    ││
│  └─────────────────────────────────┘│
│                                     │
│  正则表达式 *                        │
│  ┌─────────────────────────────────┐│
│  │ 视频|教程|课程                  ││
│  └─────────────────────────────────┘│
│  匹配的文本将被高亮显示              │
│                                     │
├─────────────────────────────────────┤
│  [测试]  [取消]           [保存]    │
└─────────────────────────────────────┘
```

---

## 📦 预设规则模板

### B站时长筛选

```json
{
  "name": "B站时长筛选",
  "domains": ["search.bilibili.com", "www.bilibili.com"],
  "targetSelector": ".bili-video-card",
  "dataSelector": ".bili-video-card__info--duration",
  "pattern": "^(?:(\\d+):)?(\\d{2}):(\\d{2})$",
  "extractMode": "group",
  "conditions": [
    {
      "group": 1,
      "defaultValue": 0,
      "operator": ">=",
      "value": 100
    }
  ],
  "actions": {
    "match": "highlight",
    "noMatch": "dim"
  },
  "enabled": true
}
```

### 极客时间下载量筛选

```json
{
  "name": "极客时间下载量筛选",
  "domains": ["time.geekbang.org"],
  "targetSelector": ".resource-item",
  "dataSelector": ".download-count",
  "pattern": "已下载\\s*([\\d.]+)万",
  "extractMode": "group",
  "conditions": [
    {
      "group": 1,
      "operator": ">=",
      "value": 10
    }
  ],
  "actions": {
    "match": "highlight",
    "noMatch": "hide"
  },
  "enabled": true
}
```

### Docker Hub 下载量筛选

```json
{
  "name": "Docker Hub下载量筛选",
  "domains": ["hub.docker.com"],
  "targetSelector": "[data-testid='repositoryCard']",
  "dataSelector": "[data-testid='pullCount']",
  "pattern": "([\\d.]+)\\s*(K|M|B)?",
  "extractMode": "group",
  "conditions": [
    {
      "group": 1,
      "group2": 2,
      "operator": ">=",
      "value": 10000,
      "unitMapping": {"K": 1000, "M": 1000000, "B": 1000000000, "null": 1}
    }
  ],
  "actions": {
    "match": "highlight",
    "noMatch": "dim"
  },
  "enabled": true
}
```

---

## 🔧 开发计划

### Phase 1: 基础框架 (1天)

- [ ] 创建 manifest.json
- [ ] 搭建基础文件结构
- [ ] 实现 Popup 基础 UI
- [ ] 实现 Content Script 基础框架
- [ ] 实现存储工具类

### Phase 2: 规则管理 (1天)

- [ ] 实现规则 CRUD 操作
- [ ] 实现规则导入/导出
- [ ] 实现预设规则加载
- [ ] 完成规则编辑 UI

### Phase 3: 筛选引擎 (1.5天)

- [ ] 实现正则匹配逻辑
- [ ] 实现条件表达式解析
- [ ] 实现数值比较逻辑
- [ ] 实现高亮/隐藏操作

### Phase 4: DOM 处理 (1天)

- [ ] 实现 MutationObserver 监听
- [ ] 处理动态加载内容
- [ ] 优化性能（节流、防抖）

### Phase 5: 测试与优化 (0.5天)

- [ ] 多网站兼容性测试
- [ ] 性能优化
- [ ] Bug 修复

---

## 📝 注意事项

### 性能优化

1. **节流处理**：DOM 监听使用节流，避免频繁触发
2. **选择器优化**：使用高效的 CSS 选择器
3. **懒加载**：只处理可见区域的元素
4. **缓存机制**：缓存已处理的元素，避免重复处理

### 兼容性

1. **Manifest V3**：使用最新的 Chrome 扩展规范
2. **跨浏览器**：兼容 Chrome 和 Edge
3. **动态内容**：支持 SPA 应用的路由切换

### 安全性

1. **正则安全**：防止 ReDoS 攻击
2. **XSS 防护**：避免注入恶意代码
3. **数据隔离**：规则数据存储在扩展沙箱中

---

## 🚀 后续扩展

- [ ] 支持更多条件类型（日期、布尔值等）
- [ ] 支持自定义高亮样式
- [ ] 支持规则分享社区
- [ ] 支持 AI 辅助规则生成
- [ ] 支持 Firefox 浏览器
