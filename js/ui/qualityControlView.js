(function (Nexora) {
  'use strict';

  const esc = (v) => (Nexora.utils && Nexora.utils.escapeHtml ? Nexora.utils.escapeHtml(v) : String(v ?? ''));

  let selectedProjectId = null;

  function getQcProjects(wf) {
    return wf.projects.filter((p) => {
      const arts = wf.getProjectArtifacts(p.id);
      return p.current_step >= 7 || arts.some((a) => a.employee_id === 'bima' || a.employee_id === 'tio');
    });
  }

  function render() {
    const wf = Nexora.workflowEngine;
    const vr = Nexora.videoRenderer;
    if (!wf || !vr) return;

    const projects = getQcProjects(wf);
    const selectEl = document.getElementById('select-qc-project');
    const emptyEl = document.getElementById('qc-empty-state');
    const workspaceEl = document.getElementById('qc-workspace');
    const pillEl = document.getElementById('qc-status-pill');

    if (projects.length === 0) {
      if (selectEl) selectEl.classList.add('hidden');
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (workspaceEl) workspaceEl.classList.add('hidden');
      if (pillEl) pillEl.textContent = 'Belum ada video';
      return;
    }

    const active = wf.getActiveProject();
    if (!selectedProjectId || !projects.some((p) => p.id === selectedProjectId)) {
      selectedProjectId = active && projects.some((p) => p.id === active.id) ? active.id : projects[0].id;
    }

    const project = projects.find((p) => p.id === selectedProjectId) || projects[0];
    if (selectEl) {
      selectEl.classList.remove('hidden');
      selectEl.innerHTML = projects
        .map((p) => `<option value="${esc(p.id)}" ${p.id === project.id ? 'selected' : ''}>${esc(p.title)}</option>`)
        .join('');
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (workspaceEl) workspaceEl.classList.remove('hidden');

    const rendered = vr.getRenderedVideo(project.id);
    const arts = wf.getProjectArtifacts(project.id);
    const tioArt = arts.find((a) => a.employee_id === 'tio');

    if (pillEl) {
      pillEl.textContent = rendered
        ? `Video Siap QC (${rendered.ext.toUpperCase()})`
        : 'Video Belum Dirender';
    }

    const playerEl = document.getElementById('qc-video-player');
    const noVidNote = document.getElementById('qc-no-video-note');
    if (playerEl && noVidNote) {
      if (rendered) {
        playerEl.classList.remove('hidden');
        noVidNote.classList.add('hidden');
        if (playerEl.src !== rendered.url) playerEl.src = rendered.url;
      } else {
        playerEl.classList.add('hidden');
        noVidNote.classList.remove('hidden');
      }
    }

    const reportEl = document.getElementById('qc-report-card');
    if (reportEl) {
      const c = (tioArt && tioArt.content) || {};
      const checks = [
        { label: 'Format Vertikal 9:16', ok: Boolean(rendered), val: rendered ? `${rendered.ext.toUpperCase()} (${rendered.sizeKb} KB)` : 'Belum dirender di Video Production' },
        { label: 'Kualitas Audio', ok: true, val: c.audio_check || 'Web Audio ambient + sinkronisasi adegan aktif' },
        { label: 'Keterbacaan Subtitle', ok: true, val: c.subtitle_check || 'Teks putih bold + outline aman dari tombol UI' },
        { label: 'Status Rekomendasi TIO', ok: c.verdict !== 'NEEDS_REVISION', val: c.revision_notes || 'Siap diputuskan Direktur untuk masuk jadwal MEL.' }
      ];

      reportEl.innerHTML = `
        <div class="space-y-2">
          ${checks
            .map(
              (ck) => `
            <div class="p-2.5 rounded-xl border ${
              ck.ok ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50 border-amber-200'
            } text-xs flex items-start justify-between gap-2">
              <div>
                <div class="font-bold text-slate-900">${ck.ok ? '✅' : '⚠️'} ${esc(ck.label)}</div>
                <div class="text-[11px] text-slate-600 mt-0.5">${esc(ck.val)}</div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    }
  }

  function init() {
    const selectEl = document.getElementById('select-qc-project');
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        selectedProjectId = e.target.value;
        render();
      });
    }

    const btnToVideo = document.getElementById('btn-qc-to-video');
    if (btnToVideo) {
      btnToVideo.addEventListener('click', () => {
        if (selectedProjectId) Nexora.workflowEngine.setActiveProject(selectedProjectId);
        Nexora.navigation.navigateTo('video-production');
      });
    }

    const btnGoRender = document.getElementById('btn-qc-go-render');
    if (btnGoRender) {
      btnGoRender.addEventListener('click', () => {
        if (selectedProjectId) Nexora.workflowEngine.setActiveProject(selectedProjectId);
        Nexora.navigation.navigateTo('video-production');
      });
    }

    const btnPass = document.getElementById('btn-qc-pass-to-mel');
    if (btnPass) {
      btnPass.addEventListener('click', async () => {
        const wf = Nexora.workflowEngine;
        const proj = wf.projects.find((p) => p.id === selectedProjectId);
        if (!proj) return;
        wf.setActiveProject(proj.id);

        if (proj.current_step < 9) {
          await wf.updateProjectState(proj, { current_step: 9, status: 'active' });
          await wf.runCurrentStep();
        }
        Nexora.notificationsUI.showToast('Lolos QC TIO! Paket publikasi MEL siap di Content Calendar.', 'success', 'mel');
        Nexora.navigation.navigateTo('content-calendar');
      });
    }

    const btnReject = document.getElementById('btn-qc-reject-to-laras');
    if (btnReject) {
      btnReject.addEventListener('click', async () => {
        const wf = Nexora.workflowEngine;
        const proj = wf.projects.find((p) => p.id === selectedProjectId);
        if (!proj) return;
        const noteEl = document.getElementById('input-qc-revision-note');
        const notes = (noteEl ? noteEl.value.trim() : '') || 'Perbaiki visual adegan dan render ulang video.';
        wf.setActiveProject(proj.id);
        await wf.updateProjectState(proj, { current_step: 7, status: 'active' });
        await wf.runCurrentStep({ revisionNotes: notes });
        if (noteEl) noteEl.value = '';
        Nexora.navigation.navigateTo('video-production');
      });
    }

    if (Nexora.workflowEngine) {
      Nexora.workflowEngine.subscribe(render);
    }
    render();
  }

  Nexora.qualityControlView = { init, render };

})(window.Nexora = window.Nexora || {});