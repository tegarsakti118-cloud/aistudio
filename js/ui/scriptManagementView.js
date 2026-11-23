(function (Nexora) {
  'use strict';

  const esc = (v) => (Nexora.utils && Nexora.utils.escapeHtml ? Nexora.utils.escapeHtml(v) : String(v ?? ''));

  let selectedProjectId = null;
  let lastFormSignature = '';
  let currentDraftRef = null;

  function getScriptProjects(wf) {
    return wf.projects.filter((p) => {
      const arts = wf.getProjectArtifacts(p.id);
      return p.current_step >= 4 || arts.some((a) => a.employee_id === 'bima' || a.employee_id === 'dimas');
    });
  }

  function normalizeScenes(scenes) {
    if (!Array.isArray(scenes)) return [];
    return scenes.map((sc, idx) => {
      if (typeof sc === 'string') {
        return {
          scene_no: idx + 1,
          duration_sec: 5,
          speaker: 'Narator',
          dialogue: sc,
          visual_direction: ''
        };
      }
      return {
        scene_no: Number(sc.scene_no || idx + 1),
        duration_sec: Number(sc.duration_sec || 5),
        speaker: sc.speaker || 'Tokoh',
        dialogue: sc.dialogue || sc.narration || sc.text || '',
        visual_direction: sc.visual_direction || ''
      };
    });
  }

  function formatCharactersInput(characters) {
    if (!Array.isArray(characters) || characters.length === 0) return '';
    return characters
      .map((c) => (typeof c === 'string' ? c : `${c.name}${c.voice_style ? ` (${c.voice_style})` : ''}`))
      .join(', ');
  }

  function parseCharactersInput(rawText) {
    return String(rawText || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/^(.+?)\s*\((.+)\)$/);
        if (match) {
          return { name: match[1].trim(), voice_style: match[2].trim() };
        }
        return { name: part, voice_style: 'natural' };
      });
  }

  function renderScenesEditor(scenes) {
    const container = document.getElementById('script-scenes-editor');
    if (!container) return;

    const normalized = normalizeScenes(scenes);
    if (normalized.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-400">Belum ada adegan. Klik "+ Tambah Adegan".</p>';
      return;
    }

    container.innerHTML = normalized
      .map(
        (sc, idx) => `
      <div class="script-scene-row p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2" data-scene-idx="${idx}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-extrabold text-sky-700">Adegan #${idx + 1}</span>
          <div class="flex items-center gap-1.5">
            <label class="text-[10px] text-slate-500">Durasi (dtk):</label>
            <input type="number" min="1" max="120" value="${esc(sc.duration_sec)}"
              class="scene-duration w-14 px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs text-center" />
            <button type="button" data-remove-scene="${idx}"
              class="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 text-[10px] font-bold hover:bg-rose-100">
              Hapus
            </button>
          </div>
        </div>

        <input type="text" value="${esc(sc.speaker)}" placeholder="Nama Tokoh / Pembicara..."
          class="scene-speaker w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold" />

        <textarea rows="2" placeholder="Dialog atau narasi voiceover..."
          class="scene-dialogue w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs">${esc(sc.dialogue)}</textarea>

        <input type="text" value="${esc(sc.visual_direction)}" placeholder="Arahan visual / ekspresi / kamera..."
          class="scene-visual w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] text-slate-600" />
      </div>
    `
      )
      .join('');

    container.querySelectorAll('[data-remove-scene]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-remove-scene'));
        const collected = collectScenesFromDom();
        collected.splice(idx, 1);
        renderScenesEditor(collected);
      });
    });
  }

  function collectScenesFromDom() {
    const rows = document.querySelectorAll('#script-scenes-editor .script-scene-row');
    const scenes = [];
    rows.forEach((row, idx) => {
      const durationEl = row.querySelector('.scene-duration');
      const speakerEl = row.querySelector('.scene-speaker');
      const dialogueEl = row.querySelector('.scene-dialogue');
      const visualEl = row.querySelector('.scene-visual');
      scenes.push({
        scene_no: idx + 1,
        duration_sec: Number(durationEl ? durationEl.value : 5) || 5,
        speaker: speakerEl ? speakerEl.value.trim() : 'Narator',
        dialogue: dialogueEl ? dialogueEl.value.trim() : '',
        visual_direction: visualEl ? visualEl.value.trim() : ''
      });
    });
    return scenes;
  }

  function collectEditedScript() {
    const base = currentDraftRef || {};
    return {
      ...base,
      hook: document.getElementById('input-script-hook').value.trim(),
      characters: parseCharactersInput(document.getElementById('input-script-characters').value),
      scenes: collectScenesFromDom(),
      cta: document.getElementById('input-script-cta').value.trim(),
      caption_draft: document.getElementById('input-script-caption').value.trim()
    };
  }

  function renderAuditCard(dimasArt, project) {
    const card = document.getElementById('script-dimas-audit-card');
    if (!card) return;

    if (!dimasArt || !dimasArt.content) {
      card.innerHTML = `
        <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
          DIMAS belum mengaudit naskah proyek ini (Langkah saat ini: ${esc(project.current_step)}/12).
        </div>
      `;
      return;
    }

    const c = dimasArt.content;
    const isPass = c.verdict === 'PASS';
    const issues = Array.isArray(c.factual_issues) ? c.factual_issues : [];

    card.innerHTML = `
      <div class="p-3.5 rounded-2xl border ${
        isPass ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/80 border-amber-200'
      } space-y-1.5 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-extrabold ${isPass ? 'text-emerald-800' : 'text-amber-900'}">
            ${isPass ? '✅ Audit DIMAS: LAYAK (PASS)' : '⚠️ Audit DIMAS: PERLU REVISI'}
          </span>
          <span class="px-2 py-0.5 rounded-full bg-white text-[11px] font-bold text-slate-700 border border-slate-200">
            Hook: ${esc(c.hook_score ?? '-')}/10 • Pacing: ${esc(c.pacing_score ?? '-')}/10
          </span>
        </div>
        <p class="text-slate-700"><strong>Catatan DIMAS:</strong> ${esc(c.revision_notes || '-')}</p>
        ${
          issues.length > 0
            ? `<ul class="list-disc list-inside text-rose-700">${issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
            : ''
        }
      </div>
    `;
  }

  function render() {
    const wf = Nexora.workflowEngine;
    if (!wf) return;

    const projects = getScriptProjects(wf);
    const selectEl = document.getElementById('select-script-project');
    const emptyEl = document.getElementById('script-empty-state');
    const workspaceEl = document.getElementById('script-workspace');
    const pillEl = document.getElementById('script-status-pill');

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
        .map(
          (p) =>
            `<option value="${esc(p.id)}" ${p.id === project.id ? 'selected' : ''}>${esc(p.title)} (Langkah ${esc(p.current_step)}/12)</option>`
        )
        .join('');
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (workspaceEl) workspaceEl.classList.remove('hidden');

    const artifacts = wf.getProjectArtifacts(project.id);
    const bimaArt = artifacts.find((a) => a.employee_id === 'bima');
    const dimasArt = artifacts.find((a) => a.employee_id === 'dimas');

    if (pillEl) {
      pillEl.textContent = project.current_step === 6
        ? 'Menunggu ACC Naskah Final'
        : `Langkah ${project.current_step}/12 • Versi ${bimaArt ? bimaArt.version : 0}`;
    }

    renderAuditCard(dimasArt, project);

    const sig = `${project.id}:${bimaArt ? bimaArt.id : 'none'}`;
    if (sig !== lastFormSignature) {
      lastFormSignature = sig;
      const draft = (bimaArt && bimaArt.content) || project.final_script || {
        hook: '',
        characters: [],
        scenes: [],
        cta: '',
        caption_draft: ''
      };
      currentDraftRef = draft;

      document.getElementById('input-script-hook').value = draft.hook || '';
      document.getElementById('input-script-characters').value = formatCharactersInput(draft.characters);
      document.getElementById('input-script-cta').value = draft.cta || '';
      document.getElementById('input-script-caption').value = draft.caption_draft || '';
      renderScenesEditor(draft.scenes || []);
    }

    const btnApprove = document.getElementById('btn-script-approve-final');
    const btnReaudit = document.getElementById('btn-script-reaudit');
    const btnRevise = document.getElementById('btn-script-bima-revise');
    const btnSave = document.getElementById('btn-save-script-edit');

    const busy = wf.isStepRunning;
    [btnApprove, btnReaudit, btnRevise, btnSave].forEach((b) => {
      if (!b) return;
      b.disabled = busy;
      b.classList.toggle('opacity-50', busy);
    });

    if (btnApprove) {
      const canApproveFinal = project.current_step === 6 && !busy;
      btnApprove.classList.toggle('hidden', project.current_step !== 6);
      btnApprove.disabled = !canApproveFinal;
    }
  }

  function init() {
    const selectEl = document.getElementById('select-script-project');
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        selectedProjectId = e.target.value;
        lastFormSignature = '';
        render();
      });
    }

    const btnAddScene = document.getElementById('btn-add-script-scene');
    if (btnAddScene) {
      btnAddScene.addEventListener('click', () => {
        const scenes = collectScenesFromDom();
        scenes.push({
          scene_no: scenes.length + 1,
          duration_sec: 5,
          speaker: 'Tokoh Utama',
          dialogue: '',
          visual_direction: ''
        });
        renderScenesEditor(scenes);
      });
    }

    const btnSave = document.getElementById('btn-save-script-edit');
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        if (!selectedProjectId) return;
        await Nexora.workflowEngine.saveEditedScript(selectedProjectId, collectEditedScript());
      });
    }

    const btnReaudit = document.getElementById('btn-script-reaudit');
    if (btnReaudit) {
      btnReaudit.addEventListener('click', async () => {
        if (!selectedProjectId) return;
        await Nexora.workflowEngine.saveEditedScript(selectedProjectId, collectEditedScript());
        await Nexora.workflowEngine.requestDimasReAudit(selectedProjectId);
      });
    }

    const btnRevise = document.getElementById('btn-script-bima-revise');
    if (btnRevise) {
      btnRevise.addEventListener('click', async () => {
        if (!selectedProjectId) return;
        const noteEl = document.getElementById('input-script-director-note');
        const note = noteEl ? noteEl.value : '';
        await Nexora.workflowEngine.requestBimaRevision(selectedProjectId, note);
        if (noteEl) noteEl.value = '';
      });
    }

    const btnApprove = document.getElementById('btn-script-approve-final');
    if (btnApprove) {
      btnApprove.addEventListener('click', async () => {
        if (!selectedProjectId) return;
        const wf = Nexora.workflowEngine;
        await wf.saveEditedScript(selectedProjectId, collectEditedScript());
        wf.setActiveProject(selectedProjectId);
        await wf.approveCurrentGate();
      });
    }

    const btnToIdea = document.getElementById('btn-script-to-ideabank');
    if (btnToIdea) {
      btnToIdea.addEventListener('click', () => Nexora.navigation.navigateTo('idea-bank'));
    }

    if (Nexora.workflowEngine) {
      Nexora.workflowEngine.subscribe(render);
    }
    render();
  }

  Nexora.scriptManagementView = { init, render };

})(window.Nexora = window.Nexora || {});