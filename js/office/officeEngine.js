(function (Nexora) {
  'use strict';

  const WORLD_W = 760;
  const WORLD_H = 950;

  class VirtualOfficeEngine {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.tick = 0;
      this.tickStep = 1;
      this.lastFrameTime = 0;
      this.rafId = null;

      this.displayW = 360;
      this.displayH = Math.round(360 * (WORLD_H / WORLD_W));
      this.dpr = 1;

      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.isDragging = false;
      this.dragMoved = false;
      this.lastPointer = { x: 0, y: 0 };

      this.bindEvents();
      this.updateZoomUI();
      this.resizeCanvas();
      this.startLoop();
    }

    resizeCanvas() {
      if (!this.canvas) return;
      const wrapper = this.canvas.parentElement;
      if (!wrapper || wrapper.clientWidth === 0) return;

      const displayW = wrapper.clientWidth;
      const aspect = WORLD_H / WORLD_W;
      const displayH = Math.round(displayW * aspect);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = displayW * dpr;
      this.canvas.height = displayH * dpr;
      this.canvas.style.width = `${displayW}px`;
      this.canvas.style.height = `${displayH}px`;

      this.displayW = displayW;
      this.displayH = displayH;
      this.dpr = dpr;

      if (this.zoom > 1.01) {
        this.clampPan();
      } else {
        this.panX = 0;
        this.panY = 0;
      }
    }

    screenToWorld(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;

      const baseScale = this.displayW / WORLD_W;
      const totalScale = baseScale * this.zoom;

      const wx = (sx - this.panX) / totalScale;
      const wy = (sy - this.panY) / totalScale;
      return { x: wx, y: wy };
    }

    setZoom(nextZoom) {
      const clamped = Math.max(1, Math.min(2.0, nextZoom));
      this.zoom = clamped;
      if (clamped === 1) {
        this.panX = 0;
        this.panY = 0;
      } else {
        this.clampPan();
      }
      this.updateZoomUI();
    }

    clampPan() {
      const baseScale = this.displayW / WORLD_W;
      const scaledW = WORLD_W * baseScale * this.zoom;
      const scaledH = WORLD_H * baseScale * this.zoom;
      const minX = Math.min(0, this.displayW - scaledW);
      const minY = Math.min(0, this.displayH - scaledH);
      this.panX = Math.max(minX, Math.min(0, this.panX));
      this.panY = Math.max(minY, Math.min(0, this.panY));
    }

    updateZoomUI() {
      const isZoomed = this.zoom > 1.01;
      const lbl = document.getElementById('zoom-level-label');
      const resetBtn = document.getElementById('btn-reset-view');
      if (lbl) lbl.textContent = isZoomed ? `${this.zoom.toFixed(1)}x` : 'Fit';
      if (resetBtn) resetBtn.classList.toggle('hidden', !isZoomed);

      const wrapper = this.canvas ? this.canvas.parentElement : null;
      if (wrapper) {
        wrapper.classList.toggle('touch-none', isZoomed);
        wrapper.classList.toggle('touch-pan-y', !isZoomed);
      }
      if (this.canvas) {
        this.canvas.classList.toggle('touch-none', isZoomed);
        this.canvas.classList.toggle('touch-pan-y', !isZoomed);
      }
    }

    focusEmployee(empId) {
      const emp = Nexora.state.getEmployee(empId);
      if (!emp) return;

      const wrapper = this.canvas ? this.canvas.parentElement : null;
      if (wrapper && wrapper.clientWidth > 0 && wrapper.clientWidth !== this.displayW) {
        this.resizeCanvas();
      }

      Nexora.state.selectedEmployeeId = empId;

      if (this.zoom < 1.3) {
        this.zoom = 1.35;
      }
      const baseScale = this.displayW / WORLD_W;
      const totalScale = baseScale * this.zoom;
      this.panX = this.displayW / 2 - emp.deskPos.x * totalScale;
      this.panY = this.displayH / 2 - emp.deskPos.y * totalScale;
      this.clampPan();
      this.updateZoomUI();
    }

    handleTap(clientX, clientY) {
      const pt = this.screenToWorld(clientX, clientY);
      const employees = Nexora.state.employees;

      for (let i = employees.length - 1; i >= 0; i--) {
        const emp = employees[i];
        const dx = pt.x - emp.deskPos.x;
        const dy = pt.y - (emp.deskPos.y - 12);
        if (Math.abs(dx) <= 84 && Math.abs(dy) <= 68) {
          Nexora.state.selectedEmployeeId = emp.id;
          if (Nexora.employeeModal) {
            Nexora.employeeModal.open(emp.id);
          }
          return;
        }
      }

      Nexora.state.selectedEmployeeId = null;
    }

    bindEvents() {
      window.addEventListener('resize', () => this.resizeCanvas());

      this.canvas.addEventListener('pointerdown', (e) => {
        this.isDragging = true;
        this.dragMoved = false;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        if (this.zoom > 1.01) {
          this.canvas.setPointerCapture(e.pointerId);
        }
      });

      this.canvas.addEventListener('pointermove', (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          this.dragMoved = true;
        }
        if (this.zoom > 1.01 && this.dragMoved) {
          this.panX += dx;
          this.panY += dy;
          this.clampPan();
        }
        this.lastPointer = { x: e.clientX, y: e.clientY };
      });

      this.canvas.addEventListener('pointerup', (e) => {
        if (!this.isDragging) return;
        this.isDragging = false;
        if (!this.dragMoved) {
          this.handleTap(e.clientX, e.clientY);
        }
      });

      this.canvas.addEventListener('pointercancel', () => {
        this.isDragging = false;
      });
    }

    render() {
      if (!this.ctx) return;
      const step = this.tickStep || 1;
      this.tick += step;

      const ctx = this.ctx;
      const baseScale = this.displayW / WORLD_W;
      const scale = baseScale * this.zoom * this.dpr;

      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, this.panX * this.dpr, this.panY * this.dpr);

      Nexora.officeSprites.drawOfficeEnvironment(ctx, WORLD_W, WORLD_H, this.tick);

      Nexora.state.employees.forEach((emp) => {
        if (emp.speechTimer > 0) emp.speechTimer = Math.max(0, emp.speechTimer - step);
        const isSelected = Nexora.state.selectedEmployeeId === emp.id;
        Nexora.officeSprites.drawEmployeeWorkstation(ctx, emp, this.tick, isSelected);
      });

      ctx.restore();
    }

    startLoop() {
      const loop = (now) => {
        this.rafId = requestAnimationFrame(loop);

        const minInterval = this.isDragging ? 0 : 32;
        if (this.lastFrameTime && (now - this.lastFrameTime) < minInterval) {
          return;
        }

        const dt = this.lastFrameTime ? Math.min(64, now - this.lastFrameTime) : 16.67;
        this.lastFrameTime = now;
        this.tickStep = dt / 16.67;

        this.render();
      };
      this.rafId = requestAnimationFrame(loop);
    }
  }

  Nexora.VirtualOfficeEngine = VirtualOfficeEngine;

})(window.Nexora = window.Nexora || {});