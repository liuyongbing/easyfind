document.addEventListener('DOMContentLoaded', function() {
  const openBtn = document.getElementById('open-search');
  
  openBtn.addEventListener('click', async function() {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      // 向内容脚本发送消息，打开搜索框
      chrome.tabs.sendMessage(tab.id, { action: 'openSearch' }, function(response) {
        // 关闭 popup
        window.close();
      });
    }
  });
});
