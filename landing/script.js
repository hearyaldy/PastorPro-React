(() => {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const configured = String(window.PASTORPRO_WEBAPP_URL || '').trim();
  let appUrl = '';
  if (configured) {
    try { const url = new URL(configured); if (url.protocol === 'https:' || (local && url.protocol === 'http:')) appUrl = url.href; } catch {}
  } else if (local) appUrl = `${location.origin}/`;
  const dialog = document.getElementById('webapp-dialog');
  document.querySelectorAll('.webapp-link').forEach(link => {
    if (appUrl) link.href = appUrl;
    else link.addEventListener('click', event => { event.preventDefault(); dialog.showModal(); });
  });
  document.querySelectorAll('.dialog-close, .dialog-done').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function activate(tab, focus) {
    tabs.forEach(item => { const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; document.getElementById(item.getAttribute('aria-controls')).hidden = !selected; });
    if (focus) tab.focus();
  }
  tabs.forEach(tab => {
    tab.addEventListener('click', () => activate(tab, false));
    tab.addEventListener('keydown', event => {
      let index = tabs.indexOf(tab);
      if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else return;
      event.preventDefault(); activate(tabs[index], true);
    });
  });
  document.getElementById('privacy-link').addEventListener('click', () => { document.getElementById('privacy').open = true; });
  document.getElementById('year').textContent = String(new Date().getFullYear());
})();
