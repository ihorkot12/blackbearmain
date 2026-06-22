(() => {
  if (window.__bbSmmLayoutFixInstalled) return;
  window.__bbSmmLayoutFixInstalled = true;

  const STYLE_ID = 'bb-smm-layout-fix-style';
  const PANEL_ID = 'bb-smm-local-options';
  const ADMIN_PATH_RE = /^\/admin(?:\/|$)/;

  const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const isAdminPath = () => ADMIN_PATH_RE.test(location.pathname);
  const isVisible = (node) => !!(node?.offsetWidth || node?.offsetHeight || node?.getClientRects?.().length);
  const textOf = (node) => norm(node?.innerText || node?.textContent || '');
  const isSmmPage = () => /Content OS|Black Bear Dojo AI SMM Agency/i.test(document.body?.innerText || '');

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;align-self:stretch!important;flex:0 0 100%!important;margin:24px 0!important;clear:both!important}
      #${PANEL_ID},#${PANEL_ID} *{box-sizing:border-box!important;min-width:0!important}
      #${PANEL_ID}.bb-smm-layout-fixed{position:relative!important;left:auto!important;right:auto!important;top:auto!important;transform:none!important}
      #${PANEL_ID} .bb-smm-panel-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:start!important;gap:18px!important;width:100%!important;margin-bottom:20px!important}
      #${PANEL_ID} .bb-smm-panel-head h3{font-size:clamp(22px,2.2vw,34px)!important;line-height:.98!important;letter-spacing:0!important;max-width:880px!important}
      #${PANEL_ID} .bb-smm-panel-head p{max-width:680px!important;font-size:14px!important;line-height:1.45!important;color:#a1a1aa!important}
      #${PANEL_ID} .bb-smm-close{flex:0 0 auto!important}
      #${PANEL_ID} .bb-smm-options{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))!important;gap:16px!important;width:100%!important;max-width:100%!important;align-items:stretch!important}
      #${PANEL_ID} .bb-smm-option{width:100%!important;max-width:100%!important;min-width:0!important;min-height:360px!important;padding:18px!important;border-radius:24px!important;display:flex!important;flex-direction:column!important;gap:0!important;overflow:hidden!important}
      #${PANEL_ID} .bb-smm-score{flex:0 0 auto!important;min-width:46px!important;width:max-content!important;margin-bottom:14px!important}
      #${PANEL_ID} .bb-smm-option h4{font-size:clamp(16px,1.25vw,20px)!important;line-height:1.08!important;letter-spacing:0!important;word-break:normal!important;overflow-wrap:break-word!important;hyphens:auto!important;margin:0 0 10px!important;text-wrap:balance!important}
      #${PANEL_ID} .bb-smm-option p{font-size:13px!important;line-height:1.45!important;word-break:normal!important;overflow-wrap:break-word!important}
      #${PANEL_ID} .bb-smm-option dl{display:grid!important;gap:10px!important;margin:16px 0!important;flex:1 1 auto!important}
      #${PANEL_ID} .bb-smm-option dt{font-size:10px!important;line-height:1.2!important;letter-spacing:.12em!important;white-space:normal!important}
      #${PANEL_ID} .bb-smm-option dd{font-size:13px!important;line-height:1.4!important;word-break:normal!important;overflow-wrap:break-word!important;hyphens:auto!important}
      #${PANEL_ID} .bb-smm-save{margin-top:auto!important;width:100%!important;min-height:44px!important;white-space:normal!important;line-height:1.12!important}
      @media(max-width:760px){#${PANEL_ID}{padding:18px!important;border-radius:24px!important}#${PANEL_ID} .bb-smm-panel-head{grid-template-columns:1fr auto!important}#${PANEL_ID} .bb-smm-options{grid-template-columns:1fr!important}#${PANEL_ID} .bb-smm-option{min-height:auto!important}}
    `;
    document.head.appendChild(style);
  };

  const findPageRoot = () => {
    const heading = [...document.querySelectorAll('h1,h2,h3')]
      .find((node) => /Content OS/i.test(textOf(node)));
    if (!heading) return document.querySelector('main') || document.body;

    return heading.closest('.space-y-8')
      || heading.closest('.bb-motion-page')?.querySelector('.space-y-8')
      || heading.closest('main')
      || document.querySelector('main')
      || document.body;
  };

  const findHeader = (root) => {
    return [...(root?.children || [])]
      .find((child) => /Content OS|Black Bear Dojo AI SMM Agency/i.test(textOf(child)));
  };

  const fixGeneratedPanel = () => {
    addStyles();
    if (!isAdminPath() || !isSmmPage()) return;

    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const root = findPageRoot();
    if (!root || root === panel) return;

    const header = findHeader(root);
    const targetBefore = header?.nextSibling || root.children?.[1] || null;
    const alreadyPlaced = panel.parentElement === root && panel.previousElementSibling === header;

    if (!alreadyPlaced) root.insertBefore(panel, targetBefore);
    panel.classList.add('bb-smm-layout-fixed');
  };

  const scheduleFix = (delay = 90) => window.setTimeout(fixGeneratedPanel, delay);

  document.addEventListener('click', (event) => {
    if (!isAdminPath()) return;
    const button = event.target?.closest?.('button');
    if (!button) return;
    if (/згенер|створити іде|сформувати іде/i.test(textOf(button))) {
      scheduleFix(120);
      scheduleFix(700);
      scheduleFix(1600);
    }
  }, true);

  addStyles();
  scheduleFix(250);
  window.addEventListener('pageshow', () => scheduleFix(160));
  window.addEventListener('resize', () => scheduleFix(160));
  const observer = new MutationObserver(() => scheduleFix(120));
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
