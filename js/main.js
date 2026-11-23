(function (Nexora) {
  'use strict';

  function showBootDiagnostics(errors) {
    if (!errors || errors.length === 0) return;
    const main = document.querySelector('main');
    if (!main) return;

    const existing = document.getElementById('nexora-boot-diag');
    if (existing) existing.remove();

    const box = document.createElement('div');
    box.id = 'nexora-boot-diag';
    box.className = 'mb-3 p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs space-y-1 shadow-sm';

    const title = document.createElement('div');
    title.className = 'font-extrabold text-rose-700';
    title.textContent = '⚠️ Terdeteksi Error Inisialisasi (Cek Path/File di Acode):';
    box.appendChild(title);

    errors.forEach((msg) => {
      const item = document.createElement('div');
      item.className = 'font-mono text-[11px] break-words';
      item.textContent = '• ' + msg;
      box.appendChild(item);
    });

    main.prepend(box);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const bootErrors = [];

    function safeRun(label, fn) {
      try {
        fn();
      } catch (err) {
        bootErrors.push(`${label}: ${err && err.message ? err.message : String(err)}`);
      }
    }

    const requiredPaths = [
      ['Nexora.EMPLOYEES (js/config/employees.js)', () => Array.isArray(Nexora.EMPLOYEES)],
      ['Nexora.WORKFLOW_STEPS (js/config/workflowConfig.js)', () => Array.isArray(Nexora.WORKFLOW_STEPS)],
      ['Nexora.supabaseService (js/services/supabaseService.js)', () => Boolean(Nexora.supabaseService)],
      ['Nexora.aiService (js/services/aiService.js)', () => Boolean(Nexora.aiService)],
      ['Nexora.videoRenderer (js/services/videoRenderer.js)', () => Boolean(Nexora.videoRenderer)],
      ['Nexora.state (js/state/studioState.js)', () => Boolean(Nexora.state)],
      ['Nexora.workflowEngine (js/workflow/workflowEngine.js)', () => Boolean(Nexora.workflowEngine)],
      ['Nexora.officeSprites (js/office/officeSprites.js)', () => Boolean(Nexora.officeSprites)],
      ['Nexora.VirtualOfficeEngine (js/office/officeEngine.js)', () => Boolean(Nexora.VirtualOfficeEngine)]
    ];

    requiredPaths.forEach(([label, check]) => {
      if (!check()) bootErrors.push(`Modul tidak termuat -> ${label}`);
    });

    safeRun('officeEngine', () => {
      if (Nexora.VirtualOfficeEngine && Nexora.officeSprites) {
        Nexora.officeEngine = new Nexora.VirtualOfficeEngine('office-canvas');
      }
    });

    safeRun('notificationsUI', () => Nexora.notificationsUI && Nexora.notificationsUI.init());
    safeRun('employeeModal', () => Nexora.employeeModal && Nexora.employeeModal.init());
    safeRun('workflowEngine', () => Nexora.workflowEngine && Nexora.workflowEngine.init());
    safeRun('trendResearchView', () => Nexora.trendResearchView && Nexora.trendResearchView.init());
    safeRun('ideaBankView', () => Nexora.ideaBankView && Nexora.ideaBankView.init());
    safeRun('scriptManagementView', () => Nexora.scriptManagementView && Nexora.scriptManagementView.init());
    safeRun('videoProductionView', () => Nexora.videoProductionView && Nexora.videoProductionView.init());
    safeRun('characterStudioView', () => Nexora.characterStudioView && Nexora.characterStudioView.init());
    safeRun('storyboardStudioView', () => Nexora.storyboardStudioView && Nexora.storyboardStudioView.init());
    safeRun('qualityControlView', () => Nexora.qualityControlView && Nexora.qualityControlView.init());
    safeRun('contentCalendarView', () => Nexora.contentCalendarView && Nexora.contentCalendarView.init());
    safeRun('settingsView', () => Nexora.settingsView && Nexora.settingsView.init());
    safeRun('dashboardView', () => Nexora.dashboardView && Nexora.dashboardView.init());
    safeRun('navigation', () => Nexora.navigation && Nexora.navigation.init());

    const btnAutoSim = document.getElementById('btn-toggle-autosim');
    const autoSimLabel = document.getElementById('autosim-label');
    const autoSimDot = document.getElementById('autosim-dot');

    function syncAutoSimBtn() {
      if (!Nexora.state || !btnAutoSim || !autoSimLabel || !autoSimDot) return;
      const on = Nexora.state.autoSimEnabled;
      autoSimLabel.textContent = on ? 'Simulasi: ON' : 'Simulasi: PAUSED';
      btnAutoSim.classList.toggle('bg-teal-500', on);
      btnAutoSim.classList.toggle('bg-slate-600', !on);
      autoSimDot.classList.toggle('animate-pulse', on);
    }

    if (btnAutoSim) {
      btnAutoSim.addEventListener('click', () => {
        if (!Nexora.state) return;
        Nexora.state.toggleAutoSim();
        syncAutoSimBtn();
      });
    }

    const btnSimStep = document.getElementById('btn-sim-step');
    if (btnSimStep) {
      btnSimStep.addEventListener('click', () => {
        if (Nexora.state) Nexora.state.advanceSimulationStep();
      });
    }

    const btnZoomIn = document.getElementById('btn-zoom-in');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        if (Nexora.officeEngine) Nexora.officeEngine.setZoom(Nexora.officeEngine.zoom + 0.25);
      });
    }

    const btnZoomOut = document.getElementById('btn-zoom-out');
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        if (Nexora.officeEngine) Nexora.officeEngine.setZoom(Nexora.officeEngine.zoom - 0.25);
      });
    }

    const btnResetView = document.getElementById('btn-reset-view');
    if (btnResetView) {
      btnResetView.addEventListener('click', () => {
        if (Nexora.officeEngine) Nexora.officeEngine.setZoom(1);
      });
    }

    const btnResetSim = document.getElementById('btn-reset-simulation');
    if (btnResetSim) {
      btnResetSim.addEventListener('click', () => {
        if (confirm('Reset seluruh data simulasi lokal ke kondisi awal?')) {
          if (Nexora.state) Nexora.state.resetSimulation();
          syncAutoSimBtn();
          if (Nexora.employeeModal) Nexora.employeeModal.close();
          if (Nexora.navigation) Nexora.navigation.closeDrawer();
        }
      });
    }

    if (Nexora.state) {
      Nexora.state.subscribe(syncAutoSimBtn);
    }

    setInterval(() => {
      if (Nexora.state && Nexora.state.autoSimEnabled) {
        Nexora.state.advanceSimulationStep();
      }
    }, 3500);

    syncAutoSimBtn();
    showBootDiagnostics(bootErrors);

    if (Nexora.supabaseService && Nexora.supabaseService.isConfigured()) {
      Nexora.supabaseService
        .restoreSession()
        .then((user) => {
          if (user && Nexora.workflowEngine) {
            return Nexora.workflowEngine.syncFromCloud();
          }
          return null;
        })
        .then(() => {
          if (Nexora.settingsView) Nexora.settingsView.render();
          if (Nexora.dashboardView) Nexora.dashboardView.render();
          if (Nexora.trendResearchView) Nexora.trendResearchView.render();
          if (Nexora.ideaBankView) Nexora.ideaBankView.render();
          if (Nexora.scriptManagementView) Nexora.scriptManagementView.render();
          if (Nexora.videoProductionView) Nexora.videoProductionView.render();
          if (Nexora.qualityControlView) Nexora.qualityControlView.render();
          if (Nexora.contentCalendarView) Nexora.contentCalendarView.render();
        })
        .catch(() => {});
    }
  });

})(window.Nexora = window.Nexora || {});