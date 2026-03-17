# 易寻 EasyFind

根据正则表达式和数值条件筛选网页内容的 Chrome/Edge 浏览器扩展。

## 安装

### 开发者模式安装

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `easyfind` 目录
5. 扩展图标将出现在工具栏

## 使用方法

1. 点击浏览器工具栏中的扩展图标
2. 弹窗显示当前网站域名
3. 点击「新建规则」创建筛选规则
4. 支持导入/导出规则配置

## 功能特性

### 规则管理
- 创建、编辑、删除、导入/导出筛选规则
- 完整的规则编辑界面，支持高级设置
- 域名匹配（支持通配符）

### 筛选引擎
- 正则表达式匹配
- 数值条件判断（大于、小于、等于等）
- 单位自动转换（K、M、万、亿）
- 多条件组合（AND/OR）

### 条件操作符
- 包含 / 不包含
- 匹配正则 / 不匹配正则
- 大于 / 大于等于 / 小于 / 小于等于
- 等于 / 不等于
- 为空 / 不为空

### 多种操作
- 高亮 - 绿色边框高亮显示
- 淡化 - 降低透明度
- 隐藏 - 完全隐藏元素

### DOM 处理
- MutationObserver 智能监听
- 动态内容自动处理（AJAX、SPA）
- 节流防抖优化
- 元素缓存避免重复处理
- 选择器缓存提升性能
- 支持 SPA 路由切换

## 目录结构

```
easyfind/
├── manifest.json           # 扩展配置
├── src/
│   ├── popup/              # 弹窗界面
│   │   ├── popup.html
│   │   ├── popup.js
│   │   ├── popup.css
│   │   └── editor.js       # 规则编辑器
│   ├── content/            # 内容脚本
│   │   ├── content.js      # 主逻辑
│   │   ├── filter-engine.js # 筛选引擎
│   │   ├── element-cache.js # 元素缓存
│   │   ├── dom-watcher.js  # DOM 监听器
│   │   ├── performance-monitor.js # 性能监控
│   │   └── content.css     # 筛选样式
│   ├── background/         # 后台服务
│   │   └── service-worker.js
│   ├── utils/              # 工具函数
│   │   └── storage.js
│   ├── presets/            # 预设规则
│   │   └── default-rules.json
│   └── icons/              # 扩展图标
└── scripts/                # 工具脚本
    ├── generate-icons.html
    ├── generate-icons.js
    └── generate-icons-pure.js
```

## 规则示例

### 示例 1: 筛选高价商品
```json
{
  "name": "筛选 100 元以上商品",
  "domains": ["*.taobao.com"],
  "targetSelector": ".item",
  "dataSelector": ".price",
  "conditions": [{
    "operator": ">=",
    "value": "100"
  }],
  "actions": { "match": "highlight", "noMatch": "dim" }
}
```

### 示例 2: 筛选长视频
```json
{
  "name": "筛选 1 小时以上视频",
  "domains": ["*.bilibili.com"],
  "targetSelector": ".bili-video-card",
  "dataSelector": ".duration",
  "extractPattern": "(\\d+):(\\d{2}):(\\d{2})",
  "conditions": [{
    "groupIndex": 1,
    "operator": ">=",
    "value": "1"
  }],
  "actions": { "match": "highlight", "noMatch": "none" }
}
```

### 示例 3: 隐藏广告
```json
{
  "name": "隐藏广告",
  "domains": ["*"],
  "targetSelector": "[class*='ad-'], [id*='ad-'], .advertisement",
  "actions": { "match": "hide", "noMatch": "none" }
}
```

## 性能优化

### 节流处理
DOM 变化使用 300ms 节流，避免频繁触发。

### 元素缓存
- WeakSet 自动垃圾回收
- 内容哈希检测变化
- 避免重复处理

### 选择器缓存
- LRU 淘汰策略
- 5 秒 TTL 过期
- 最大 100 条缓存

### 批量处理
每批最多 50 个元素，使用 requestAnimationFrame 调度。

## 开发

### 重新生成图标

```bash
node scripts/generate-icons-pure.js
```

或在浏览器中打开 `scripts/generate-icons.html` 手动生成。

## 测试

### 测试页面

在浏览器中打开 `tests/test-runner.html` 进行功能测试。

测试覆盖：
- 商品价格筛选
- 视频时长筛选
- 文章关键词筛选
- 广告元素隐藏
- 数值单位转换
- 动态内容处理

### 控制台调试

```javascript
// 获取当前状态
chrome.runtime.sendMessage({ action: 'getStats' }, console.log);

// 获取性能报告
chrome.runtime.sendMessage({ action: 'getPerformance' }, console.log);

// 启用调试模式
chrome.runtime.sendMessage({ action: 'enableDebug' }, console.log);

// 清除所有效果
chrome.runtime.sendMessage({ action: 'clearEffects' }, console.log);
```

### 性能监控

扩展内置性能监控模块，可追踪：
- 规则处理时间
- DOM 处理时间
- 缓存命中率
- 内存使用

## 许可证

MIT License
