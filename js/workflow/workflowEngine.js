(function (Nexora) {
  'use strict';

  const WORKFLOW_STORAGE_KEY = 'nexora_workflow_v2';
  const S = Nexora.STATUS;

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function formatNow() {
    return new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function todayDateStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function toBulletLines(arr, prefix = '• ') {
    if (!Array.isArray(arr) || arr.length === 0) return '• (Tidak ada data)';
    return arr.map((item) => `${prefix}${typeof item === 'object' ? JSON.stringify(item) : item}`).join('\n');
  }

  function formatScenesText(scenes) {
    if (!Array.isArray(scenes) || scenes.length === 0) return '1. (Belum ada adegan)';
    return scenes
      .map((sc, idx) => {
        if (typeof sc === 'string') return `${idx + 1}. ${sc}`;
        const no = sc.scene_no || idx + 1;
        const dur = sc.duration_sec ? ` (${sc.duration_sec}d)` : '';
        const spk = sc.speaker ? `[${sc.speaker}] ` : '';
        const dlg = sc.dialogue || sc.narration || sc.text || '';
        const vis = sc.visual_direction ? `\n   🎥 Visual: ${sc.visual_direction}` : '';
        return `${no}.${dur} ${spk}${dlg}${vis}`;
      })
      .join('\n');
  }

  class WorkflowEngine {
    constructor() {
      this.listeners = [];
      this.projects = [];
      this.activeProjectId = null;
      this.tasksByProject = {};
      this.artifactsByProject = {};
      this.schedulesByProject = {};
      this.latestFeedback = null;
      this.isStepRunning = false;
      this.hookedState = false;
    }

    init() {
      this.loadLocal();
      this.hookDirectorModalDecisions();
      this.emit();
    }

    subscribe(fn) {
      this.listeners.push(fn);
      return () => {
        this.listeners = this.listeners.filter((l) => l !== fn);
      };
    }

    emit() {
      this.saveLocal();
      this.listeners.forEach((fn) => fn(this));
    }

    isCloudMode() {
      return Boolean(Nexora.supabaseService && Nexora.supabaseService.isAuthenticated());
    }

    saveLocal() {
      try {
        const payload = {
          activeProjectId: this.activeProjectId,
          projects: this.projects.slice(0, 20),
          tasksByProject: this.tasksByProject,
          artifactsByProject: this.artifactsByProject,
          schedulesByProject: this.schedulesByProject,
          latestFeedback: this.latestFeedback
        };
        localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        // Abaikan error storage
      }
    }

    loadLocal() {
      try {
        const raw = localStorage.getItem(WORKFLOW_STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return;
        if (Array.isArray(data.projects)) this.projects = data.projects;
        if (typeof data.activeProjectId === 'string') this.activeProjectId = data.activeProjectId;
        if (data.tasksByProject && typeof data.tasksByProject === 'object') {
          this.tasksByProject = data.tasksByProject;
        }
        if (data.artifactsByProject && typeof data.artifactsByProject === 'object') {
          this.artifactsByProject = data.artifactsByProject;
        }
        if (data.schedulesByProject && typeof data.schedulesByProject === 'object') {
          this.schedulesByProject = data.schedulesByProject;
        }
        if (data.latestFeedback) this.latestFeedback = data.latestFeedback;
      } catch (err) {
        // Abaikan JSON corrupt
      }
    }

    getActiveProject() {
      if (!this.activeProjectId) return this.projects[0] || null;
      return this.projects.find((p) => p.id === this.activeProjectId) || this.projects[0] || null;
    }

    getProjectTasks(projectId) {
      return this.tasksByProject[projectId] || [];
    }

    getProjectArtifacts(projectId) {
      return this.artifactsByProject[projectId] || [];
    }

    getAllArtifactsByType(artifactType) {
      const items = [];
      this.projects.forEach((proj) => {
        const list = this.getProjectArtifacts(proj.id);
        list.forEach((art) => {
          if (art.artifact_type === artifactType) {
            items.push({ project: proj, artifact: art });
          }
        });
      });
      return items.sort((a, b) => new Date(b.artifact.created_at) - new Date(a.artifact.created_at));
    }

    getProjectSchedule(projectId) {
      const proj = this.projects.find((p) => p.id === projectId);
      const saved = this.schedulesByProject[projectId] || {};
      const defaultStatus = proj && proj.published_at
        ? 'Posted'
        : proj && proj.current_step >= 9
          ? 'Ready'
          : 'Planned';

      return {
        date: saved.date || (proj && proj.published_at ? proj.published_at.slice(0, 10) : todayDateStr()),
        time: saved.time || '19:00',
        platform: saved.platform || (proj ? proj.target_platform : 'TikTok / Reels / Shorts'),
        status: saved.status || defaultStatus
      };
    }

    setProjectSchedule(projectId, schedulePatch) {
      const current = this.getProjectSchedule(projectId);
      this.schedulesByProject[projectId] = { ...current, ...schedulePatch };
      const proj = this.projects.find((p) => p.id === projectId);
      if (proj) {
        Nexora.state.addLog('MEL', `Memperbarui jadwal "${proj.title}" -> ${this.schedulesByProject[projectId].date} ${this.schedulesByProject[projectId].time} WIB.`);
      }
      this.emit();
    }

    getCalendarEntries() {
      return this.projects
        .map((proj) => ({
          project: proj,
          schedule: this.getProjectSchedule(proj.id)
        }))
        .sort((a, b) => `${a.schedule.date} ${a.schedule.time}`.localeCompare(`${b.schedule.date} ${b.schedule.time}`));
    }

    setActiveProject(projectId) {
      this.activeProjectId = projectId;
      this.emit();
      if (this.isCloudMode() && projectId) {
        this.syncProjectDetailsFromCloud(projectId);
      }
    }

    async syncFromCloud() {
      if (!this.isCloudMode()) return;
      try {
        const svc = Nexora.supabaseService;
        const projects = await svc.listProjects(20);
        this.projects = projects;

        if (!this.activeProjectId || !projects.some((p) => p.id === this.activeProjectId)) {
          this.activeProjectId = projects[0] ? projects[0].id : null;
        }

        if (this.activeProjectId) {
          await this.syncProjectDetailsFromCloud(this.activeProjectId);
        }

        const logs = await svc.listActivityLogs(20);
        if (logs.length > 0) {
          Nexora.state.activityLogs = logs.map((l) => ({
            time: new Date(l.created_at).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
            actor: l.actor,
            message: l.message
          }));
          Nexora.state.emit('update');
        }

        if (Nexora.aiService) {
          Nexora.aiService.fetchUsageLogs(20).catch(() => {});
        }

        svc.subscribeStudioChanges((table, payload) => {
          this.handleRealtimeEvent(table, payload);
        });

        this.emit();
      } catch (err) {
        Nexora.state.pushNotification(`Gagal sinkronisasi Supabase: ${err.message}`, 'error');
      }
    }

    async syncProjectDetailsFromCloud(projectId) {
      if (!this.isCloudMode() || !projectId) return;
      try {
        const svc = Nexora.supabaseService;
        const [tasks, artifacts] = await Promise.all([
          svc.listTasksByProject(projectId),
          svc.listArtifactsByProject(projectId)
        ]);
        this.tasksByProject[projectId] = tasks;
        this.artifactsByProject[projectId] = artifacts;
        this.emit();
      } catch (err) {
        // Pertahankan cache lokal
      }
    }

    handleRealtimeEvent(table, payload) {
      if (!payload || !payload.new) return;
      if (table === 'content_projects') {
        const idx = this.projects.findIndex((p) => p.id === payload.new.id);
        if (idx >= 0) this.projects[idx] = payload.new;
        else this.projects.unshift(payload.new);
        this.emit();
      } else if (table === 'agent_tasks') {
        const pid = payload.new.project_id;
        const list = this.tasksByProject[pid] || [];
        const idx = list.findIndex((t) => t.id === payload.new.id);
        if (idx >= 0) list[idx] = payload.new;
        else list.push(payload.new);
        this.tasksByProject[pid] = list;
        this.emit();
      }
    }

    pauseRandomAutoSim() {
      if (Nexora.state.autoSimEnabled) {
        Nexora.state.autoSimEnabled = false;
        Nexora.state.addLog('SISTEM', 'Pipeline Workflow aktif — simulasi acak dijeda otomatis.');
        Nexora.state.emit('update');
      }
    }

    async createProject({ title, niche, targetPlatform, autoStart = true, keywords = '' }) {
      const cleanTitle = String(title || '').trim();
      if (!cleanTitle) {
        Nexora.state.pushNotification('Judul proyek konten wajib diisi.', 'warning');
        return null;
      }

      const cleanNiche = String(niche || 'AI & Produktivitas').trim();
      const cleanPlatform = String(targetPlatform || 'TikTok / Reels / Shorts').trim();

      let project;
      if (this.isCloudMode()) {
        project = await Nexora.supabaseService.createProject({
          title: cleanTitle,
          niche: cleanNiche,
          targetPlatform: cleanPlatform
        });
        await Nexora.supabaseService.addActivityLog({
          projectId: project.id,
          actor: 'DIREKTUR',
          level: 'info',
          message: `Membuat proyek konten baru: "${cleanTitle}"`
        });
      } else {
        project = {
          id: uid(),
          title: cleanTitle,
          niche: cleanNiche,
          target_platform: cleanPlatform,
          current_step: 1,
          status: 'active',
          selected_idea: null,
          final_script: null,
          production_pack: null,
          publish_package: null,
          performance_metrics: null,
          published_at: null,
          created_at: new Date().toISOString()
        };
      }

      project._keywords = String(keywords || '').trim();
      this.projects.unshift(project);
      this.activeProjectId = project.id;
      this.tasksByProject[project.id] = [];
      this.artifactsByProject[project.id] = [];

      Nexora.state.addLog('DIREKTUR', `Memulai proyek konten: "${cleanTitle}" (${cleanNiche}).`);
      Nexora.state.pushNotification(`Proyek "${cleanTitle}" dibuat. RAKA memulai riset tren.`, 'info');
      this.emit();

      if (autoStart) {
        await this.runCurrentStep({ keywords: project._keywords });
      }
      return project;
    }

    async runTrendResearchOnly({ topic, niche, keywords = '', targetPlatform = 'TikTok / Reels / Shorts' }) {
      const title = String(topic || '').trim() || `Riset Tren: ${niche || 'AI & Produktivitas'}`;
      return this.createProject({
        title,
        niche: niche || 'AI & Produktivitas',
        targetPlatform,
        keywords,
        autoStart: true
      });
    }

    async selectIdeaAndApprove(projectId, ideaIndex = 0) {
      if (this.isStepRunning) return;
      const project = this.projects.find((p) => p.id === projectId) || this.getActiveProject();
      if (!project) return;

      this.activeProjectId = project.id;
      const artifacts = this.getProjectArtifacts(project.id);
      const sariArt = artifacts.find((a) => a.employee_id === 'sari');
      const ideas = sariArt && sariArt.content && Array.isArray(sariArt.content.ideas) ? sariArt.content.ideas : [];
      const chosenIdea = ideas[ideaIndex] || ideas[0] || { title: project.title };

      const sariEmp = Nexora.state.getEmployee('sari');
      if (sariEmp && sariEmp.status === S.WAITING_APPROVAL) {
        Nexora.state.approveEmployeeWork('sari');
      }

      if (sariArt) {
        sariArt.approved_by_director = true;
      }

      const patch = {
        current_step: 4,
        status: 'active',
        selected_idea: chosenIdea
      };

      if (this.isCloudMode()) {
        await Nexora.supabaseService.addActivityLog({
          projectId: project.id,
          actor: 'DIREKTUR',
          level: 'success',
          message: `Memilih ide "${chosenIdea.title || project.title}" untuk ditulis BIMA.`
        });
      }

      Nexora.state.addLog('DIREKTUR', `Memilih ide: "${chosenIdea.title || project.title}" -> diserahkan ke BIMA.`);
      await this.updateProjectState(project, patch);
      this.emit();
      await this.runCurrentStep();
    }

    async saveEditedScript(projectId, updatedContent) {
      const project = this.projects.find((p) => p.id === projectId);
      if (!project) return;

      const list = this.getProjectArtifacts(projectId);
      const bimaArt = list.find((a) => a.employee_id === 'bima');
      const nextVersion = bimaArt ? Number(bimaArt.version || 1) + 1 : 1;

      const newArtifact = {
        id: uid(),
        project_id: project.id,
        task_id: bimaArt ? bimaArt.task_id : null,
        employee_id: 'bima',
        artifact_type: 'script_draft',
        version: nextVersion,
        content: { ...updatedContent, version: nextVersion, edited_by_director: true },
        source_mode: bimaArt ? bimaArt.source_mode : 'manual_edit',
        approved_by_director: false,
        created_at: new Date().toISOString()
      };

      if (this.isCloudMode() && newArtifact.task_id) {
        await Nexora.supabaseService.saveArtifact({
          project_id: project.id,
          task_id: newArtifact.task_id,
          employee_id: 'bima',
          artifact_type: 'script_draft',
          version: nextVersion,
          content: newArtifact.content,
          approved_by_director: false
        });
      }

      this.artifactsByProject[project.id] = [newArtifact, ...list];
      const bimaEmp = Nexora.state.getEmployee('bima');
      if (bimaEmp) {
        this.syncEmployeeToCanvas(
          bimaEmp,
          S.COMPLETED,
          100,
          `[${project.title}] Naskah Diedit Direktur (v${nextVersion})`,
          this.formatPayloadText({ actor: 'bima', type: 'agent_task' }, newArtifact.content)
        );
      }

      Nexora.state.addLog('DIREKTUR', `Menyimpan revisi manual naskah "${project.title}" (v${nextVersion}).`);
      Nexora.state.pushNotification(`Naskah versi ${nextVersion} disimpan!`, 'success', 'bima');
      this.emit();
    }

    async requestBimaRevision(projectId, revisionNotes) {
      if (this.isStepRunning) return;
      const project = this.projects.find((p) => p.id === projectId);
      if (!project) return;

      this.activeProjectId = project.id;
      await this.updateProjectState(project, { current_step: 4, status: 'active' });
      await this.runCurrentStep({
        revisionNotes: String(revisionNotes || '').trim() || 'Pertajam hook awal dan rapikan dialog antar tokoh.'
      });
    }

    async requestDimasReAudit(projectId) {
      if (this.isStepRunning) return;
      const project = this.projects.find((p) => p.id === projectId);
      if (!project) return;

      this.activeProjectId = project.id;
      await this.updateProjectState(project, { current_step: 5, status: 'active' });
      await this.runCurrentStep();
    }

    async runCurrentStep(options = {}) {
      if (this.isStepRunning) return;
      const project = this.getActiveProject();
      if (!project) {
        Nexora.state.pushNotification('Belum ada proyek aktif. Buat proyek konten terlebih dahulu.', 'warning');
        return;
      }

      const stepCfg = Nexora.getWorkflowStep(project.current_step);
      if (!stepCfg) return;

      if (stepCfg.type === 'approval_gate' || stepCfg.type === 'manual_publish') {
        Nexora.state.pushNotification(
          `Langkah ${stepCfg.step} (${stepCfg.label}) menunggu aksi Direktur.`,
          'warning',
          stepCfg.sourceEmployeeId || null
        );
        return;
      }

      this.pauseRandomAutoSim();
      this.isStepRunning = true;
      this.emit();

      try {
        if (stepCfg.type === 'feedback_loop') {
          await this.executeFeedbackLoopStep(project, stepCfg);
        } else {
          await this.executeAgentStep(project, stepCfg, options);
        }
      } finally {
        this.isStepRunning = false;
        this.emit();
      }
    }

    async executeAgentStep(project, stepCfg, options = {}) {
      const empId = stepCfg.actor;
      const emp = Nexora.state.getEmployee(empId);
      const profile = Nexora.getAgentProfile(empId);
      if (!emp || !profile) return;

      const existingTasks = this.getProjectTasks(project.id);
      const prevAttempts = existingTasks.filter((t) => t.step_order === stepCfg.step).length;
      const attemptCount = prevAttempts + 1;

      const inputPayload = this.buildStepInput(project, stepCfg, options.revisionNotes || null, options.keywords || project._keywords || '');
      const taskTitle = `[${project.title}] ${stepCfg.label}`;

      let taskRecord = {
        id: uid(),
        project_id: project.id,
        employee_id: empId,
        step_order: stepCfg.step,
        task_type: stepCfg.type,
        title: taskTitle,
        status: profile.isReviewer ? S.REVIEWING : S.WORKING,
        progress: 15,
        input_payload: inputPayload,
        output_payload: null,
        revision_notes: options.revisionNotes || null,
        attempt_count: attemptCount,
        max_attempts: 3,
        error_message: null,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      if (this.isCloudMode()) {
        taskRecord = await Nexora.supabaseService.createTask({
          project_id: project.id,
          employee_id: empId,
          step_order: stepCfg.step,
          task_type: stepCfg.type,
          title: taskTitle,
          status: taskRecord.status,
          progress: 15,
          input_payload: inputPayload,
          revision_notes: options.revisionNotes || null,
          attempt_count: attemptCount,
          started_at: taskRecord.started_at
        });
      }

      this.upsertLocalTask(project.id, taskRecord);
      this.syncEmployeeToCanvas(emp, taskRecord.status, 15, taskTitle, `Memproses langkah ${stepCfg.step}: ${stepCfg.label}...`);
      Nexora.state.setSpeech(emp, profile.isReviewer ? 'Mengaudit...' : 'Mengerjakan...', 180);
      Nexora.state.addLog(emp.name, `Menjalankan Langkah ${stepCfg.step}: ${stepCfg.label} (Percobaan #${attemptCount}).`);

      await this.delay(450);
      taskRecord.progress = 55;
      this.syncEmployeeToCanvas(emp, taskRecord.status, 55, taskTitle, `Menjalankan AI Agent (${emp.name}) untuk ${stepCfg.label}...`);
      if (this.isCloudMode()) {
        await Nexora.supabaseService.updateTask(taskRecord.id, { progress: 55 });
      }

      let outputPayload = null;
      let usedLiveAI = false;
      let aiMetaText = 'Mode Simulasi';

      if (Nexora.aiService && Nexora.aiService.isLiveAIAvailable()) {
        try {
          const aiResult = await Nexora.aiService.runAgent({
            employeeId: empId,
            projectId: project.id,
            taskId: taskRecord.id,
            stepOrder: stepCfg.step,
            taskTitle,
            inputPayload,
            revisionNotes: options.revisionNotes || null
          });
          outputPayload = aiResult.output;
          usedLiveAI = true;
          const totalTok = (aiResult.usage?.prompt_tokens || 0) + (aiResult.usage?.completion_tokens || 0);
          aiMetaText = `Live AI (${aiResult.model} • ${totalTok} token)`;
          Nexora.state.addLog(emp.name, `Output AI diterima (${aiMetaText}).`);
          Nexora.aiService.fetchUsageLogs(20).catch(() => {});
        } catch (aiErr) {
          Nexora.state.addLog('SISTEM', `AI Edge Function fallback ke simulasi (${aiErr.message}).`);
          Nexora.state.pushNotification(`Live AI belum aktif (${aiErr.message}) — memakai fallback simulasi.`, 'warning', emp.id);
        }
      }

      if (!outputPayload) {
        await this.delay(550);
        outputPayload = this.generateStepOutput(project, stepCfg, inputPayload, attemptCount);
      }

      const formattedText = `✨ Sumber: ${aiMetaText}\n\n` + this.formatPayloadText(stepCfg, outputPayload);

      const artifact = {
        id: uid(),
        project_id: project.id,
        task_id: taskRecord.id,
        employee_id: empId,
        artifact_type: stepCfg.artifactType,
        version: attemptCount,
        content: outputPayload,
        source_mode: usedLiveAI ? 'live_ai' : 'simulation',
        approved_by_director: false,
        created_at: new Date().toISOString()
      };

      if (this.isCloudMode()) {
        await Nexora.supabaseService.saveArtifact({
          project_id: project.id,
          task_id: taskRecord.id,
          employee_id: empId,
          artifact_type: stepCfg.artifactType,
          version: attemptCount,
          content: outputPayload,
          approved_by_director: false
        });
      }
      this.artifactsByProject[project.id] = [artifact, ...(this.artifactsByProject[project.id] || [])];

      if (stepCfg.type === 'review_loop' && outputPayload.verdict === 'NEEDS_REVISION' && attemptCount < 3) {
        taskRecord.status = S.COMPLETED;
        taskRecord.progress = 100;
        taskRecord.output_payload = outputPayload;
        taskRecord.completed_at = new Date().toISOString();

        if (this.isCloudMode()) {
          await Nexora.supabaseService.updateTask(taskRecord.id, {
            status: S.COMPLETED,
            progress: 100,
            output_payload: outputPayload,
            completed_at: taskRecord.completed_at
          });
          await Nexora.supabaseService.addActivityLog({
            projectId: project.id,
            actor: emp.name,
            level: 'warning',
            message: `Meminta revisi kembali ke Langkah ${stepCfg.revisionStep}: ${outputPayload.revision_notes}`
          });
        }

        this.upsertLocalTask(project.id, taskRecord);
        this.syncEmployeeToCanvas(emp, S.COMPLETED, 100, taskTitle, formattedText);
        Nexora.state.setSpeech(emp, 'Minta revisi!', 180);
        Nexora.state.addLog(emp.name, `Mengembalikan ke Langkah ${stepCfg.revisionStep}: ${outputPayload.revision_notes}`);
        Nexora.state.pushNotification(`${emp.name} menemukan poin revisi — mengulang Langkah ${stepCfg.revisionStep}.`, 'warning', emp.id);

        await this.updateProjectState(project, { current_step: stepCfg.revisionStep, status: 'active' });
        await this.delay(450);
        const nextCfg = Nexora.getWorkflowStep(project.current_step);
        if (nextCfg) {
          await this.executeAgentStep(project, nextCfg, { revisionNotes: outputPayload.revision_notes });
        }
        return;
      }

      const nextStepCfg = Nexora.getWorkflowStep(stepCfg.nextStep);
      const nextIsDirectorGate = nextStepCfg && (nextStepCfg.type === 'approval_gate' || nextStepCfg.type === 'manual_publish');

      const finalTaskStatus = nextIsDirectorGate ? S.WAITING_APPROVAL : S.COMPLETED;
      taskRecord.status = finalTaskStatus;
      taskRecord.progress = 100;
      taskRecord.output_payload = outputPayload;
      taskRecord.completed_at = new Date().toISOString();

      if (this.isCloudMode()) {
        await Nexora.supabaseService.updateTask(taskRecord.id, {
          status: finalTaskStatus,
          progress: 100,
          output_payload: outputPayload,
          completed_at: taskRecord.completed_at
        });
        await Nexora.supabaseService.addActivityLog({
          projectId: project.id,
          actor: emp.name,
          level: nextIsDirectorGate ? 'warning' : 'success',
          message: `Menyelesaikan Langkah ${stepCfg.step} (${stepCfg.label}) [${aiMetaText}].`
        });
      }

      this.upsertLocalTask(project.id, taskRecord);
      this.syncEmployeeToCanvas(emp, finalTaskStatus, 100, taskTitle, formattedText);

      if (nextIsDirectorGate) {
        Nexora.state.setSpeech(emp, 'Butuh ACC Bos!', 240);
        Nexora.state.pushNotification(
          `${emp.name} selesai (${stepCfg.label}) & menunggu keputusan Direktur!`,
          'warning',
          emp.id
        );
        const projStatus = nextStepCfg.type === 'manual_publish' ? 'ready_to_publish' : 'waiting_director';
        const patch = { current_step: nextStepCfg.step, status: projStatus };
        if (empId === 'mel') {
          patch.publish_package = outputPayload;
          this.setProjectSchedule(project.id, { status: 'Ready' });
        }
        await this.updateProjectState(project, patch);
      } else {
        Nexora.state.incrementMetricsFor(emp.id);
        Nexora.state.setSpeech(emp, 'Selesai! ✓', 150);
        Nexora.state.addLog(emp.name, `Menyerahkan hasil ke Langkah ${stepCfg.nextStep}.`);
        const patch = { current_step: stepCfg.nextStep, status: 'active' };
        if (empId === 'laras') patch.production_pack = outputPayload;
        if (empId === 'dina') patch.performance_metrics = outputPayload;
        await this.updateProjectState(project, patch);

        if (nextStepCfg) {
          await this.delay(400);
          if (nextStepCfg.type === 'feedback_loop') {
            await this.executeFeedbackLoopStep(project, nextStepCfg);
          } else if (nextStepCfg.type === 'agent_task' || nextStepCfg.type === 'review_loop') {
            await this.executeAgentStep(project, nextStepCfg);
          }
        }
      }
    }

    async executeFeedbackLoopStep(project, stepCfg) {
      const dina = Nexora.state.getEmployee('dina');
      const perf = project.performance_metrics || this.generateStepOutput(project, Nexora.getWorkflowStep(11), {}, 1);

      this.latestFeedback = {
        fromProjectId: project.id,
        fromTitle: project.title,
        createdAt: new Date().toISOString(),
        recommendations: perf.next_cycle_recommendations || [
          'Pertahankan hook visual 3 detik pertama',
          'Fokus pada studi kasus praktis pengguna Android'
        ]
      };

      ['raka', 'sari'].forEach((targetId) => {
        const target = Nexora.state.getEmployee(targetId);
        if (target) {
          target.history.unshift({
            time: formatNow(),
            text: `Menerima feedback siklus dari DINA (Proyek: ${project.title})`
          });
          Nexora.state.setSpeech(target, 'Insight diterima!', 160);
        }
      });

      if (dina) {
        this.syncEmployeeToCanvas(
          dina,
          S.COMPLETED,
          100,
          'Feedback Loop -> RAKA & SARI',
          this.formatPayloadText(stepCfg, this.latestFeedback)
        );
      }

      if (this.isCloudMode()) {
        await Nexora.supabaseService.addActivityLog({
          projectId: project.id,
          actor: 'DINA',
          level: 'success',
          message: `Feedback Loop dikirim ke RAKA & SARI dari proyek "${project.title}".`
        });
      }

      await this.updateProjectState(project, { current_step: 12, status: 'completed' });
      Nexora.state.addLog('DINA', 'Siklus 12 langkah selesai! Insight dikirim ke RAKA & SARI.');
      Nexora.state.pushNotification(`Proyek "${project.title}" tuntas 12 langkah! Insight DINA siap untuk siklus baru.`, 'success', 'dina');
    }

    async approveCurrentGate(revisionOrPublishNotes = null) {
      if (this.isStepRunning) return;
      const project = this.getActiveProject();
      if (!project) return;
      const stepCfg = Nexora.getWorkflowStep(project.current_step);
      if (!stepCfg || (stepCfg.type !== 'approval_gate' && stepCfg.type !== 'manual_publish')) return;

      const sourceEmp = Nexora.state.getEmployee(stepCfg.sourceEmployeeId);
      if (sourceEmp && sourceEmp.status === S.WAITING_APPROVAL) {
        Nexora.state.approveEmployeeWork(sourceEmp.id);
      }

      const artifacts = this.getProjectArtifacts(project.id);
      const latestArtifact = artifacts.find((a) => a.employee_id === stepCfg.sourceEmployeeId);
      if (latestArtifact) {
        latestArtifact.approved_by_director = true;
      }

      const patch = { current_step: stepCfg.nextStep, status: 'active' };
      if (stepCfg.step === 3 && latestArtifact) {
        patch.selected_idea = latestArtifact.content.ideas ? latestArtifact.content.ideas[0] : latestArtifact.content;
      } else if (stepCfg.step === 6) {
        const bimaArtifact = artifacts.find((a) => a.employee_id === 'bima');
        patch.final_script = bimaArtifact ? bimaArtifact.content : (latestArtifact ? latestArtifact.content : null);
      } else if (stepCfg.step === 10) {
        patch.published_at = new Date().toISOString();
        this.setProjectSchedule(project.id, { status: 'Posted', date: todayDateStr() });
        Nexora.state.addLog('DIREKTUR', `Mempublikasikan konten "${project.title}" secara manual (${revisionOrPublishNotes || 'Prime-time slot'}).`);
      }

      if (this.isCloudMode()) {
        await Nexora.supabaseService.addActivityLog({
          projectId: project.id,
          actor: 'DIREKTUR',
          level: 'success',
          message: `Menyetujui Langkah ${stepCfg.step}: ${stepCfg.label}`
        });
      }

      await this.updateProjectState(project, patch);
      this.emit();
      await this.runCurrentStep();
    }

    async rejectCurrentGate(revisionNotes) {
      if (this.isStepRunning) return;
      const project = this.getActiveProject();
      if (!project) return;
      const stepCfg = Nexora.getWorkflowStep(project.current_step);
      if (!stepCfg || !stepCfg.rejectStep) return;

      const notes = String(revisionNotes || '').trim() || 'Perkuat hook dan perjelas pesan utama sesuai arahan Direktur.';
      const sourceEmp = Nexora.state.getEmployee(stepCfg.sourceEmployeeId);
      if (sourceEmp && sourceEmp.status === S.WAITING_APPROVAL) {
        Nexora.state.rejectEmployeeWork(sourceEmp.id);
      }

      if (this.isCloudMode()) {
        await Nexora.supabaseService.addActivityLog({
          projectId: project.id,
          actor: 'DIREKTUR',
          level: 'warning',
          message: `Menolak Langkah ${stepCfg.step}, mengembalikan ke Langkah ${stepCfg.rejectStep}: ${notes}`
        });
      }

      await this.updateProjectState(project, { current_step: stepCfg.rejectStep, status: 'active' });
      this.emit();
      await this.runCurrentStep({ revisionNotes: notes });
    }

    hookDirectorModalDecisions() {
      if (this.hookedState) return;
      this.hookedState = true;

      const origApprove = Nexora.state.approveEmployeeWork.bind(Nexora.state);
      Nexora.state.approveEmployeeWork = (id) => {
        const emp = Nexora.state.getEmployee(id);
        const wasWaiting = emp && emp.status === S.WAITING_APPROVAL;
        origApprove(id);
        if (wasWaiting) {
          this.handleModalDecision(id, true);
        }
      };

      const origReject = Nexora.state.rejectEmployeeWork.bind(Nexora.state);
      Nexora.state.rejectEmployeeWork = (id) => {
        const emp = Nexora.state.getEmployee(id);
        const wasWaiting = emp && emp.status === S.WAITING_APPROVAL;
        origReject(id);
        if (wasWaiting) {
          this.handleModalDecision(id, false);
        }
      };
    }

    handleModalDecision(empId, approved) {
      const project = this.getActiveProject();
      if (!project) return;
      const stepCfg = Nexora.getWorkflowStep(project.current_step);
      if (!stepCfg || stepCfg.sourceEmployeeId !== empId) return;

      if (approved) {
        this.approveCurrentGate();
      } else {
        this.rejectCurrentGate('Direktur meminta revisi melalui panel inspeksi karyawan.');
      }
    }

    buildStepInput(project, stepCfg, revisionNotes, keywords = '') {
      const artifacts = this.getProjectArtifacts(project.id);
      const findArt = (empId) => {
        const found = artifacts.find((a) => a.employee_id === empId);
        return found ? found.content : null;
      };

      return {
        projectTitle: project.title,
        niche: project.niche,
        keywords,
        targetPlatform: project.target_platform,
        revisionNotes,
        dinaFeedback: this.latestFeedback,
        trendReport: findArt('raka'),
        selectedIdea: project.selected_idea || findArt('sari'),
        scriptDraft: findArt('bima'),
        finalScript: project.final_script || findArt('bima'),
        productionPack: project.production_pack || findArt('laras'),
        publishPackage: project.publish_package || findArt('mel')
      };
    }

    generateStepOutput(project, stepCfg, input, attemptCount) {
      const actor = stepCfg.actor;
      const hasFeedback = Boolean(input.dinaFeedback && input.dinaFeedback.recommendations);
      const kwNote = input.keywords ? ` (Fokus kata kunci: ${input.keywords})` : '';

      if (actor === 'raka') {
        return {
          niche: project.niche,
          trends: [
            `Workflow ${project.niche}${kwNote} langsung dari HP Android (+148% pencarian)`,
            `Studi kasus "${project.title}" format video pendek 45 detik`,
            hasFeedback ? `Prioritas Riset (Feedback DINA): ${input.dinaFeedback.recommendations[0]}` : 'Format tutorial step-by-step layar HP'
          ],
          competitors: ['Kreator A (retensi tinggi di hook visual)', 'Kreator B (CTA komentar berantai)'],
          opportunities: ['Sudut pandang praktis tanpa perangkat mahal', 'Demo alur nyata yang mudah ditiru pemula']
        };
      }

      if (actor === 'sari') {
        return {
          ideas: [
            {
              title: `${project.title}: Cara Kerja Studio Konten AI di HP`,
              angle: 'Demo real-time alur kerja efisien untuk solopreneur',
              audience: `Kreator & praktisi ${project.niche}`,
              potential_score: 94
            },
            {
              title: `3 Kesalahan Umum di ${project.niche} & Solusi Otomatisnya`,
              angle: 'Edukasi cepat berbasis perbandingan sebelum-sesudah',
              audience: 'Pemula hingga menengah',
              potential_score: 89
            },
            {
              title: `Dari Riset Sampai Siap Posting Cuma 15 Menit (${project.niche})`,
              angle: 'Time-lapse workflow 8 peran spesialis',
              audience: 'Konten kreator sibuk & pemilik bisnis kecil',
              potential_score: 86
            }
          ]
        };
      }

      if (actor === 'bima') {
        const ideaTitle = input.selectedIdea && input.selectedIdea.title ? input.selectedIdea.title : project.title;
        return {
          version: attemptCount,
          hook: attemptCount > 1
            ? `[Hook Revisi v${attemptCount}] "Stop buang 3 jam ngedit manual—Dito baru buktiin cara ini cuma dari HP!"`
            : `"Kenapa ${ideaTitle} sering gagal di percobaan pertama? Ini yang kejadian sama Dito..."`,
          characters: [
            { name: 'Dito', voice_style: 'Anak muda santai & ekspresif' },
            { name: 'Pak Hendra', voice_style: 'Mentor tenang & berpengalaman' }
          ],
          scenes: [
            {
              scene_no: 1,
              duration_sec: 4,
              speaker: 'Dito',
              dialogue: 'Gue udah bikin belasan konten tiap minggu, tapi yang nonton tetep segitu-segitu aja.',
              visual_direction: 'Close-up Dito menatap layar HP di meja kerja sambil menghela napas.'
            },
            {
              scene_no: 2,
              duration_sec: 12,
              speaker: 'Pak Hendra',
              dialogue: 'Masalahnya bukan rajinnya, Dit. Tapi 3 detik pertama lu nggak bikin orang berhenti scroll.',
              visual_direction: 'Pak Hendra menunjuk grafik retensi penonton yang langsung anjlok di detik ke-2.'
            },
            {
              scene_no: 3,
              duration_sec: 14,
              speaker: 'Dito',
              dialogue: 'Begitu gue ubah pembukanya pakai konflik nyata dan alur yang terstruktur, penonton langsung betah sampai habis.',
              visual_direction: 'Transisi cepat ke layar HP menampilkan grafik naik & kolom komentar ramai.'
            }
          ],
          cta: 'Mau lihat lanjutannya di Bagian 2? Simpan video ini dan tulis pendapat lu di komentar!',
          caption_draft: `${ideaTitle} — ringkas, relevan, dan langsung bisa dipraktikkan di ${project.target_platform}.`,
          applied_revision: input.revisionNotes || null
        };
      }

      if (actor === 'dimas') {
        const needsFix = attemptCount === 1 && !input.revisionNotes && project.title.toLowerCase().includes('uji revisi');
        return {
          verdict: needsFix ? 'NEEDS_REVISION' : 'PASS',
          hook_score: needsFix ? 7.2 : 9.1,
          pacing_score: needsFix ? 7.5 : 8.9,
          factual_issues: [],
          revision_notes: needsFix
            ? 'Hook awal masih terlalu umum, pertajam konflik tokoh di 3 detik pertama.'
            : 'Hook kuat, dialog antar tokoh orisinal mengalir natural, siap disetujui Direktur.'
        };
      }

      if (actor === 'laras') {
        return {
          version: attemptCount,
          storyboard_scenes: [
            'Scene 1 (0-4s): Close-up tokoh utama dengan subtitle bold putih & tag nama pembicara',
            'Scene 2 (5-16s): Medium shot dialog interaktif + ilustrasi grafik/dokumen rapi',
            'Scene 3 (17-30s): Shot penutup dengan cliffhanger & ajakan CTA'
          ],
          asset_prompts: ['Karakter 3D stylized orisinal konsisten', 'Voiceover multi-suara + ambient music -18dB'],
          video_job_ref: `sim-render-${project.id.slice(0, 6)}-v${attemptCount}`
        };
      }

      if (actor === 'tio') {
        return {
          verdict: 'PASS',
          audio_check: 'Jernih (-14 LUFS), bebas clipping',
          subtitle_check: 'Sinkron 100% dan aman dari area tombol UI',
          revision_notes: 'Layak diteruskan ke MEL untuk persiapan publikasi.'
        };
      }

      if (actor === 'mel') {
        return {
          final_caption: `🚀 ${project.title}\n\nDari riset sampai siap tayang, semua tersusun rapi dalam satu alur kerja studio.\n\nSimpan agar tidak lupa!`,
          hashtags: ['#NexoraAIStudio', '#KontenKreator', '#ProduktivitasDigital', '#Storytelling'],
          recommended_slot: 'Hari ini, 19:00 WIB (Prime Time)',
          metadata: { platform: project.target_platform, category: project.niche }
        };
      }

      if (actor === 'dina') {
        return {
          views: 18400,
          retention_eval: '79% penonton bertahan melewati 3 detik pertama',
          engagement_rate: '6.8%',
          winning_patterns: ['Hook dialog konflik langsung di 3 detik pertama', 'Durasi padat & subtitle jelas'],
          next_cycle_recommendations: [
            `Buat seri Bagian 2 lanjutan dari "${project.title}"`,
            'Pertahankan gaya storytelling dua tokoh dengan sudut pandang baru'
          ]
        };
      }

      return { summary: 'Selesai' };
    }

    formatPayloadText(stepCfg, payload) {
      const p = payload || {};
      const actor = stepCfg ? stepCfg.actor : '';

      if (actor === 'raka') {
        return (
          `📌 Riset Tren (${p.niche || '-'})\n\n` +
          `🔥 Tren Naik:\n${toBulletLines(p.trends)}\n\n` +
          `🎯 Kompetitor:\n${toBulletLines(p.competitors)}\n\n` +
          `💎 Peluang Konten:\n${toBulletLines(p.opportunities)}`
        );
      }

      if (actor === 'sari') {
        const ideas = Array.isArray(p.ideas) ? p.ideas : [];
        const lines = ideas.map((idea, idx) =>
          `${idx + 1}. ${idea.title || '-'} (Skor Potensi: ${idea.potential_score || '-'}/100)\n` +
          `   • Sudut Pandang: ${idea.angle || '-'}\n` +
          `   • Target Audiens: ${idea.audience || '-'}`
        ).join('\n\n');
        return (
          `💡 Usulan Ide Konten SARI:\n\n${lines || 'Belum ada ide.'}\n\n` +
          `👉 Tekan "✓ Setujui Hasil" di atas (atau buka menu Idea Bank untuk memilih ide spesifik).`
        );
      }

      if (actor === 'bima') {
        const chars = Array.isArray(p.characters) && p.characters.length
          ? p.characters.map((c) => (typeof c === 'string' ? c : `${c.name} (${c.voice_style || 'natural'})`)).join(', ')
          : '-';
        return (
          `📝 Draf Naskah (Versi ${p.version || 1})\n` +
          `👥 Tokoh Cerita: ${chars}\n\n` +
          `🎣 Hook Pembuka:\n${p.hook || '-'}\n\n` +
          `🎬 Alur Adegan & Dialog:\n${formatScenesText(p.scenes)}\n\n` +
          `📣 Ajakan / Cliffhanger (CTA):\n${p.cta || '-'}\n\n` +
          `💬 Draf Caption:\n${p.caption_draft || '-'}`
        );
      }

      if (actor === 'dimas') {
        const statusText = p.verdict === 'PASS' ? 'LAYAK (PASS)' : 'PERLU REVISI';
        return (
          `🔍 Hasil Audit Naskah (DIMAS)\n\n` +
          `• Status Review: ${statusText}\n` +
          `• Skor Hook: ${p.hook_score ?? '-'}/10 | Skor Pacing: ${p.pacing_score ?? '-'}/10\n` +
          `• Catatan Audit: ${p.revision_notes || '-'}\n` +
          (Array.isArray(p.factual_issues) && p.factual_issues.length
            ? `• Catatan Fakta:\n${toBulletLines(p.factual_issues)}`
            : '• Akurasi & Nama Tokoh: Aman & orisinal.')
        );
      }

      if (actor === 'laras') {
        return (
          `🎬 Storyboard & Arahan Produksi (Versi ${p.version || 1})\n\n` +
          `🎞️ Adegan:\n${formatScenesText(p.storyboard_scenes)}\n\n` +
          `🎨 Kebutuhan Aset:\n${toBulletLines(p.asset_prompts)}\n\n` +
          `🔖 Kode Produksi: ${p.video_job_ref || '-'}`
        );
      }

      if (actor === 'tio') {
        const statusText = p.verdict === 'PASS' ? 'LAYAK TERBIT (PASS)' : 'PERLU PERBAIKAN';
        return (
          `✅ Laporan Quality Control Video (TIO)\n\n` +
          `• Status QC: ${statusText}\n` +
          `• Audio: ${p.audio_check || '-'}\n` +
          `• Subtitle: ${p.subtitle_check || '-'}\n` +
          `• Catatan: ${p.revision_notes || '-'}`
        );
      }

      if (actor === 'mel') {
        const tags = Array.isArray(p.hashtags) ? p.hashtags.join(' ') : '-';
        return (
          `📢 Paket Siap Publikasi (MEL)\n\n` +
          `• Rekomendasi Jam Tayang: ${p.recommended_slot || '-'}\n\n` +
          `✍️ Caption Final:\n${p.final_caption || '-'}\n\n` +
          `#️⃣ Hashtag:\n${tags}\n\n` +
          `👉 Silakan posting manual lalu tekan "✓ Setujui Hasil" untuk konfirmasi tayang.`
        );
      }

      if (stepCfg && stepCfg.type === 'feedback_loop') {
        return (
          `🔁 Feedback Siklus DINA → RAKA & SARI\n\n` +
          `• Sumber Proyek: ${p.fromTitle || '-'}\n` +
          `• Rekomendasi Siklus Berikutnya:\n${toBulletLines(p.recommendations)}`
        );
      }

      if (actor === 'dina') {
        return (
          `📊 Evaluasi Performa Konten (DINA)\n\n` +
          `• Retensi Penonton: ${p.retention_eval || '-'}\n` +
          `• Engagement Rate: ${p.engagement_rate || '-'}\n\n` +
          `🏆 Pola Berhasil:\n${toBulletLines(p.winning_patterns)}\n\n` +
          `🚀 Rekomendasi Berikutnya:\n${toBulletLines(p.next_cycle_recommendations)}`
        );
      }

      return Object.entries(p)
        .map(([k, v]) => `• ${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`)
        .join('\n');
    }

    syncEmployeeToCanvas(emp, status, progress, currentTask, lastOutput) {
      emp.status = status;
      emp.progress = progress;
      emp.currentTask = currentTask;
      emp.lastOutput = lastOutput;
      Nexora.state.emit('update');
    }

    upsertLocalTask(projectId, task) {
      const list = this.tasksByProject[projectId] || [];
      const idx = list.findIndex((t) => t.id === task.id);
      if (idx >= 0) list[idx] = task;
      else list.push(task);
      this.tasksByProject[projectId] = list;
    }

    async updateProjectState(project, patch) {
      Object.assign(project, patch);
      if (this.isCloudMode()) {
        const updated = await Nexora.supabaseService.updateProject(project.id, patch);
        Object.assign(project, updated);
      }
      this.emit();
    }

    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  Nexora.workflowEngine = new WorkflowEngine();

})(window.Nexora = window.Nexora || {});