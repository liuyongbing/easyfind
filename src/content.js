(function() {
  'use strict';

  // 全局状态
  let searchBox = null;
  let isSearchBoxVisible = false;
  let currentKeyword = '';
  let matches = [];
  let currentMatchIndex = -1;
  let highlightClassName = 'easyfind-highlight';
  let currentClassName = 'easyfind-highlight-current';
  let isRegexMode = false;  // 是否启用正则模式
  let regexError = null;    // 正则错误信息
  let isPresetDropdownVisible = false; // 预设下拉菜单是否可见

  // 默认预设正则表达式
  const defaultPresets = [
    { id: 'bilibili-duration', name: 'B站时长(1h+)', pattern: '[1-9]\\d*:\\d{2}:\\d{2}', description: '匹配B站视频时长超过1小时' },
    { id: 'geek-buy-count', name: '极客购买量(1万+)', pattern: '\\d{5,}', description: '匹配5位及以上数字（如购买量）' }
  ];

  // 用户自定义预设
  let customPresets = [];

  // 初始化
  function init() {
    // 监听键盘事件
    document.addEventListener('keydown', handleKeyDown, true);
    
    // 监听来自 popup 的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === 'openSearch') {
        showSearchBox();
        sendResponse({ success: true });
      }
      return true;
    });
  }

  // 键盘事件处理
  function handleKeyDown(e) {
    // Ctrl+Shift+F 或 Cmd+Shift+F 打开搜索框
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      e.stopPropagation();
      toggleSearchBox();
      return;
    }

    // ESC 关闭搜索框
    if (e.key === 'Escape' && isSearchBoxVisible) {
      hideSearchBox();
      return;
    }

    // Enter 导航到下一个匹配项
    if (e.key === 'Enter' && isSearchBoxVisible) {
      e.preventDefault();
      if (e.shiftKey) {
        navigateToPrevious();
      } else {
        navigateToNext();
      }
      return;
    }
  }

  // 切换搜索框显示/隐藏
  function toggleSearchBox() {
    if (isSearchBoxVisible) {
      hideSearchBox();
    } else {
      showSearchBox();
    }
  }

  // 显示搜索框
  function showSearchBox() {
    if (!searchBox) {
      createSearchBox();
    }
    searchBox.style.display = 'block';
    isSearchBoxVisible = true;
    
    // 聚焦到搜索输入框
    const input = searchBox.querySelector('#easyfind-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  // 隐藏搜索框
  function hideSearchBox() {
    if (searchBox) {
      searchBox.style.display = 'none';
    }
    isSearchBoxVisible = false;
    clearHighlights();
  }

  // 创建搜索框 UI
  function createSearchBox() {
    searchBox = document.createElement('div');
    searchBox.id = 'easyfind-searchbox';
    searchBox.innerHTML = `
      <div class="easyfind-container">
        <div class="easyfind-input-wrapper">
          <input type="text" id="easyfind-input" placeholder="搜索页面内容..." autocomplete="off">
          <button id="easyfind-preset-btn" title="预设正则">⚡</button>
        </div>
        <span id="easyfind-counter">0/0</span>
        <button id="easyfind-prev" title="上一个 (Shift+Enter)">↑</button>
        <button id="easyfind-next" title="下一个 (Enter)">↓</button>
        <button id="easyfind-regex" title="正则表达式">.*</button>
        <button id="easyfind-close" title="关闭 (ESC)">×</button>
      </div>
      <div id="easyfind-error" class="easyfind-error"></div>
      <div id="easyfind-preset-dropdown" class="easyfind-preset-dropdown" style="display: none;">
        <div class="preset-section">
          <div class="preset-title">默认预设</div>
          <div class="preset-list" id="default-preset-list"></div>
        </div>
        <div class="preset-section" id="custom-preset-section" style="display: none;">
          <div class="preset-title">我的预设</div>
          <div class="preset-list" id="custom-preset-list"></div>
        </div>
        <div class="preset-actions">
          <button id="save-current-preset" class="preset-save-btn">保存当前正则</button>
        </div>
      </div>
    `;

    document.body.appendChild(searchBox);

    // 绑定事件
    const input = searchBox.querySelector('#easyfind-input');
    const prevBtn = searchBox.querySelector('#easyfind-prev');
    const nextBtn = searchBox.querySelector('#easyfind-next');
    const closeBtn = searchBox.querySelector('#easyfind-close');
    const regexBtn = searchBox.querySelector('#easyfind-regex');
    const presetBtn = searchBox.querySelector('#easyfind-preset-btn');
    const presetDropdown = searchBox.querySelector('#easyfind-preset-dropdown');
    const savePresetBtn = searchBox.querySelector('#save-current-preset');

    // 输入事件 - 实时搜索
    input.addEventListener('input', function(e) {
      const keyword = e.target.value;
      if (keyword !== currentKeyword) {
        currentKeyword = keyword;
        performSearch(keyword);
      }
    });

    // 按钮事件
    prevBtn.addEventListener('click', navigateToPrevious);
    nextBtn.addEventListener('click', navigateToNext);
    closeBtn.addEventListener('click', hideSearchBox);
    
    // 正则切换按钮
    regexBtn.addEventListener('click', function() {
      isRegexMode = !isRegexMode;
      regexBtn.classList.toggle('active', isRegexMode);
      performSearch(currentKeyword);
    });

    // 预设按钮 - 切换下拉菜单
    presetBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      togglePresetDropdown();
    });

    // 保存当前预设
    savePresetBtn.addEventListener('click', function() {
      saveCurrentPreset();
    });

    // 点击外部关闭下拉菜单
    document.addEventListener('click', function(e) {
      if (isPresetDropdownVisible && !presetDropdown.contains(e.target) && e.target !== presetBtn) {
        hidePresetDropdown();
      }
    });

    // 阻止搜索框内部事件冒泡
    searchBox.addEventListener('keydown', function(e) {
      e.stopPropagation();
    });

    searchBox.addEventListener('keyup', function(e) {
      e.stopPropagation();
    });

    // 加载并渲染预设列表
    loadPresets();
    renderPresetList();
  }

  // 切换预设下拉菜单
  function togglePresetDropdown() {
    const dropdown = searchBox.querySelector('#easyfind-preset-dropdown');
    isPresetDropdownVisible = !isPresetDropdownVisible;
    dropdown.style.display = isPresetDropdownVisible ? 'block' : 'none';
    
    if (isPresetDropdownVisible) {
      renderPresetList();
    }
  }

  // 隐藏预设下拉菜单
  function hidePresetDropdown() {
    const dropdown = searchBox.querySelector('#easyfind-preset-dropdown');
    isPresetDropdownVisible = false;
    dropdown.style.display = 'none';
  }

  // 加载预设（从本地存储）
  function loadPresets() {
    try {
      const stored = localStorage.getItem('easyfind-custom-presets');
      if (stored) {
        customPresets = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('EasyFind: 无法加载自定义预设', e);
      customPresets = [];
    }
  }

  // 保存预设到本地存储
  function savePresets() {
    try {
      localStorage.setItem('easyfind-custom-presets', JSON.stringify(customPresets));
    } catch (e) {
      console.warn('EasyFind: 无法保存自定义预设', e);
    }
  }

  // 渲染预设列表
  function renderPresetList() {
    const defaultList = searchBox.querySelector('#default-preset-list');
    const customList = searchBox.querySelector('#custom-preset-list');
    const customSection = searchBox.querySelector('#custom-preset-section');

    // 渲染默认预设
    defaultList.innerHTML = defaultPresets.map(preset => `
      <div class="preset-item" data-preset-id="${preset.id}" data-preset-type="default">
        <div class="preset-name">${preset.name}</div>
        <div class="preset-pattern">${preset.pattern}</div>
        <div class="preset-desc">${preset.description}</div>
      </div>
    `).join('');

    // 渲染自定义预设
    if (customPresets.length > 0) {
      customSection.style.display = 'block';
      customList.innerHTML = customPresets.map((preset, index) => `
        <div class="preset-item" data-preset-index="${index}" data-preset-type="custom">
          <div class="preset-name">${preset.name}</div>
          <div class="preset-pattern">${preset.pattern}</div>
          <button class="preset-delete" data-index="${index}" title="删除">×</button>
        </div>
      `).join('');

      // 绑定删除事件
      customList.querySelectorAll('.preset-delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          const index = parseInt(this.dataset.index);
          deletePreset(index);
        });
      });
    } else {
      customSection.style.display = 'none';
    }

    // 绑定预设点击事件
    defaultList.querySelectorAll('.preset-item').forEach(item => {
      item.addEventListener('click', function() {
        const id = this.dataset.presetId;
        applyPreset(id, 'default');
      });
    });

    customList.querySelectorAll('.preset-item').forEach(item => {
      item.addEventListener('click', function(e) {
        if (e.target.classList.contains('preset-delete')) return;
        const index = parseInt(this.dataset.presetIndex);
        applyPreset(index, 'custom');
      });
    });
  }

  // 应用预设
  function applyPreset(idOrIndex, type) {
    let preset;
    if (type === 'default') {
      preset = defaultPresets.find(p => p.id === idOrIndex);
    } else {
      preset = customPresets[idOrIndex];
    }

    if (preset) {
      const input = searchBox.querySelector('#easyfind-input');
      input.value = preset.pattern;
      currentKeyword = preset.pattern;
      
      // 自动启用正则模式
      if (!isRegexMode) {
        isRegexMode = true;
        const regexBtn = searchBox.querySelector('#easyfind-regex');
        regexBtn.classList.add('active');
      }
      
      performSearch(preset.pattern);
      hidePresetDropdown();
    }
  }

  // 保存当前为正则预设
  function saveCurrentPreset() {
    const pattern = currentKeyword.trim();
    if (!pattern) {
      showError('请先输入正则表达式');
      return;
    }

    if (!isRegexMode) {
      showError('请先启用正则模式');
      return;
    }

    const name = prompt('为此预设命名：', '我的预设');
    if (name && name.trim()) {
      const preset = {
        id: 'custom-' + Date.now(),
        name: name.trim(),
        pattern: pattern,
        description: '自定义预设'
      };
      
      customPresets.push(preset);
      savePresets();
      renderPresetList();
      
      // 显示保存成功提示
      const saveBtn = searchBox.querySelector('#save-current-preset');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = '✓ 已保存';
      saveBtn.style.background = '#10b981';
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = '';
      }, 1500);
    }
  }

  // 删除预设
  function deletePreset(index) {
    if (confirm('确定要删除这个预设吗？')) {
      customPresets.splice(index, 1);
      savePresets();
      renderPresetList();
    }
  }

  // 执行搜索
  function performSearch(keyword) {
    // 清除之前的高亮和错误
    clearHighlights();
    clearError();

    if (!keyword) {
      updateCounter();
      return;
    }

    // 查找所有匹配项
    try {
      matches = findMatches(keyword);
      currentMatchIndex = matches.length > 0 ? 0 : -1;
      regexError = null;

      // 高亮匹配项
      highlightMatches();

      // 更新计数器
      updateCounter();

      // 滚动到第一个匹配项
      if (currentMatchIndex >= 0) {
        scrollToMatch(currentMatchIndex);
      }
    } catch (e) {
      // 正则表达式错误
      regexError = e.message;
      showError('正则错误: ' + regexError);
      matches = [];
      currentMatchIndex = -1;
      updateCounter();
    }
  }

  // 显示错误信息
  function showError(message) {
    const errorDiv = searchBox.querySelector('#easyfind-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  // 清除错误信息
  function clearError() {
    const errorDiv = searchBox.querySelector('#easyfind-error');
    if (errorDiv) {
      errorDiv.textContent = '';
      errorDiv.style.display = 'none';
    }
  }

  // 查找匹配项
  function findMatches(keyword) {
    const results = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let regex = null;
    
    // 如果启用正则模式，编译正则表达式
    if (isRegexMode && keyword) {
      try {
        // 默认使用全局模式
        regex = new RegExp(keyword, 'g');
      } catch (e) {
        throw e;
      }
    }

    const lowerKeyword = isRegexMode ? null : keyword.toLowerCase();
    let node;

    while (node = walker.nextNode()) {
      // 跳过脚本和样式标签内的文本
      const parent = node.parentElement;
      if (parent && (parent.tagName === 'SCRIPT' || 
                     parent.tagName === 'STYLE' || 
                     parent.tagName === 'NOSCRIPT' ||
                     parent.id === 'easyfind-searchbox' ||
                     parent.closest('#easyfind-searchbox'))) {
        continue;
      }

      const text = node.textContent;

      if (isRegexMode && regex) {
        // 正则模式匹配
        let match;
        regex.lastIndex = 0; // 重置正则索引
        while ((match = regex.exec(text)) !== null) {
          results.push({
            node: node,
            startOffset: match.index,
            endOffset: match.index + match[0].length,
            matchText: match[0]
          });
          // 防止零宽匹配导致无限循环
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      } else {
        // 普通文本匹配
        const lowerText = text.toLowerCase();
        let index = lowerText.indexOf(lowerKeyword);

        while (index !== -1) {
          results.push({
            node: node,
            startOffset: index,
            endOffset: index + keyword.length,
            matchText: text.substring(index, index + keyword.length)
          });
          index = lowerText.indexOf(lowerKeyword, index + 1);
        }
      }
    }

    return results;
  }

  // 高亮匹配项
  function highlightMatches() {
    // 按节点分组匹配项
    const nodeMatches = new Map();
    
    matches.forEach((match, index) => {
      if (!nodeMatches.has(match.node)) {
        nodeMatches.set(match.node, []);
      }
      nodeMatches.get(match.node).push({ ...match, globalIndex: index });
    });

    // 处理每个节点的匹配项
    nodeMatches.forEach((nodeMatchList, node) => {
      // 按偏移量排序（从后往前处理，避免位置变化）
      nodeMatchList.sort((a, b) => b.startOffset - a.startOffset);
      
      nodeMatchList.forEach(match => {
        highlightMatch(match);
      });
    });
  }

  // 高亮单个匹配项
  function highlightMatch(match) {
    const range = document.createRange();
    range.setStart(match.node, match.startOffset);
    range.setEnd(match.node, match.endOffset);

    const mark = document.createElement('mark');
    mark.className = highlightClassName;
    mark.dataset.matchIndex = match.globalIndex;
    
    try {
      range.surroundContents(mark);
    } catch (e) {
      // 如果无法 surround（跨越多个元素），则跳过
      console.warn('EasyFind: 无法高亮某些文本', e);
    }
  }

  // 清除所有高亮
  function clearHighlights() {
    // 移除当前高亮样式
    const currentMarks = document.querySelectorAll('.' + currentClassName);
    currentMarks.forEach(mark => {
      mark.classList.remove(currentClassName);
    });

    // 移除所有高亮标记
    const marks = document.querySelectorAll('.' + highlightClassName);
    marks.forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      }
    });

    matches = [];
    currentMatchIndex = -1;
  }

  // 更新计数器显示
  function updateCounter() {
    const counter = searchBox.querySelector('#easyfind-counter');
    if (matches.length === 0) {
      counter.textContent = '0/0';
    } else {
      counter.textContent = `${currentMatchIndex + 1}/${matches.length}`;
    }
  }

  // 导航到下一个匹配项
  function navigateToNext() {
    if (matches.length === 0) return;
    
    currentMatchIndex = (currentMatchIndex + 1) % matches.length;
    scrollToMatch(currentMatchIndex);
    updateCounter();
  }

  // 导航到上一个匹配项
  function navigateToPrevious() {
    if (matches.length === 0) return;
    
    currentMatchIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
    scrollToMatch(currentMatchIndex);
    updateCounter();
  }

  // 滚动到指定匹配项
  function scrollToMatch(index) {
    // 移除之前的高亮
    const prevCurrent = document.querySelector('.' + currentClassName);
    if (prevCurrent) {
      prevCurrent.classList.remove(currentClassName);
    }

    // 添加当前高亮
    const mark = document.querySelector(`mark[data-match-index="${index}"]`);
    if (mark) {
      mark.classList.add(currentClassName);
      mark.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }

  // 启动
  init();
})();
