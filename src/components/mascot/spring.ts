/** Pegas teredam (persamaan sama dengan useSpring framer-motion): percepatan = (-k·selisih - c·kecepatan) / massa. */
export class Spring {
  value: number;
  target: number;
  velocity = 0;

  constructor(
    value: number,
    public stiffness: number,
    public damping: number,
    public mass = 1,
  ) {
    this.value = value;
    this.target = value;
  }

  step(dt: number) {
    let left = dt;
    while (left > 0) {
      const h = Math.min(left, 1 / 120);
      const accel = (-this.stiffness * (this.value - this.target) - this.damping * this.velocity) / this.mass;
      this.velocity += accel * h;
      this.value += this.velocity * h;
      left -= h;
    }
  }

  /** Lompat langsung ke nilai tanpa gerak sisa. */
  set(value: number) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  get settled() {
    return Math.abs(this.velocity) < 0.02 && Math.abs(this.value - this.target) < 0.01;
  }
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
