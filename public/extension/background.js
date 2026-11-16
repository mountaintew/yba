// Toggles the Yba bar in the active tab. Injects the content script on
// demand for tabs that were open before the extension was installed.
async function toggle(tab) {
  if (!tab?.id) return;
  const msg = { type: 'yba:toggle' };
  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tab.id, msg);
    } catch (e) {
      console.warn('Yba cannot run on this page (chrome:// and store pages are blocked).', e);
    }
  }
}

chrome.action.onClicked.addListener(toggle);

chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd !== 'toggle-yba') return;
  const target = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  toggle(target);
});
