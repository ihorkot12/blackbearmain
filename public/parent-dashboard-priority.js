(() => {
  const STATS_LABELS = ['відвідуваність', 'досягнення', 'оплата', 'telegram'];
  let frame = 0;

  const isParentPage = () => window.location.pathname === '/parent' || window.location.pathname.startsWith('/parent/');
  const normalize = (value) => String(value || '').trim().toLowerCase();

  function hasAllStatsLabels(element) {
    const text = normalize(element.innerText || element.textContent);
    return STATS_LABELS.every((label) => text.includes(label));
  }

  function findStatsGrid() {
    return Array.from(document.querySelectorAll('div.grid'))
      .find((element) => element instanceof HTMLElement
        && element.querySelectorAll('button').length >= 4
        && hasAllStatsLabels(element));
  }

  function findDashboardActionSection() {
    return Array.from(document.querySelectorAll('section'))
      .find((element) => {
        const text = normalize(element.innerText || element.textContent);
        return text.includes('домашні завдання') && text.includes('методичка');
      });
  }

  function moveStatsToTop() {
    frame = 0;
    if (!isParentPage()) return;

    const statsGrid = findStatsGrid();
    const actionSection = findDashboardActionSection();
    if (!statsGrid || !actionSection) return;
    if (statsGrid.parentElement !== actionSection.parentElement) return;

    const statsAlreadyBeforeActions = Boolean(
      statsGrid.compareDocumentPosition(actionSection) & Node.DOCUMENT_POSITION_FOLLOWING
    );
    if (statsAlreadyBeforeActions) return;

    statsGrid.dataset.bbDashboardPriority = 'top';
    actionSection.parentElement?.insertBefore(statsGrid, actionSection);
  }

  function scheduleMove() {
    if (frame || !isParentPage()) return;
    frame = window.requestAnimationFrame(moveStatsToTop);
  }

  const observer = new MutationObserver(scheduleMove);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('popstate', scheduleMove);
  window.addEventListener('storage', scheduleMove);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleMove);
  } else {
    scheduleMove();
  }
})();
