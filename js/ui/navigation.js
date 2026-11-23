(function (Nexora) {
  'use strict';

  const MENU_ITEMS = [
    { id: 'virtual-office', label: 'Virtual Office', icon: '🏢', phase: 'Fase 1 • Aktif' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊', phase: 'Fase 1–2 • Aktif' },
    { id: 'employees', label: 'Employees', icon: '🤖', phase: 'Fase 1 • Aktif' },
    { id: 'trend-research', label: 'Trend Research', icon: '🔍', phase: 'Fase 3 • Aktif' },
    { id: 'idea-bank', label: 'Idea Bank', icon: '💡', phase: 'Fase 3 • Aktif' },
    { id: 'script-management', label: 'Script Management', icon: '📝', phase: 'Fase 4 • Aktif' },
    { id: 'video-production', label: 'Video Production', icon: '🎬', phase: 'Fase 5' },
    { id: 'quality-control', label: 'Quality Control', icon: '✅', phase: 'Fase 5' },
    { id: 'content-calendar', label: 'Content Calendar', icon: '📅', phase: 'Fase 4 • Aktif' },
    { id: 'analytics', label: 'Analytics', icon: '📈', phase: 'Fase 6' },
    { id: 'settings', label: 'Settings', icon: '⚙️', phase: 'Fase 2–3 • Aktif' }
  ];

  const ACTIVE_PAGES = new Set([
    'virtual-office',
    'dashboard',
    'employees',
    'trend-research',
    'idea-bank',
    'script-management',
    'content-calendar',
    'settings'
  ]);

  let currentPage = 'virtual-office';

  function openDrawer() {
    const drawer = document.getElementById('nav-drawer');
    document.getElementById('nav-drawer-backdrop').classList.remove('hidden');
    drawer.classList.remove('-translate-x-full');
    drawer.setAttribute('aria-hidden', 'false');
    if ('inert' in drawer) drawer.inert = false;
  }

  function closeDrawer() {
    const drawer = document.getElementById('nav-drawer');
    document.getElementById('nav-drawer-backdrop').classList.add('hidden');
    drawer.classList.add('-translate-x-full');
    drawer.setAttribute('aria-hidden', 'true');
    if ('inert' in drawer) drawer.inert = true;
  }

  function navigateTo(pageId) {
    currentPage = pageId;

    document.querySelectorAll('.app-page').forEach((p) => p.classList.add('hidden'));

    if (ACTIVE_PAGES.has(pageId)) {
      document.getElementById(`page-${pageId}`).classList.remove('hidden');
      if (pageId === 'virtual-office' && Nexora.officeEngine) {
        Nexora.officeEngine.resizeCanvas();
      }
      if (pageId === 'settings' && Nexora.settingsView) {
        Nexora.settingsView.render();
      }
      if (pageId === 'dashboard' && Nexora.dashboardView) {
        Nexora.dashboardView.render();
      }
      if (pageId === 'trend-research' && Nexora.trendResearchView) {
        Nexora.trendResearchView.render();
      }
      if (pageId === 'idea-bank' && Nexora.ideaBankView) {
        Nexora.ideaBankView.render();
      }
      if (pageId === 'script-management' && Nexora.scriptManagementView) {
        Nexora.scriptManagementView.render();
      }
      if (pageId === 'content-calendar' && Nexora.contentCalendarView) {
        Nexora.contentCalendarView.render();
      }
    } else {
      const meta = MENU_ITEMS.find((m) => m.id === pageId) || { label: pageId, phase: 'Fase Berikutnya' };
      document.getElementById('placeholder-phase-badge').textContent = `Jadwal Rilis: ${meta.phase}`;
      document.getElementById('placeholder-title').textContent = meta.label;
      document.getElementById('placeholder-desc').textContent =
        `Halaman ${meta.label} akan dibangun bertahap sesuai roadmap pengembangan Nexora AI Studio.`;
      document.getElementById('page-phase-placeholder').classList.remove('hidden');
    }

    document.querySelectorAll('.bottom-nav-btn').forEach((btn) => {
      const active = btn.getAttribute('data-nav-page') === pageId;
      btn.classList.toggle('active', active);
      btn.classList.toggle('text-sky-600', active);
      btn.classList.toggle('text-slate-500', !active);
    });

    renderDrawerMenu();
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderDrawerMenu() {
    const list = document.getElementById('drawer-nav-list');
    if (!list) return;

    list.innerHTML = MENU_ITEMS.map((item) => {
      const isActive = item.id === currentPage;
      const isReady = ACTIVE_PAGES.has(item.id);
      return `
        <button data-drawer-page="${item.id}"
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition ${
            isActive ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200' : 'hover:bg-slate-50 text-slate-700 font-medium'
          }">
          <span class="flex items-center gap-2.5 text-sm">
            <span>${item.icon}</span>
            <span>${item.label}</span>
          </span>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${
            isReady ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500'
          }">${isReady ? 'Aktif' : item.phase}</span>
        </button>
      `;
    }).join('');

    list.querySelectorAll('[data-drawer-page]').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-drawer-page')));
    });
  }

  function init() {
    document.getElementById('btn-open-drawer').addEventListener('click', openDrawer);
    document.getElementById('btn-close-drawer').addEventListener('click', closeDrawer);
    document.getElementById('nav-drawer-backdrop').addEventListener('click', closeDrawer);
    document.getElementById('btn-mobile-more-menu').addEventListener('click', openDrawer);

    document.querySelectorAll('[data-nav-page]').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-nav-page')));
    });

    document.getElementById('btn-go-dashboard-mini').addEventListener('click', () => navigateTo('dashboard'));
    document.getElementById('btn-back-to-office').addEventListener('click', () => navigateTo('virtual-office'));
    document.getElementById('btn-placeholder-to-office').addEventListener('click', () => navigateTo('virtual-office'));

    renderDrawerMenu();
  }

  Nexora.navigation = { init, navigateTo, closeDrawer };

})(window.Nexora = window.Nexora || {});