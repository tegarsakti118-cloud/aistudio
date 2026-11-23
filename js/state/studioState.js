(function (Nexora) {
  'use strict';

  const S = Nexora.STATUS;
  const STORAGE_KEY = 'nexora_studio_state_v1';

  function formatTime(date) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  class StudioStateManager {
    constructor() {
      this.listeners = [];
      this.selectedEmployeeId = null;

      this.initDefaultState();
      const restored = this.loadFromStorage();

      if (!restored) {
        this.pushNotification('RAKA & Tim siap di kantor virtual. SARI menunggu persetujuan ide.', 'info');
      }
    }

    initDefaultState() {
      this.autoSimEnabled = true;

      this.metrics = {
        ideasCreated: 12,
        scriptsFinished: 7,
        videosProduced: 4,
        contentsPublished: 3,
        avgEngagementRate: '6.4%',
        totalSimulatedViews: '48.2K',
        avg3sRetention: '78%',
        scriptQualityScore: '9.0 / 10'
      };

      this.notifications = [];
      this.unreadNotifCount = 0;

      this.activityLogs = [
        { time: formatTime(new Date()), actor: 'SISTEM', message: 'Kantor Virtual Nexora AI Studio aktif (Mode Simulasi Fase 1).' }
      ];

      const initialStatuses = [
        { status: S.WORKING, progress: 64 },
        { status: S.WAITING_APPROVAL, progress: 100 },
        { status: S.WORKING, progress: 42 },
        { status: S.REVIEWING, progress: 78 },
        { status: S.STANDBY, progress: 0 },
        { status: S.COMPLETED, progress: 100 },
        { status: S.STANDBY, progress: 0 },
        { status: S.WORKING, progress: 51 }
      ];

      this.employees = Nexora.EMPLOYEES.map((emp, idx) => {
        const init = initialStatuses[idx];
        const isStandby = init.status === S.STANDBY;
        const isBusy = init.status === S.WORKING || init.status === S.REVIEWING;

        let initialOutput = emp.sampleOutput;
        if (isStandby) {
          initialOutput = 'Belum ada output pada siklus ini. Klik "Mulai Tugas" atau kirim instruksi Direktur.';
        } else if (isBusy) {
          initialOutput = `[Sedang Diproses • ${init.progress}%]\nTugas aktif: ${emp.defaultTask}\n\n${emp.name} sedang menyusun hasil kerja...`;
        }

        return {
          ...emp,
          status: init.status,
          progress: init.progress,
          activeInstruction: null,
          currentTask: isStandby ? 'Siap menerima perintah Direktur' : emp.defaultTask,
          lastOutput: initialOutput,
          speechBubble: init.status === S.WAITING_APPROVAL ? 'Mohon tinjau!' : '',
          speechTimer: init.status === S.WAITING_APPROVAL ? 260 : 0,
          history: [
            {
              time: formatTime(new Date(Date.now() - (idx + 2) * 180000)),
              text: `Status awal diatur ke ${init.status}`
            }
          ]
        };
      });
    }

    saveToStorage() {
      try {
        const snapshot = {
          autoSimEnabled: this.autoSimEnabled,
          metrics: this.metrics,
          notifications: this.notifications.slice(0, 25),
          unreadNotifCount: this.unreadNotifCount,
          activityLogs: this.activityLogs.slice(0, 40),
          employees: this.employees.map((e) => ({
            id: e.id,
            status: e.status,
            progress: e.progress,
            activeInstruction: e.activeInstruction,
            currentTask: e.currentTask,
            lastOutput: e.lastOutput,
            history: (e.history || []).slice(0, 15)
          }))
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch (err) {
        // Abaikan jika browser memblokir storage atau kuota penuh
      }
    }

    loadFromStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;

        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.employees)) return false;

        if (typeof data.autoSimEnabled === 'boolean') {
          this.autoSimEnabled = data.autoSimEnabled;
        }
        if (data.metrics && typeof data.metrics === 'object') {
          this.metrics = { ...this.metrics, ...data.metrics };
        }
        if (Array.isArray(data.notifications)) {
          this.notifications = data.notifications;
        }
        if (typeof data.unreadNotifCount === 'number') {
          this.unreadNotifCount = data.unreadNotifCount;
        }
        if (Array.isArray(data.activityLogs) && data.activityLogs.length > 0) {
          this.activityLogs = data.activityLogs;
        }

        const validStatuses = new Set(Object.values(S));
        this.employees.forEach((emp) => {
          const saved = data.employees.find((item) => item.id === emp.id);
          if (!saved) return;
          if (validStatuses.has(saved.status)) emp.status = saved.status;
          if (typeof saved.progress === 'number') emp.progress = saved.progress;
          if (typeof saved.activeInstruction === 'string' || saved.activeInstruction === null) {
            emp.activeInstruction = saved.activeInstruction;
          }
          if (typeof saved.currentTask === 'string') emp.currentTask = saved.currentTask;
          if (typeof saved.lastOutput === 'string') emp.lastOutput = saved.lastOutput;
          if (Array.isArray(saved.history)) emp.history = saved.history;

          emp.speechBubble = emp.status === S.WAITING_APPROVAL ? 'Mohon tinjau!' : '';
          emp.speechTimer = emp.status === S.WAITING_APPROVAL ? 220 : 0;
        });

        return true;
      } catch (err) {
        return false;
      }
    }

    resetSimulation() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        // Abaikan error storage
      }
      this.selectedEmployeeId = null;
      this.initDefaultState();
      this.pushNotification('Simulasi di-reset ke kondisi awal.', 'info');
      this.emit('update');
    }

    subscribe(fn) {
      this.listeners.push(fn);
      return () => {
        this.listeners = this.listeners.filter((l) => l !== fn);
      };
    }

    emit(eventType = 'update', payload = null) {
      this.saveToStorage();
      this.listeners.forEach((fn) => fn(this, eventType, payload));
    }

    getEmployee(id) {
      return this.employees.find((e) => e.id === id) || null;
    }

    addLog(actor, message) {
      this.activityLogs.unshift({
        time: formatTime(new Date()),
        actor,
        message
      });
      if (this.activityLogs.length > 40) {
        this.activityLogs.pop();
      }
    }

    pushNotification(message, level = 'info', employeeId = null) {
      const notif = {
        id: Date.now() + Math.random(),
        time: formatTime(new Date()),
        message,
        level,
        employeeId,
        read: false
      };
      this.notifications.unshift(notif);
      if (this.notifications.length > 25) this.notifications.pop();
      this.unreadNotifCount += 1;
      this.emit('notification', notif);
    }

    markAllNotificationsRead() {
      this.notifications.forEach((n) => (n.read = true));
      this.unreadNotifCount = 0;
      this.emit('update');
    }

    setSpeech(emp, text, frames = 180) {
      emp.speechBubble = text;
      emp.speechTimer = frames;
    }

    buildCompletedOutput(emp) {
      const timeStr = formatTime(new Date());
      if (emp.activeInstruction) {
        return (
          `[Hasil Simulasi • ${timeStr}]\n` +
          `Instruksi Direktur: "${emp.activeInstruction}"\n\n` +
          `Ringkasan Output ${emp.name} (${emp.role}):\n` +
          `• Fokus pengerjaan telah disesuaikan dengan arahan Direktur.\n` +
          `• Draf hasil siap ditinjau untuk tahap berikutnya.\n\n` +
          `Referensi Format Output:\n${emp.sampleOutput}`
        );
      }
      return `[Hasil Simulasi • ${timeStr}]\nTugas: ${emp.currentTask}\n\n${emp.sampleOutput}`;
    }

    startEmployeeTask(id, customTask = null) {
      const emp = this.getEmployee(id);
      if (!emp) return;

      const isLockedState = emp.status === S.WORKING || emp.status === S.REVIEWING || emp.status === S.WAITING_APPROVAL;
      if (!customTask && isLockedState) return;

      const isReviewer = id === 'dimas' || id === 'tio';
      emp.status = isReviewer ? S.REVIEWING : S.WORKING;
      emp.progress = 10;
      emp.activeInstruction = customTask || null;
      emp.currentTask = customTask ? `Instruksi Direktur: ${customTask}` : emp.defaultTask;
      emp.lastOutput = `[Sedang Diproses • 10%]\nTugas aktif: ${emp.currentTask}\n\n${emp.name} mulai mengerjakan tugas...`;
      this.setSpeech(emp, isReviewer ? 'Sedang dicek...' : 'Siap kerjakan!', 160);
      emp.history.unshift({ time: formatTime(new Date()), text: `Memulai: ${emp.currentTask}` });
      this.addLog(emp.name, `Memulai pekerjaan (${emp.status}): ${emp.currentTask}`);
      this.emit('update');
    }

    stopEmployeeTask(id) {
      const emp = this.getEmployee(id);
      if (!emp || emp.status === S.STANDBY) return;

      emp.status = S.STANDBY;
      emp.progress = 0;
      emp.activeInstruction = null;
      emp.currentTask = 'Siap menerima perintah Direktur';
      emp.lastOutput = `[Dihentikan Direktur • ${formatTime(new Date())}]\n${emp.name} kembali ke mode Standby dan siap menerima tugas baru.`;
      this.setSpeech(emp, 'Standby, Bos.', 120);
      emp.history.unshift({ time: formatTime(new Date()), text: 'Dihentikan Direktur -> Standby' });
      this.addLog(emp.name, 'Tugas dihentikan dan kembali Standby.');
      this.emit('update');
    }

    approveEmployeeWork(id) {
      const emp = this.getEmployee(id);
      if (!emp || emp.status !== S.WAITING_APPROVAL) return;

      emp.status = S.COMPLETED;
      emp.progress = 100;
      if (!emp.lastOutput.startsWith('[Disetujui Direktur')) {
        emp.lastOutput = `[Disetujui Direktur ✓ • ${formatTime(new Date())}]\n\n${emp.lastOutput}`;
      }
      this.setSpeech(emp, 'Disetujui! ✓', 170);
      emp.history.unshift({ time: formatTime(new Date()), text: 'Hasil disetujui Direktur -> Completed' });
      this.incrementMetricsFor(emp.id);
      this.addLog('DIREKTUR', `Menyetujui hasil kerja ${emp.name}.`);
      this.pushNotification(`${emp.name} menyelesaikan tugas dan telah disetujui.`, 'success', emp.id);
      this.emit('update');
    }

    rejectEmployeeWork(id) {
      const emp = this.getEmployee(id);
      if (!emp || emp.status !== S.WAITING_APPROVAL) return;

      emp.status = S.FAILED;
      emp.progress = 100;
      emp.lastOutput = `[Ditolak Direktur • ${formatTime(new Date())}]\nTugas: ${emp.currentTask}\nStatus: Membutuhkan revisi oleh ${emp.name}.\n\nKlik "Revisi Tugas" atau kirim instruksi perbaikan.`;
      this.setSpeech(emp, 'Perlu revisi!', 180);
      emp.history.unshift({ time: formatTime(new Date()), text: 'Ditolak Direktur -> Perlu Revisi (Failed)' });
      this.addLog('DIREKTUR', `Menolak hasil ${emp.name} dan meminta revisi.`);
      this.pushNotification(`${emp.name} membutuhkan perbaikan tugas.`, 'warning', emp.id);
      this.emit('update');
    }

    sendInstruction(id, instructionText) {
      const emp = this.getEmployee(id);
      if (!emp || !instructionText.trim()) return;

      const cleanText = instructionText.trim();
      emp.history.unshift({ time: formatTime(new Date()), text: `Instruksi Direktur: "${cleanText}"` });
      this.startEmployeeTask(id, cleanText);
      this.setSpeech(emp, 'Instruksi diterima!', 180);
      this.pushNotification(`Instruksi dikirim ke ${emp.name}.`, 'info', emp.id);
    }

    startAllStandby() {
      let started = 0;
      this.employees.forEach((emp) => {
        if (emp.status === S.STANDBY || emp.status === S.COMPLETED || emp.status === S.FAILED) {
          this.startEmployeeTask(emp.id);
          started++;
        }
      });
      if (started > 0) {
        this.pushNotification(`Direktur mengaktifkan ${started} karyawan AI.`, 'info');
      }
    }

    stopAllWorkers() {
      this.employees.forEach((emp) => {
        if (emp.status !== S.STANDBY) {
          emp.status = S.STANDBY;
          emp.progress = 0;
          emp.activeInstruction = null;
          emp.currentTask = 'Siap menerima perintah Direktur';
          emp.lastOutput = 'Belum ada output pada siklus ini. Klik "Mulai Tugas" atau kirim instruksi Direktur.';
        }
      });
      this.addLog('DIREKTUR', 'Menghentikan seluruh aktivitas karyawan.');
      this.pushNotification('Seluruh karyawan kini dalam mode Standby.', 'warning');
      this.emit('update');
    }

    incrementMetricsFor(empId) {
      if (empId === 'sari') this.metrics.ideasCreated += 1;
      if (empId === 'bima' || empId === 'dimas') this.metrics.scriptsFinished += 1;
      if (empId === 'laras' || empId === 'tio') this.metrics.videosProduced += 1;
      if (empId === 'mel') {
        this.metrics.contentsPublished += 1;
        const currentViews = parseFloat(String(this.metrics.totalSimulatedViews).replace('K', '')) || 48.2;
        this.metrics.totalSimulatedViews = `${(currentViews + 1.4).toFixed(1)}K`;
      }
      if (empId === 'dimas') {
        const currentScore = parseFloat(String(this.metrics.scriptQualityScore)) || 9.0;
        this.metrics.scriptQualityScore = `${Math.min(9.9, currentScore + 0.1).toFixed(1)} / 10`;
      }
      if (empId === 'dina') {
        const currentRet = parseInt(String(this.metrics.avg3sRetention), 10) || 78;
        this.metrics.avg3sRetention = `${Math.min(95, currentRet + 1)}%`;
        const currentEng = parseFloat(String(this.metrics.avgEngagementRate)) || 6.4;
        this.metrics.avgEngagementRate = `${Math.min(12.0, currentEng + 0.1).toFixed(1)}%`;
      }
    }

    toggleAutoSim() {
      this.autoSimEnabled = !this.autoSimEnabled;
      this.addLog('SISTEM', `Simulasi otomatis ${this.autoSimEnabled ? 'diaktifkan' : 'dijeda'}.`);
      this.emit('update');
    }

    advanceSimulationStep() {
      let changed = false;

      this.employees.forEach((emp) => {
        if (emp.status === S.WORKING || emp.status === S.REVIEWING) {
          const boost = 12 + Math.floor(Math.random() * 14);
          emp.progress = Math.min(100, emp.progress + boost);
          changed = true;

          if (emp.progress < 100) {
            emp.lastOutput = `[Sedang Diproses • ${emp.progress}%]\nTugas aktif: ${emp.currentTask}\n\n${emp.name} sedang memproses data simulasi...`;
          } else {
            const roll = Math.random();
            if (emp.id === 'sari' || emp.id === 'dimas' || emp.id === 'tio' || roll < 0.45) {
              emp.status = S.WAITING_APPROVAL;
              emp.lastOutput = this.buildCompletedOutput(emp);
              this.setSpeech(emp, 'Butuh ACC Bos!', 220);
              emp.history.unshift({ time: formatTime(new Date()), text: 'Selesai -> Menunggu Persetujuan Direktur' });
              this.addLog(emp.name, 'Menyelesaikan draf dan menunggu persetujuan Direktur.');
              this.pushNotification(`${emp.name} (${emp.role}) menunggu persetujuan Anda!`, 'warning', emp.id);
            } else if (roll < 0.92) {
              emp.status = S.COMPLETED;
              emp.lastOutput = this.buildCompletedOutput(emp);
              this.incrementMetricsFor(emp.id);
              this.setSpeech(emp, 'Tugas beres! ✓', 180);
              emp.history.unshift({ time: formatTime(new Date()), text: 'Tugas selesai otomatis (Completed)' });
              this.addLog(emp.name, `Berhasil menyelesaikan: ${emp.currentTask}`);
              this.pushNotification(`${emp.name} selesai mengerjakan tugas.`, 'success', emp.id);
            } else {
              emp.status = S.FAILED;
              emp.lastOutput = `[Kendala Simulasi • ${formatTime(new Date())}]\nTugas: ${emp.currentTask}\nCatatan: Data sumber belum lengkap atau butuh arahan ulang.\n\nKlik "Revisi Tugas" atau kirim instruksi baru.`;
              this.setSpeech(emp, 'Kendala data!', 180);
              emp.history.unshift({ time: formatTime(new Date()), text: 'Simulasi kendala -> Failed' });
              this.addLog(emp.name, 'Menemukan kendala pada tugas simulasi.');
              this.pushNotification(`${emp.name} melaporkan kendala tugas!`, 'error', emp.id);
            }
          }
        } else if (emp.status === S.COMPLETED && Math.random() < 0.22) {
          emp.status = S.STANDBY;
          emp.progress = 0;
          emp.activeInstruction = null;
          emp.currentTask = 'Siap menerima perintah Direktur';
          changed = true;
        } else if (emp.status === S.STANDBY && Math.random() < 0.18) {
          const isRev = emp.id === 'dimas' || emp.id === 'tio';
          emp.status = isRev ? S.REVIEWING : S.WORKING;
          emp.progress = 15;
          emp.activeInstruction = null;
          emp.currentTask = emp.defaultTask;
          emp.lastOutput = `[Sedang Diproses • 15%]\nTugas aktif: ${emp.currentTask}\n\n${emp.name} mulai mengerjakan tugas simulasi...`;
          this.setSpeech(emp, 'Mulai tugas baru!', 140);
          this.addLog(emp.name, `Mengambil tugas simulasi: ${emp.currentTask}`);
          changed = true;
        }
      });

      if (changed) {
        this.emit('update');
      }
    }

    getSummaryStats() {
      const workingCount = this.employees.filter(
        (e) => e.status === S.WORKING || e.status === S.REVIEWING
      ).length;
      const waitingCount = this.employees.filter((e) => e.status === S.WAITING_APPROVAL).length;

      return {
        totalEmployees: this.employees.length,
        workingCount,
        waitingCount,
        ...this.metrics
      };
    }
  }

  Nexora.state = new StudioStateManager();

})(window.Nexora = window.Nexora || {});