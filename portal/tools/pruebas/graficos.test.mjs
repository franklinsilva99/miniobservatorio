// Pruebas del gráfico de series: cómo se unen los datos con huecos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chart } from "../../js/ui/graficos.js";

const tramos = svg => (svg.match(/<path d="([^"]*)"/)[1].match(/M/g) || []).length;
const puntos = svg => (svg.match(/<circle /g) || []).length;
const cada4h = () => { const v = Array(30).fill(null); [0, 4, 8, 12, 24, 28].forEach((i, k) => { v[i] = 3.6 + k * .1; }); return v; };

test("sin hueco, los datos aislados se marcan con un punto para que no desaparezcan", () => {
  const svg = chart({ ser: [{ v: cada4h(), c: "#00f" }] });
  assert.equal(tramos(svg), 6);
  assert.equal(puntos(svg), 6);
});

test("con hueco de 12 h, una estación convencional (06, 10, 14, 18 h y la noche) se dibuja como una línea", () => {
  const svg = chart({ ser: [{ v: cada4h(), c: "#00f", hueco: 12 }] });
  assert.equal(tramos(svg), 1);
  assert.equal(puntos(svg), 0);
});

test("un hueco mayor que el permitido queda cortado", () => {
  const v = Array(40).fill(null); v[0] = 1; v[1] = 2; v[30] = 3; v[31] = 4;
  const svg = chart({ ser: [{ v, c: "#00f", hueco: 12 }] });
  assert.equal(tramos(svg), 2);
  assert.equal(puntos(svg), 0);
});

test("los datos seguidos siguen dibujándose igual que antes", () => {
  const svg = chart({ ser: [{ v: [1, 2, null, 3, 4], c: "#00f" }] });
  assert.equal(tramos(svg), 2);
  assert.equal(puntos(svg), 0);
});
