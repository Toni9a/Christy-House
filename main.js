const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];

function activateTab(tab, focus = false) {
  tabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  panels.forEach(panel => { panel.hidden = panel.id !== tab.getAttribute('aria-controls'); });
  if (focus) tab.focus();
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    activateTab(tabs[next], true);
  });
});

const toast = document.getElementById('toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

document.getElementById('share-button').addEventListener('click', async () => {
  if (navigator.share) {
    try { await navigator.share({ title: document.title, url: location.href }); }
    catch (error) { if (error.name !== 'AbortError') showToast('Could not open sharing.'); }
  } else if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(location.href); showToast('Link copied to clipboard'); }
    catch { showToast('Copy the page address to share it.'); }
  } else showToast('Copy the page address to share it.');
});
document.getElementById('print-button').addEventListener('click', () => window.print());
