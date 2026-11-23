(function (Nexora) {
  'use strict';

  const esc = (v) => (Nexora.utils && Nexora.utils.escapeHtml ? Nexora.utils.escapeHtml(v) : String(v ?? ''));

  function formatArtifactReadableText(artifact) {
    if (!artifact) return '';
    const c = artifact.content || {};
    const empId = String(artifact.employee_id || '').toLowerCase();

    if (Nexora.workflowEngine && typeof Nexora.workflowEngine.formatPayloadText === 'function') {
      const fakeCfg = { actor: empId, type: 'agent_task' };
      const knownActors = new Set(['raka', 'sari', 'bima', 'dimas', 'laras', 'tio', 'mel', 'dina']);
      if (knownActors.has(empId)) {
        return Nexora.workflowEngine.formatPayloadText(fakeCfg, c);
      }
    }

    return Object.entries(c)
      .map(([k, v]) => `• ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');
  }

  function renderAllViews() {
    const state = Nexora.state;
    const stats = state.getSummaryStats();

    const headerCount = document.getElementById('header-active-count');
    if (headerCount) {
      headerCount.textContent = `${stats.workingCount}/${stats.totalEmployees}`;
    }

    syncConnectionLabels();
    renderOfficeSidePanels(state);

    const kpiGrid = document.getElementById('dashboard-kpi-grid');
    if (kpiGrid) {
      const kpis = [
        { label: 'Total Karyawan AI', value: stats.totalEmployees, sub: '8 Posisi Spesialis', color: 'text-sky-700 bg-sky-50 border-sky-200' },
        { label: 'Sedang Bekerja', value: stats.workingCount, sub: `${stats.waitingCount} Menunggu ACC`, color: 'text-teal-700 bg-teal-50 border-teal-200' },
        { label: 'Ide Dibuat', value: stats.ideasCreated, sub: 'Output SARI', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
        { label: 'Naskah Selesai', value: stats.scriptsFinished, sub: 'BIMA & DIMAS', color: 'text-blue-700 bg-blue-50 border-blue-200' },
        { label: 'Video Diproduksi', value: stats.videosProduced, sub: 'LARAS & TIO', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
        { label: 'Konten Terbit', value: stats.contentsPublished, sub: 'Disiapkan MEL', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        { label: 'Total Views', value: stats.totalSimulatedViews, sub: 'Analitik Studio', color: 'text-slate-700 bg-white border-slate-200' },
        { label: 'Engagement', value: stats.avgEngagementRate, sub: 'Evaluasi DINA', color: 'text-amber-700 bg-amber-50 border-amber-200' }
      ];

      kpiGrid.innerHTML = kpis
        .map(
          (k) => `
        <div class="rounded-2xl p-3.5 border shadow-sm ${k.color}">
          <div class="text-[11px] font-bold opacity-80">${esc(k.label)}</div>
          <div class="text-2xl font-extrabold mt-0.5">${esc(k.value)}</div>
          <div class="text-[10px] font-medium opacity-75 mt-0.5">${esc(k.sub)}</div>
        </div>
      `
        )
        .join('');
    }

    const empControls = document.getElementById('dashboard-employee-controls');
    if (empControls) {
      empControls.innerHTML = state.employees
        .map((emp) => {
          const stStyle = Nexora.STATUS_STYLE[emp.status] || Nexora.STATUS_STYLE['Standby'];
          return `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div class="flex items-center gap-2.5 cursor-pointer" data-open-emp="${esc(emp.id)}">
              <div class="w-9 h-9 rounded-xl text-white font-bold text-xs flex items-center justify-center shrink-0" style="background:${esc(emp.avatarColor)}">
                ${esc(emp.name.slice(0, 2))}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-xs text-slate-900">${esc(emp.name)}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${stStyle.badgeClass}">${esc(emp.status)}</span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">${esc(emp.role)} • ${esc(emp.currentTask)}</p>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button data-action="start" data-id="${esc(emp.id)}" class="px-2.5 py-1.5 rounded-lg bg-sky-600 text-white text-[11px] font-bold active:scale-95">Mulai</button>
              <button data-action="stop" data-id="${esc(emp.id)}" class="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold active:scale-95">Stop</button>
              <button data-action="inspect" data-id="${esc(emp.id)}" class="px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 text-[11px] font-bold active:scale-95">Detail</button>
            </div>
          </div>
        `;
        })
        .join('');

      empControls.querySelectorAll('[data-open-emp]').forEach((el) => {
        el.addEventListener('click', () => Nexora.employeeModal.open(el.getAttribute('data-open-emp')));
      });
      empControls.querySelectorAll('button[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-action');
          const id = btn.getAttribute('data-id');
          if (action === 'start') state.startEmployeeTask(id);
          if (action === 'stop') state.stopEmployeeTask(id);
          if (action === 'inspect') Nexora.employeeModal.open(id);
        });
      });
    }

    const perfCard = document.getElementById('dashboard-performance-card');
    if (perfCard) {
      perfCard.innerHTML = `
        <div class="p-3 rounded-xl bg-sky-50/70 border border-sky-100 flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-700">Retensi Rata-rata 3 Detik</span>
          <span class="text-sm font-extrabold text-sky-700">${esc(stats.avg3sRetention)}</span>
        </div>
        <div class="p-3 rounded-xl bg-teal-50/70 border border-teal-100 flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-700">Skor Kualitas Naskah (DIMAS)</span>
          <span class="text-sm font-extrabold text-teal-700">${esc(stats.scriptQualityScore)}</span>
        </div>
        <p class="text-[11px] text-slate-400">Catatan: Terhubung dengan metrik studio lokal/Supabase.</p>
      `;
    }

    const logEl = document.getElementById('dashboard-activity-log');
    if (logEl) {
      logEl.innerHTML = state.activityLogs
        .slice(0, 15)
        .map(
          (l) => `
        <div class="text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <div class="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
            <span class="font-bold text-sky-700">${esc(l.actor)}</span>
            <span>${esc(l.time)}</span>
          </div>
          <p class="text-slate-700">${esc(l.message)}</p>
        </div>
      `
        )
        .join('');
    }

    renderEmployeesDirectory(state);
  }

  function syncConnectionLabels() {
    const isCloud = Nexora.supabaseService && Nexora.supabaseService.isAuthenticated();
    const isLiveAI = Nexora.aiService && Nexora.aiService.isLiveAIAvailable();
    const headerMode = document.getElementById('header-studio-mode');
    const dashBadge = document.getElementById('dashboard-mode-badge');

    if (headerMode) {
      headerMode.textContent = isLiveAI
        ? 'Fase 5 • Live AI + Cloud'
        : isCloud
          ? 'Fase 5 • Cloud Supabase'
          : 'Fase 5 • Mode Lokal';
    }
    if (dashBadge) {
      dashBadge.textContent = isLiveAI
        ? 'Live AI + Supabase'
        : isCloud
          ? 'Cloud Supabase'
          : 'Mode Lokal (Browser)';
    }
  }

  function renderWorkflowPipeline() {
    const wf = Nexora.workflowEngine;
    if (!wf) return;

    syncConnectionLabels();

    const feedbackBanner = document.getElementById('dina-feedback-banner');
    if (feedbackBanner) {
      if (wf.latestFeedback && Array.isArray(wf.latestFeedback.recommendations)) {
        feedbackBanner.classList.remove('hidden');
        feedbackBanner.innerHTML = `
          <div class="font-bold mb-1">💡 Feedback Loop DINA (dari "${esc(wf.latestFeedback.fromTitle)}") siap untuk RAKA & SARI:</div>
          <ul class="list-disc list-inside space-y-0.5">
            ${wf.latestFeedback.recommendations.map((r) => `<li>${esc(r)}</li>`).join('')}
          </ul>
        `;
      } else {
        feedbackBanner.classList.add('hidden');
      }
    }

    const selectEl = document.getElementById('select-active-project');
    if (selectEl) {
      if (wf.projects.length > 0) {
        selectEl.classList.remove('hidden');
        const active = wf.getActiveProject();
        selectEl.innerHTML = wf.projects
          .map(
            (p) =>
              `<option value="${esc(p.id)}" ${active && p.id === active.id ? 'selected' : ''}>${esc(p.title)} (Langkah ${esc(p.current_step)}/12)</option>`
          )
          .join('');
      } else {
        selectEl.classList.add('hidden');
      }
    }

    const container = document.getElementById('workflow-pipeline-view');
    const artifactsEl = document.getElementById('workflow-artifacts-list');
    if (!container) return;

    const project = wf.getActiveProject();
    if (!project) {
      container.innerHTML = `
        <div class="p-4 rounded-2xl bg-sky-50/70 border border-sky-100 text-xs text-slate-600 text-center">
          Belum ada proyek konten aktif. Isi judul topik di atas dan klik <strong>🚀 Mulai Proyek</strong> untuk menjalankan workflow 12 langkah.
        </div>
      `;
      if (artifactsEl) artifactsEl.innerHTML = '';
      return;
    }

    const stepCfg = Nexora.getWorkflowStep(project.current_step) || Nexora.WORKFLOW_STEPS[0];
    const artifacts = wf.getProjectArtifacts(project.id);
    const latestArtifact = artifacts[0] || null;

    const stepperHtml = Nexora.WORKFLOW_STEPS.map((s) => {
      const done = project.status === 'completed' || s.step < project.current_step;
      const active = project.status !== 'completed' && s.step === project.current_step;
      let cls = 'bg-slate-100 text-slate-500 border-slate-200';
      if (done) cls = 'bg-emerald-100 text-emerald-700 border-emerald-200';
      else if (active) cls = 'bg-sky-600 text-white border-sky-600 shadow-sm';
      return `<span title="${esc(s.label)}" class="px-2 py-1 rounded-lg border text-[10px] font-bold ${cls}">${s.step}. ${esc(s.actor.toUpperCase())}</span>`;
    }).join('');

    let actionPanelHtml = '';
    if (wf.isStepRunning) {
      actionPanelHtml = `
        <div class="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-xs font-bold text-sky-800 flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping"></span>
          Agen AI sedang memproses Langkah ${esc(stepCfg.step)}: ${esc(stepCfg.label)}...
        </div>
      `;
    } else if (project.status === 'completed') {
      actionPanelHtml = `
        <div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="text-xs text-emerald-900">
            <strong>Siklus 12 Langkah Selesai!</strong> DINA telah mengirim insight performa ke RAKA & SARI.
          </div>
          <button id="btn-wf-new-cycle" class="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold active:scale-95 shrink-0">
            ↻ Siklus Baru + Insight DINA
          </button>
        </div>
      `;
    } else if (stepCfg.type === 'approval_gate' || stepCfg.type === 'manual_publish') {
      const isManualPublish = stepCfg.type === 'manual_publish';
      const pubPkg = project.publish_package || (latestArtifact ? latestArtifact.content : null);
      const copyBtn = isManualPublish && pubPkg
        ? `<button id="btn-wf-copy-publish" type="button" class="px-3 py-2 rounded-xl bg-sky-100 text-sky-800 text-xs font-bold active:scale-95">📋 Salin Caption</button>`
        : '';
      const ideaBankBtn = stepCfg.step === 3
        ? `<button id="btn-wf-goto-ideabank" type="button" class="px-3 py-2 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold active:scale-95">💡 Pilih di Idea Bank</button>`
        : '';
      const scriptBtn = stepCfg.step === 6
        ? `<button id="btn-wf-goto-scripts" type="button" class="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold active:scale-95">📝 Edit Naskah</button>`
        : '';
      const videoBtn = isManualPublish
        ? `<button id="btn-wf-goto-video" type="button" class="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold active:scale-95">🎬 Render Video</button>`
        : '';
      const calendarBtn = isManualPublish
        ? `<button id="btn-wf-goto-calendar" type="button" class="px-3 py-2 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold active:scale-95">📅 Content Calendar</button>`
        : '';

      actionPanelHtml = `
        <div class="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-extrabold text-amber-900">
              ${isManualPublish ? '📢 Siap Publikasi Manual oleh Direktur' : '✋ Menunggu Persetujuan Direktur'}: ${esc(stepCfg.label)}
            </span>
          </div>
          ${
            latestArtifact
              ? `<div class="text-xs bg-white p-3 rounded-xl border border-amber-200/80 text-slate-700 leading-relaxed max-h-52 overflow-y-auto whitespace-pre-line">${esc(formatArtifactReadableText(latestArtifact))}</div>`
              : ''
          }
          <input id="input-wf-revision-note" type="text" placeholder="Catatan revisi (opsional jika menolak)..."
            class="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <div class="flex flex-wrap gap-2">
            <button id="btn-wf-approve" type="button" class="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold active:scale-95">
              ${isManualPublish ? '✓ Konfirmasi Sudah Diposting' : '✓ Setujui & Lanjut'}
            </button>
            <button id="btn-wf-reject" type="button" class="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold active:scale-95">
              ✕ Tolak ke Langkah ${esc(stepCfg.rejectStep)}
            </button>
            ${ideaBankBtn}
            ${scriptBtn}
            ${videoBtn}
            ${calendarBtn}
            ${copyBtn}
          </div>
        </div>
      `;
    } else {
      actionPanelHtml = `
        <div class="p-3 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-between gap-2">
          <div class="text-xs text-sky-900">
            Langkah aktif: <strong>${esc(stepCfg.step)}. ${esc(stepCfg.label)}</strong>
          </div>
          <button id="btn-wf-run-step" type="button" class="px-3.5 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold active:scale-95">
            ▶ Jalankan Langkah
          </button>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="text-xs font-extrabold text-slate-900">${esc(project.title)}</div>
            <div class="text-[11px] text-slate-500">${esc(project.niche)} • ${esc(project.target_platform)}</div>
          </div>
          <span class="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold">
            Langkah ${esc(project.current_step)}/12 • ${esc(project.status)}
          </span>
        </div>
        <div class="flex flex-wrap gap-1">${stepperHtml}</div>
        ${actionPanelHtml}
      </div>
    `;

    const btnRun = document.getElementById('btn-wf-run-step');
    if (btnRun) btnRun.addEventListener('click', () => wf.runCurrentStep());

    const btnApprove = document.getElementById('btn-wf-approve');
    if (btnApprove) btnApprove.addEventListener('click', () => wf.approveCurrentGate());

    const btnIdeaBank = document.getElementById('btn-wf-goto-ideabank');
    if (btnIdeaBank) btnIdeaBank.addEventListener('click', () => Nexora.navigation.navigateTo('idea-bank'));

    const btnScripts = document.getElementById('btn-wf-goto-scripts');
    if (btnScripts) btnScripts.addEventListener('click', () => Nexora.navigation.navigateTo('script-management'));

    const btnVideo = document.getElementById('btn-wf-goto-video');
    if (btnVideo) btnVideo.addEventListener('click', () => Nexora.navigation.navigateTo('video-production'));

    const btnCalendar = document.getElementById('btn-wf-goto-calendar');
    if (btnCalendar) btnCalendar.addEventListener('click', () => Nexora.navigation.navigateTo('content-calendar'));

    const btnReject = document.getElementById('btn-wf-reject');
    if (btnReject) {
      btnReject.addEventListener('click', () => {
        const noteEl = document.getElementById('input-wf-revision-note');
        wf.rejectCurrentGate(noteEl ? noteEl.value : '');
      });
    }

    const btnCopy = document.getElementById('btn-wf-copy-publish');
    if (btnCopy) {
      btnCopy.addEventListener('click', async () => {
        const pubPkg = project.publish_package || (latestArtifact ? latestArtifact.content : null);
        if (!pubPkg) return;
        const text = `${pubPkg.final_caption || ''}\n\n${Array.isArray(pubPkg.hashtags) ? pubPkg.hashtags.join(' ') : ''}`.trim();
        try {
          await navigator.clipboard.writeText(text);
          Nexora.notificationsUI.showToast('Caption & hashtag disalin! Silakan posting manual.', 'success');
        } catch (err) {
          Nexora.notificationsUI.showToast('Salin manual dari kotak preview di atas.', 'info');
        }
      });
    }

    const btnNewCycle = document.getElementById('btn-wf-new-cycle');
    if (btnNewCycle) {
      btnNewCycle.addEventListener('click', () => {
        const titleInput = document.getElementById('input-project-title');
        if (titleInput) {
          titleInput.value = `Siklus Lanjutan: ${project.title}`;
          titleInput.focus();
          titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    if (artifactsEl) {
      if (artifacts.length === 0) {
        artifactsEl.innerHTML = '';
      } else {
        artifactsEl.innerHTML = `
          <details class="rounded-2xl border border-slate-200 bg-white p-3">
            <summary class="text-xs font-bold text-slate-700 cursor-pointer">
              📦 Riwayat Hasil Kerja Tersimpan (${artifacts.length} Hasil)
            </summary>
            <div class="mt-2.5 space-y-2 max-h-72 overflow-y-auto">
              ${artifacts
                .slice(0, 8)
                .map(
                  (a) => `
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div class="flex items-center justify-between font-bold text-sky-700 mb-1.5">
                    <span>${esc(String(a.employee_id).toUpperCase())} • Versi ${esc(a.version)}</span>
                    <span>${a.approved_by_director ? '✓ Disetujui' : ''}</span>
                  </div>
                  <div class="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line">${esc(formatArtifactReadableText(a))}</div>
                </div>
              `
                )
                .join('')}
            </div>
          </details>
        `;
      }
    }
  }

  function renderOfficeSidePanels(state) {
    const waitingEmps = state.employees.filter((e) => e.status === Nexora.STATUS.WAITING_APPROVAL);
    const alertCard = document.getElementById('approval-alert-card');
    const alertList = document.getElementById('approval-alert-list');

    if (alertCard && alertList) {
      alertCard.classList.toggle('hidden', waitingEmps.length === 0);
      alertList.innerHTML = waitingEmps
        .map(
          (emp) => `
        <div class="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-amber-200">
          <div class="min-w-0">
            <div class="text-xs font-bold text-slate-900">${esc(emp.name)} (${esc(emp.role)})</div>
            <div class="text-[11px] text-slate-500 truncate">${esc(emp.currentTask)}</div>
          </div>
          <button data-review-emp="${esc(emp.id)}" class="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-bold shrink-0">
            Tinjau
          </button>
        </div>
      `
        )
        .join('');

      alertList.querySelectorAll('[data-review-emp]').forEach((btn) => {
        btn.addEventListener('click', () => Nexora.employeeModal.open(btn.getAttribute('data-review-emp')));
      });
    }

    const rosterEl = document.getElementById('office-quick-roster');
    if (rosterEl) {
      rosterEl.innerHTML = state.employees
        .map((emp) => {
          const st = Nexora.STATUS_STYLE[emp.status] || Nexora.STATUS_STYLE['Standby'];
          const shortStatus = emp.status === 'Waiting Approval' ? 'ACC' : emp.status;
          return `
          <button data-roster-emp="${esc(emp.id)}"
            class="w-full text-left p-2 rounded-xl border border-slate-100 hover:border-sky-300 bg-slate-50/70 hover:bg-sky-50/60 transition flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${esc(st.dot)}"></span>
              <div class="truncate">
                <div class="text-xs font-bold text-slate-800 leading-tight">${esc(emp.name)}</div>
                <div class="text-[10px] text-slate-500 truncate">${esc(emp.role)}</div>
              </div>
            </div>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md ${st.badgeClass} shrink-0">
              ${esc(shortStatus)}
            </span>
          </button>
        `;
        })
        .join('');

      rosterEl.querySelectorAll('[data-roster-emp]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-roster-emp');
          if (Nexora.officeEngine) Nexora.officeEngine.focusEmployee(id);
          Nexora.employeeModal.open(id);
        });
      });
    }

    const miniFeed = document.getElementById('office-mini-feed');
    if (miniFeed) {
      miniFeed.innerHTML = state.activityLogs
        .slice(0, 7)
        .map(
          (l) => `
        <div class="border-l-2 border-sky-400 pl-2 py-0.5">
          <div class="flex justify-between text-[10px] text-slate-400">
            <span class="font-bold text-sky-700">${esc(l.actor)}</span>
            <span>${esc(l.time)}</span>
          </div>
          <p class="text-[11px] text-slate-700 leading-snug">${esc(l.message)}</p>
        </div>
      `
        )
        .join('');
    }
  }

  function renderEmployeesDirectory(state) {
    const grid = document.getElementById('employees-directory-grid');
    if (!grid) return;

    grid.innerHTML = state.employees
      .map((emp) => {
        const stStyle = Nexora.STATUS_STYLE[emp.status] || Nexora.STATUS_STYLE['Standby'];
        return `
        <div class="bg-white rounded-2xl p-4 border border-sky-100 shadow-sm flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2.5">
              <div class="flex items-center gap-2.5">
                <div class="w-11 h-11 rounded-2xl text-white font-extrabold flex items-center justify-center shadow-sm" style="background:${esc(emp.avatarColor)}">
                  ${esc(emp.name.slice(0, 2))}
                </div>
                <div>
                  <h3 class="text-sm font-extrabold text-slate-900">${esc(emp.name)}</h3>
                  <p class="text-xs font-semibold text-sky-700">${esc(emp.role)}</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${stStyle.badgeClass}">${esc(emp.status)}</span>
            </div>
            <p class="text-xs text-slate-600 leading-relaxed mb-2">${esc(emp.personality)}</p>
            <div class="text-[11px] bg-slate-50 rounded-xl p-2 border border-slate-100 text-slate-700">
              <span class="font-bold text-slate-500">Tugas:</span> ${esc(emp.currentTask)}
            </div>
          </div>
          <div class="flex gap-2">
            <button data-dir-inspect="${esc(emp.id)}" class="flex-1 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold active:scale-95 transition">
              Buka Kontrol
            </button>
            <button data-dir-locate="${esc(emp.id)}" class="px-3 py-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold active:scale-95 transition">
              Meja 2D
            </button>
          </div>
        </div>
      `;
      })
      .join('');

    grid.querySelectorAll('[data-dir-inspect]').forEach((btn) => {
      btn.addEventListener('click', () => Nexora.employeeModal.open(btn.getAttribute('data-dir-inspect')));
    });

    grid.querySelectorAll('[data-dir-locate]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-dir-locate');
        Nexora.navigation.navigateTo('virtual-office');
        if (Nexora.officeEngine) Nexora.officeEngine.focusEmployee(id);
      });
    });
  }

  function init() {
    document.getElementById('btn-dir-start-all').addEventListener('click', () => Nexora.state.startAllStandby());
    document.getElementById('btn-dir-stop-all').addEventListener('click', () => Nexora.state.stopAllWorkers());

    const formNewProj = document.getElementById('form-new-project');
    if (formNewProj) {
      formNewProj.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleEl = document.getElementById('input-project-title');
        const nicheEl = document.getElementById('input-project-niche');
        const platformEl = document.getElementById('input-project-platform');
        await Nexora.workflowEngine.createProject({
          title: titleEl.value,
          niche: nicheEl.value,
          targetPlatform: platformEl.value,
          autoStart: true
        });
        titleEl.value = '';
      });
    }

    const selectProj = document.getElementById('select-active-project');
    if (selectProj) {
      selectProj.addEventListener('change', (e) => {
        Nexora.workflowEngine.setActiveProject(e.target.value);
      });
    }

    Nexora.state.subscribe(renderAllViews);
    if (Nexora.workflowEngine) {
      Nexora.workflowEngine.subscribe(renderWorkflowPipeline);
    }

    renderAllViews();
    renderWorkflowPipeline();
  }

  function render() {
    renderAllViews();
    renderWorkflowPipeline();
  }

  Nexora.dashboardView = { init, render };

})(window.Nexora = window.Nexora || {});