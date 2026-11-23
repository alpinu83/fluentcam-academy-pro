/**
 * Interactive Classroom Whiteboard Overlay (Mouse + Touch + Apple Pencil).
 * Allows students to circle words, underline sentences, or draw right over
 * the active textbook page and send their drawing to the AI tutor!
 */
export class ClassroomWhiteboard {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.enabled = false;
    this.tool = 'pen'; // 'pen' | 'highlighter' | 'eraser'
    this.color = '#d9534f';
    this.lineWidth = 3.5;
    this.drawing = false;
    this.strokes = [];
    this.currentStroke = null;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onResize = this._onResize.bind(this);

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('resize', this._onResize);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.canvas.classList.toggle('active', this.enabled);
    if (this.enabled) {
      this.resizeToParent();
    }
  }

  setTool(tool) {
    this.tool = tool;
    if (tool === 'highlighter') this.lineWidth = 18;
    else if (tool === 'eraser') this.lineWidth = 22;
    else this.lineWidth = 3.5;
  }

  setColor(color) {
    this.color = color;
    if (this.tool === 'eraser') {
      this.setTool('pen');
    }
  }

  resizeToParent() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.redraw();
    }
  }

  _onResize() {
    if (this.enabled || this.strokes.length > 0) {
      this.resizeToParent();
    }
  }

  _getPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  _onPointerDown(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.resizeToParent();
    this.drawing = true;
    const pt = this._getPoint(e);
    this.currentStroke = {
      tool: this.tool,
      color: this.color,
      width: this.lineWidth,
      points: [pt],
    };
    this.strokes.push(this.currentStroke);
    this.redraw();
  }

  _onPointerMove(e) {
    if (!this.drawing || !this.currentStroke) return;
    const pt = this._getPoint(e);
    this.currentStroke.points.push(pt);
    this.redraw();
  }

  _onPointerUp() {
    if (!this.drawing) return;
    this.drawing = false;
    this.currentStroke = null;
  }

  undo() {
    if (this.strokes.length === 0) return;
    this.strokes.pop();
    this.redraw();
  }

  clear() {
    this.strokes = [];
    this.redraw();
  }

  hasDrawing() {
    return this.strokes.length > 0;
  }

  redraw() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    for (const stroke of this.strokes) {
      if (!stroke.points.length) continue;
      this.ctx.save();
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.lineWidth = stroke.width;

      if (stroke.tool === 'eraser') {
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else if (stroke.tool === 'highlighter') {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalAlpha = 0.32;
        this.ctx.strokeStyle = '#f5c542';
      } else {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = stroke.color;
      }

      this.ctx.beginPath();
      const [first, ...rest] = stroke.points;
      this.ctx.moveTo(first.x, first.y);
      if (rest.length === 0) {
        this.ctx.lineTo(first.x + 0.1, first.y + 0.1);
      } else {
        for (const p of rest) {
          this.ctx.lineTo(p.x, p.y);
        }
      }
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  /**
   * Export the student's whiteboard sketch onto a crisp paper canvas as JPEG base64
   * so Gemini Live vision can see exactly what the child drew or circled.
   */
  exportJpegBase64(pageHeading = 'Student Whiteboard Drawing') {
    const w = 720;
    const h = 540;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d');

    // Warm paper background
    octx.fillStyle = '#faf6ef';
    octx.fillRect(0, 0, w, h);

    // Header label for Gemini vision context
    octx.fillStyle = '#5c4f42';
    octx.font = 'bold 18px sans-serif';
    octx.fillText(`Whiteboard Sketch — ${pageHeading}`, 20, 32);
    octx.strokeStyle = '#dfd4c4';
    octx.beginPath();
    octx.moveTo(20, 44);
    octx.lineTo(w - 20, 44);
    octx.stroke();

    if (this.canvas.width > 0 && this.canvas.height > 0) {
      octx.drawImage(this.canvas, 0, 52, w, h - 52);
    }
    const dataUrl = out.toDataURL('image/jpeg', 0.8);
    return dataUrl.split(',')[1] || null;
  }
}
