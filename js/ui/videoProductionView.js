(function (Nexora) {
  'use strict';

  const esc = (v) => (Nexora.utils && Nexora.utils.escapeHtml ? Nexora.utils.escapeHtml(v) : String(v ?? ''));

  let selectedProjectId = null;
  let initialized = false;
  let renderRequestActive = false;

  function getProducibleProjects(wf) {
    return wf.projects.filter((p) => {
      const arts = wf.getProjectArtifacts(p.id);
      return p.final_script || arts.some((a) => a.employee_id === 'bima');
    });
  }

  function getScriptForProject(wf, project) {
    if (!project) return null;
    const arts = wf.getProjectArtifacts(project.id);
    const bimaArt = arts.find((a) => a.employee_id === 'bima');
    return project.final_script || (bimaArt ? bimaArt.content : null);
  }

  function triggerDownload(urlOrText, filename, isText = false) {
    const a = document.createElement('a');
    if (isText) {
      const blob = new Blob([urlOrText], { type: 'text/plain;charset=utf-8' });
      a.href = URL.createObjectURL(blob);
    } else {
      a.href = urlOrText;
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function buildClaudePrompt(project) {
    const wf = Nexora.workflowEngine;
    const script = getScriptForProject(wf, project);
    const artifacts = wf.getProjectArtifacts(project.id);
    const laras = artifacts.find((a) => a.employee_id === 'laras');
    const characters = Nexora.characterLibrary ? Nexora.characterLibrary.list() : [];
    const sceneData = laras ? laras.content : null;
    return [
      'ANDA ADALAH SUTRADARA ANIMASI DAN PEMBUAT VIDEO. Buat video final sungguhan, bukan storyboard, bukan kumpulan gambar diam, dan bukan slideshow.',
      `JUDUL PROYEK: ${project.title}`,
      `NICHE: ${project.niche || '-'}`,
      `PLATFORM: ${project.target_platform || 'TikTok / Reels / Shorts'}`,
      'FORMAT: vertikal 9:16, target 30–60 detik kecuali durasi naskah menentukan lain.',
      'ATURAN TOKOH: nama tokoh cerita harus orisinal. DILARANG memakai nama karyawan Nexora seperti RAKA, SARI, BIMA, DIMAS, LARAS, TIO, MEL, atau DINA sebagai nama tokoh cerita. Pertahankan wajah, pakaian, warna, proporsi, dan suara setiap tokoh secara konsisten di semua adegan.',
      'ATURAN PRODUKSI: tampilkan gerakan nyata, perubahan pose, ekspresi, pergerakan kamera, dan transisi antarscene. Sertakan dialog/narasi Bahasa Indonesia, musik latar yang sesuai, efek suara seperlunya, dan subtitle yang sinkron. Jangan mengganti adegan dengan gambar statis.',
      'Jika lingkungan Claude tidak dapat merender atau mengekspor MP4 secara langsung, jelaskan keterbatasannya dan berikan artefak/kode produksi yang benar-benar dapat dijalankan. Jangan mengklaim MP4 selesai jika file belum dibuat.',
      'NASKAH FINAL:',
      typeof script === 'string' ? script : JSON.stringify(script, null, 2),
      'STORYBOARD / ARAHAN LARAS:',
      sceneData ? JSON.stringify(sceneData, null, 2) : 'Belum ada storyboard LARAS. Kembangkan storyboard dari naskah.',
      'CHARACTER BIBLE DARI CHARACTER LIBRARY:',
      JSON.stringify(characters, null, 2),
      'OUTPUT YANG DIMINTA: video MP4 final 9:16, seluruh adegan bergerak, audio dialog/narasi, musik, dan subtitle tertanam atau file subtitle terpisah. Berikan tautan/file hasil yang benar-benar dapat diunduh.'
    ].join('\n\n');
  }

  function render() {
    const wf = Nexora.workflowEngine;
    const vr = Nexora.videoRenderer;
    if (!wf || !vr) return;

    const projects = getProducibleProjects(wf);
    const selectEl = document.getElementById('select-video-project');
    const emptyEl = document.getElementById('video-empty-state');
    const workspaceEl = document.getElementById('video-workspace');
    const pillEl = document.getElementById('video-prod-status-pill');

    if (projects.length === 0) {
      if (selectEl) selectEl.classList.add('hidden');
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (workspaceEl) workspaceEl.classList.add('hidden');
      if (pillEl) pillEl.textContent = 'Belum ada naskah';
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
    if (pillEl) {
      pillEl.textContent = vr.isRendering
        ? 'Sedang Render Video...'
        : rendered
          ? `Siap (${rendered.ext.toUpperCase()} • ${rendered.sizeKb} KB)`
          : 'Siap Render 9:16';
    }

    const sbCard = document.getElementById('video-storyboard-card');
    if (sbCard) {
      const arts = wf.getProjectArtifacts(project.id);
      const larasArt = arts.find((a) => a.employee_id === 'laras');
      const script = getScriptForProject(wf, project);
      const timeline = vr.buildTimeline(project, script);
      const estSec = Math.round(timeline[timeline.length - 1].end);

      sbCard.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div class="text-xs font-extrabold text-slate-900">🎬 Storyboard LARAS • ${esc(project.title)}</div>
          <span class="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold">
            ${esc(timeline.length)} Segmen • ~${esc(estSec)} detik (9:16)
          </span>
        </div>
        ${
          larasArt
            ? `<div class="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 whitespace-pre-line mb-2">${esc(wf.formatPayloadText({ actor: 'laras' }, larasArt.content))}</div>`
            : '<p class="text-[11px] text-slate-500 mb-2">Naskah sudah siap dirender menjadi video 9:16 beserta tokoh animasi & subtitle otomatis.</p>'
        }
      `;
    }

    const btnRender = document.getElementById('btn-render-video');
    const btnCancel = document.getElementById('btn-cancel-render');
    if (btnRender) {
      btnRender.disabled = vr.isRendering;
      btnRender.classList.toggle('opacity-50', vr.isRendering);
      btnRender.textContent = vr.isRendering
        ? '⏳ Sedang Merender...'
        : rendered
          ? '🔄 Render Ulang Video 9:16'
          : '🎬 Render Video 9:16 Sekarang';
    }
    if (btnCancel) {
      btnCancel.classList.toggle('hidden', !vr.isRendering);
    }

    const previewWrap = document.getElementById('video-preview-wrap');
    const player = document.getElementById('video-preview-player');
    const metaEl = document.getElementById('video-file-meta');
    if (previewWrap && player && metaEl) {
      if (rendered) {
        previewWrap.classList.remove('hidden');
        if (player.src !== rendered.url) {
          player.src = rendered.url;
        }
        metaEl.textContent = `Format: ${rendered.ext.toUpperCase()} • Durasi: ~${rendered.durationSec}d • Ukuran: ${rendered.sizeKb} KB`;
      } else {
        previewWrap.classList.add('hidden');
      }
    }
  }

  function init() {
    // Prevent duplicate event listeners if navigation or boot code initializes this view again.
    if (initialized) {
      render();
      return;
    }
    initialized = true;

    const selectEl = document.getElementById('select-video-project');
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        selectedProjectId = e.target.value;
        render();
      });
    }

    const btnRender = document.getElementById('btn-render-video');
    if (btnRender) {
      btnRender.addEventListener('click', async () => {
        if (renderRequestActive) return;
        renderRequestActive = true;
        const wf = Nexora.workflowEngine;
        const vr = Nexora.videoRenderer;
        const project = wf.projects.find((p) => p.id === selectedProjectId);
        const script = getScriptForProject(wf, project);
        if (!project || !script) {
          renderRequestActive = false;
          Nexora.notificationsUI?.showToast('Proyek atau naskah belum tersedia.', 'warning');
          return;
        }

        const progWrap = document.getElementById('video-render-progress-wrap');
        const progBar = document.getElementById('video-render-progress-bar');
        const progTxt = document.getElementById('video-render-progress-text');
        const canvas = document.getElementById('video-render-canvas');

        if (progWrap) progWrap.classList.remove('hidden');
        if (canvas) canvas.classList.remove('hidden');

        const larasEmp = Nexora.state.getEmployee('laras');
        if (larasEmp) {
          wf.syncEmployeeToCanvas(larasEmp, Nexora.STATUS.WORKING, 25, `[${project.title}] Rendering Video 9:16...`, 'Sedang merekam adegan, karakter & subtitle...');
        }

        try {
          render();
          const result = await vr.renderProjectVideo({
            project,
            script,
            previewCanvas: canvas,
            onProgress: (pct) => {
              if (progBar) progBar.style.width = `${pct}%`;
              if (progTxt) progTxt.textContent = `${pct}%`;
            }
          });

          if (larasEmp) {
            wf.syncEmployeeToCanvas(
              larasEmp,
              Nexora.STATUS.COMPLETED,
              100,
              `[${project.title}] Video Selesai (${result.ext.toUpperCase()})`,
              `Video 9:16 selesai dirender (${result.sizeKb} KB, ~${result.durationSec} detik). Siap dicek oleh TIO (QC) & didownload.`
            );
          }

          Nexora.state.addLog('LARAS', `Merender video "${project.title}" (${result.ext.toUpperCase()}, ${result.sizeKb} KB).`);
          Nexora.notificationsUI.showToast('Video 9:16 selesai dirender! Silakan preview & cek QC.', 'success', 'tio');
        } catch (err) {
          Nexora.notificationsUI.showToast(`Render video: ${err.message}`, 'warning');
        } finally {
          renderRequestActive = false;
          if (progWrap) progWrap.classList.add('hidden');
          if (canvas) canvas.classList.add('hidden');
          render();
          if (Nexora.qualityControlView) Nexora.qualityControlView.render();
          if (Nexora.contentCalendarView) Nexora.contentCalendarView.render();
        }
      });
    }

    const promptBox = document.getElementById('claude-video-prompt');
    const copyPromptBtn = document.getElementById('btn-copy-claude-prompt');
    const openClaudeBtn = document.getElementById('btn-open-claude');
    const uploadInput = document.getElementById('manual-video-upload');
    const manualStatus = document.getElementById('manual-video-status');
    let manualVideoUrl = null;

    const refreshClaudePrompt = () => {
      const project = Nexora.workflowEngine.projects.find((p) => p.id === selectedProjectId);
      if (promptBox && project) promptBox.value = buildClaudePrompt(project);
    };

    if (copyPromptBtn) {
      copyPromptBtn.addEventListener('click', async () => {
        refreshClaudePrompt();
        if (!promptBox || !promptBox.value) return;
        try {
          await navigator.clipboard.writeText(promptBox.value);
          Nexora.notificationsUI.showToast('Prompt produksi berhasil disalin.', 'success');
        } catch (_) {
          promptBox.focus();
          promptBox.select();
          Nexora.notificationsUI.showToast('Clipboard tidak tersedia. Tekan lama teks lalu salin.', 'warning');
        }
      });
    }

    if (openClaudeBtn) {
      openClaudeBtn.addEventListener('click', () => {
        refreshClaudePrompt();
        window.open('https://claude.ai/new', '_blank', 'noopener');
      });
    }

    if (uploadInput) {
      uploadInput.addEventListener('change', () => {
        const file = uploadInput.files && uploadInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('video/')) {
          Nexora.notificationsUI.showToast('Pilih file video yang valid.', 'warning');
          uploadInput.value = '';
          return;
        }
        if (manualVideoUrl) URL.revokeObjectURL(manualVideoUrl);
        manualVideoUrl = URL.createObjectURL(file);
        const player = document.getElementById('video-preview-player');
        const previewWrap = document.getElementById('video-preview-wrap');
        const meta = document.getElementById('video-file-meta');
        if (player) player.src = manualVideoUrl;
        if (previewWrap) previewWrap.classList.remove('hidden');
        if (meta) meta.textContent = `File lokal: ${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB • ${file.type || 'video'}`;
        if (manualStatus) manualStatus.textContent = `Video dipilih: ${file.name}. File hanya dipreview di browser ini dan belum tersimpan permanen ke cloud.`;
        Nexora.notificationsUI.showToast('Video berhasil dimuat untuk preview lokal.', 'success');
      });
    }

    refreshClaudePrompt();

    const btnCancel = document.getElementById('btn-cancel-render');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => Nexora.videoRenderer.cancelRender());
    }

    const btnDownVideo = document.getElementById('btn-download-video');
    if (btnDownVideo) {
      btnDownVideo.addEventListener('click', () => {
        const rendered = Nexora.videoRenderer.getRenderedVideo(selectedProjectId);
        const proj = Nexora.workflowEngine.projects.find((p) => p.id === selectedProjectId);
        if (!rendered) return;
        const safeName = (proj ? proj.title : 'nexora-video').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
        triggerDownload(rendered.url, `${safeName}.${rendered.ext}`);
      });
    }

    const btnDownSrt = document.getElementById('btn-download-srt');
    if (btnDownSrt) {
      btnDownSrt.addEventListener('click', () => {
        const rendered = Nexora.videoRenderer.getRenderedVideo(selectedProjectId);
        const proj = Nexora.workflowEngine.projects.find((p) => p.id === selectedProjectId);
        if (!rendered) return;
        const safeName = (proj ? proj.title : 'nexora-sub').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
        triggerDownload(rendered.srtText, `${safeName}.srt`, true);
      });
    }

    const btnToQc = document.getElementById('btn-video-to-qc');
    if (btnToQc) {
      btnToQc.addEventListener('click', () => {
        if (selectedProjectId) Nexora.workflowEngine.setActiveProject(selectedProjectId);
        Nexora.navigation.navigateTo('quality-control');
      });
    }

    const btnToScripts = document.getElementById('btn-video-to-scripts');
    if (btnToScripts) {
      btnToScripts.addEventListener('click', () => Nexora.navigation.navigateTo('script-management'));
    }

    if (Nexora.workflowEngine) {
      Nexora.workflowEngine.subscribe(render);
    }
    render();
  }

  Nexora.videoProductionView = { init, render };

})(window.Nexora = window.Nexora || {});