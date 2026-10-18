const assert = require("node:assert/strict");
const math = require("./color.js"),
  palettes = require("./palettes.js");
const identity = math.identity();
for (let i = 0; i <= 255; i++)
  assert(Math.abs(math.map(i / 255, identity) - i / 255) < 1e-12);
const gray = math.lut(palettes.grayscale.colors, identity);
assert.deepEqual(gray[0], [0, 0, 0]);
assert.deepEqual(gray[255], [255, 255, 255]);
assert.deepEqual(
  math.lut(palettes.grayscale.colors, identity, true)[0],
  [255, 255, 255],
);
const pixels = new Uint8ClampedArray([
  255, 0, 0, 128, 0, 255, 0, 0, 0, 0, 255, 255,
]);
const out = math.recolor(pixels, gray);
assert.deepEqual(
  [...out],
  [54, 54, 54, 128, 182, 182, 182, 0, 18, 18, 18, 255],
);
const good = {
  version: 1,
  palette: "thermal",
  reverse: false,
  points: identity,
};
assert.deepEqual(math.validate(good, palettes), good);
assert.throws(() => math.validate({ ...good, palette: "unknown" }, palettes));
assert.throws(() =>
  math.validate(
    {
      ...good,
      points: [
        [0, 0],
        [0.4, 0.3],
        [0.3, 0.4],
        [0.6, 0.6],
        [0.8, 0.8],
        [1, 1],
      ],
    },
    palettes,
  ),
);
assert.throws(() =>
  math.validate(
    {
      ...good,
      points: [
        [0, 0],
        [0.2, 0.7],
        [0.4, 0.3],
        [0.6, 0.6],
        [0.8, 0.8],
        [1, 1],
      ],
    },
    palettes,
  ),
);
for (const p of Object.values(palettes)) {
  const lut = math.lut(p.colors, identity);
  assert.equal(lut.length, 256);
  lut.flat().forEach((n) => assert(Number.isInteger(n) && n >= 0 && n <= 255));
}
console.log(
  "PASS: identity curve, interpolation, palette reversal, luminance, alpha, all palettes and preset validation.",
);
