# EasyFind Chrome 插件开发

## 项目概述

EasyFind 是一个 Chrome 浏览器扩展，旨在增强网页文本搜索体验，复刻并扩展浏览器原生的 Ctrl+F 查找功能。

## 已实现功能

### 1. 基础查找功能

- **快捷键触发**：Ctrl+Shift+F 或 Cmd+Shift+F 唤出搜索框
- **实时高亮**：输入时即时高亮匹配文本
- **匹配计数**：显示当前匹配项 / 总匹配数
- **导航跳转**：支持 Enter / Shift+Enter 在匹配项之间跳转
- **关闭搜索**：ESC 键关闭搜索框并清除高亮

### 2. 增强功能

- **正则表达式支持**：点击 `.*` 按钮启用正则模式
- **预设正则表达式**：
  - B站时长(1h+)：匹配超过1小时的B站视频
  - 极客购买量(1万+)：匹配5位及以上数字
- **自定义预设**：保存常用的正则表达式
- **错误提示**：正则表达式错误时显示友好提示

### 3. UI 设计

- **悬浮搜索框**：固定在页面右上角
- **深色/浅色主题**：自动适配系统主题
- **打印友好**：打印时自动隐藏搜索框

## 技术架构

### 文件结构

```
src/
├── manifest.json        # 插件配置 (Manifest V3)
├── content.js           # 内容脚本（核心逻辑）
├── popup.html           # 弹出窗口
├── popup.js             # 弹出窗口逻辑
├── styles/
│   └── searchbox.css    # 搜索框和高亮样式
└── icons/               # 扩展图标
    ├── icon16.svg
    ├── icon48.svg
    └── icon128.svg
```

### 核心模块

#### 1. 内容脚本 (content.js)

- **键盘事件监听**：监听 Ctrl+Shift+F 打开搜索框
- **文本查找引擎**：使用 TreeWalker 遍历 DOM 文本节点
- **高亮渲染**：使用 `<mark>` 标签包裹匹配文本
- **预设管理**：默认预设 + 自定义预设（localStorage）

#### 2. 弹窗界面 (popup.html/js)

- 显示扩展信息和快捷键说明
- 提供「打开搜索框」按钮
- 显示内置预设预览

#### 3. 样式文件 (searchbox.css)

- 搜索框 UI 样式
- 高亮样式（普通匹配、当前匹配）
- 深色模式适配
- 打印媒体查询

### 技术实现

#### 1. 内容脚本注入

```json
// manifest.json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["content.js"],
  "css": ["styles/searchbox.css"],
  "run_at": "document_end"
}]
```

#### 2. 键盘快捷键配置

```json
// manifest.json
"commands": {
  "toggle-search": {
    "suggested_key": {
      "default": "Ctrl+Shift+F",
      "mac": "Command+Shift+F"
    },
    "description": "打开/关闭搜索框"
  }
}
```

#### 3. 文本高亮实现

```javascript
// 使用 Range API 精确高亮
function highlightMatch(match) {
  const range = document.createRange();
  range.setStart(match.node, match.startOffset);
  range.setEnd(match.node, match.endOffset);
  
  const mark = document.createElement('mark');
  mark.className = 'easyfind-highlight';
  range.surroundContents(mark);
}
```

#### 4. 文本查找引擎

```javascript
// 使用 TreeWalker 遍历文本节点
function findMatches(keyword) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  // 正则模式或普通文本匹配
  // ...
}
```

## 开发进度

### 已完成

- [x] 创建插件基础结构 (Manifest V3)
- [x] 实现 Ctrl+Shift+F 唤出搜索框
- [x] 实现基础文本查找与高亮
- [x] 实现匹配导航
- [x] 添加正则表达式支持
- [x] 添加预设正则表达式功能
- [x] 深色/浅色主题适配
- [x] 弹窗界面设计

### 待开发

- [ ] 大小写敏感切换
- [ ] 全字匹配选项
- [ ] 搜索历史
- [ ] 支持 iframe 搜索
- [ ] 性能优化（大数据量页面）

## 注意事项

1. **性能考虑**：大型页面搜索时使用 TreeWalker 高效遍历
2. **兼容性**：跳过脚本、样式和搜索框内的文本
3. **隐私安全**：自定义预设仅存储在本地 localStorage
4. **无障碍支持**：支持键盘导航
