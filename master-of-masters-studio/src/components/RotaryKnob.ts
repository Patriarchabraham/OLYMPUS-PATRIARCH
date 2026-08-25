export interface KnobOptions {
  element: HTMLElement;
  min: number;
  max: number;
  step?: number;
  initialValue: number;
  unit?: string;
  color?: 'gold' | 'cyan' | 'red';
  onChange?: (value: number) => void;
}

export class RotaryKnob {
  private element: HTMLElement;
  private min: number;
  private max: number;
  private step: number;
  private value: number;
  private unit: string;
  private color: 'gold' | 'cyan' | 'red';
  private onChange?: (value: number) => void;

  private knobFace: HTMLElement;
  private valueDisplay?: HTMLElement;
  private isDragging = false;
  private startY = 0;
  private startValue = 0;

  constructor(options: KnobOptions) {
    this.element = options.element;
    this.min = options.min;
    this.max = options.max;
    this.step = options.step || 1;
    this.value = options.initialValue;
    this.unit = options.unit || '';
    this.color = options.color || 'gold';
    this.onChange = options.onChange;

    this.render();
    this.knobFace = this.element.querySelector('.knob-face') as HTMLElement;
    this.valueDisplay = this.element.querySelector('.knob-value-readout') as HTMLElement;

    this.updateRotation();
    this.bindEvents();
  }

  private render() {
    this.element.classList.add('analog-knob-container');
    const colorClass = this.color === 'cyan' ? 'cyan' : this.color === 'red' ? 'red' : '';

    this.element.innerHTML = `
      <div class="knob-dial-wrap">
        <svg class="knob-ticks" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2" stroke-dasharray="2 6" />
        </svg>
        <div class="knob-face">
          <div class="knob-pointer ${colorClass}"></div>
        </div>
      </div>
      <div class="mt-1.5 font-mono text-[11px] font-bold text-slate-300 knob-value-readout">
        ${this.formatValue(this.value)}
      </div>
    `;
  }

  private bindEvents() {
    this.element.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.startY = e.clientY;
      this.startValue = this.value;
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const deltaY = this.startY - e.clientY; // Drag up = increase
      const range = this.max - this.min;
      const sensitivity = range / 160; // 160px for full range
      let newVal = this.startValue + deltaY * sensitivity;

      newVal = Math.max(this.min, Math.min(this.max, newVal));
      if (this.step > 0) {
        newVal = Math.round(newVal / this.step) * this.step;
      }

      if (newVal !== this.value) {
        this.value = newVal;
        this.updateRotation();
        this.onChange?.(this.value);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.cursor = '';
      }
    });

    // Mouse Wheel
    this.element.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? this.step : -this.step;
      this.setValue(this.value + delta);
    });
  }

  public setValue(val: number, emit = true) {
    this.value = Math.max(this.min, Math.min(this.max, val));
    this.updateRotation();
    if (emit) {
      this.onChange?.(this.value);
    }
  }

  public getValue(): number {
    return this.value;
  }

  private updateRotation() {
    // Map min..max to -135deg .. +135deg (270 degrees total throw)
    const norm = (this.value - this.min) / (this.max - this.min);
    const degrees = -135 + norm * 270;

    if (this.knobFace) {
      this.knobFace.style.transform = `rotate(${degrees}deg)`;
    }
    if (this.valueDisplay) {
      this.valueDisplay.textContent = this.formatValue(this.value);
    }
  }

  private formatValue(val: number): string {
    const formatted = Number.isInteger(val) ? val.toString() : val.toFixed(1);
    return `${formatted}${this.unit}`;
  }
}
