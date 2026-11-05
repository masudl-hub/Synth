export const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

export const dist = (x1: number, y1: number, x2: number, y2: number) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

/** Maps `value` linearly from the range `[start1, stop1]` onto `[start2, stop2]`. */
export const map = (value: number, [start1, stop1]: [number, number], [start2, stop2]: [number, number]) =>
  start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));

// 3D Point Interface
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

// 3D Projection helper
export const project = (
  x: number,
  y: number,
  z: number,
  { width, height, fov = 300 }: { width: number; height: number; fov?: number },
) => {
  const scale = fov / (fov + z);
  const x2d = x * scale + width / 2;
  const y2d = y * scale + height / 2;
  return { x: x2d, y: y2d, scale };
};

// Rotate point around Y axis
export const rotateY = (point: Point3D, angle: number): Point3D => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.z * sin,
    y: point.y,
    z: point.x * sin + point.z * cos,
  };
};

// Rotate point around X axis
export const rotateX = (point: Point3D, angle: number): Point3D => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x,
    y: point.y * cos - point.z * sin,
    z: point.y * sin + point.z * cos,
  };
};
