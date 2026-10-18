/* Pure transfer-curve and lookup-table math. MIT. */
const PaletteMath = {
  identity() {
    return Array.from({ length: 6 }, (_, i) => [i / 5, i / 5]);
  },
  // Linear interpolation keeps curve edits predictable, without overshoot.
  map(value, points) {
    const x = Math.max(0, Math.min(1, value));
    for (let i = 1; i < points.length; i++)
      if (x <= points[i][0]) {
        const [ax, ay] = points[i - 1],
          [bx, by] = points[i];
        return ay + ((by - ay) * (x - ax)) / (bx - ax);
      }
    return points[points.length - 1][1];
  },
  color(value, colors) {
    const t = Math.max(0, Math.min(1, value)) * (colors.length - 1),
      i = Math.min(colors.length - 2, Math.floor(t)),
      f = t - i;
    return colors[i].map((v, c) =>
      Math.round(v * (1 - f) + colors[i + 1][c] * f),
    );
  },
  lut(colors, points, reverse = false) {
    return Array.from({ length: 256 }, (_, i) => {
      const v = this.map(i / 255, points);
      return this.color(reverse ? 1 - v : v, colors);
    });
  },
  recolor(source, lut) {
    const output = new Uint8ClampedArray(source.length);
    for (let i = 0; i < source.length; i += 4) {
      const intensity = Math.round(
        0.2126 * source[i] + 0.7152 * source[i + 1] + 0.0722 * source[i + 2],
      );
      const color = lut[intensity];
      output[i] = color[0];
      output[i + 1] = color[1];
      output[i + 2] = color[2];
      output[i + 3] = source[i + 3];
    }
    return output;
  },
  // Validate imported settings before they can affect controls or pixel buffers.
  validate(value, palettes) {
    if (
      !value ||
      value.version !== 1 ||
      !Object.hasOwn(palettes, value.palette) ||
      typeof value.reverse !== "boolean"
    )
      throw new Error("Not a supported Palettizer preset.");
    const p = value.points;
    if (
      !Array.isArray(p) ||
      p.length < 2 ||
      p.length > 32 ||
      p.some(
        (a) =>
          !Array.isArray(a) ||
          a.length !== 2 ||
          a.some(
            (n) =>
              typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1,
          ),
      )
    )
      throw new Error("The curve must contain 2 to 32 valid points.");
    if (
      p[0][0] !== 0 ||
      p[0][1] !== 0 ||
      p[p.length - 1][0] !== 1 ||
      p[p.length - 1][1] !== 1
    )
      throw new Error("Curve endpoints must be (0,0) and (1,1).");
    for (let i = 1; i < p.length; i++)
      if (p[i][0] - p[i - 1][0] < 0.0099 || p[i][1] < p[i - 1][1])
        throw new Error("Curve points must stay in increasing order.");
    return {
      version: 1,
      palette: value.palette,
      reverse: value.reverse,
      points: p.map((a) => a.slice()),
    };
  },
};
if (typeof module !== "undefined") module.exports = PaletteMath;
