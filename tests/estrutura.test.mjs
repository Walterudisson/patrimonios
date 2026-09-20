import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const raiz = new URL('../', import.meta.url);
const [html, app, controlador] = await Promise.all([
  readFile(new URL('index.html', raiz), 'utf8'),
  readFile(new URL('app.js', raiz), 'utf8'),
  readFile(new URL('js/controllers/camera.controller.js', raiz), 'utf8')
]);

function idsDoHtml(conteudo) {
  return new Set([...conteudo.matchAll(/\bid=["']([^"']+)["']/g)].map(resultado => resultado[1]));
}

function idsConsultados(conteudo) {
  const padroes = [
    /getElementById\(["']([^"']+)["']\)/g,
    /porId\(["']([^"']+)["']\)/g
  ];
  return padroes.flatMap(padrao => [...conteudo.matchAll(padrao)].map(resultado => resultado[1]));
}

test('todos os IDs estáticos consultados existem no HTML', () => {
  const ids = idsDoHtml(html);
  const ausentes = [...new Set([...idsConsultados(app), ...idsConsultados(controlador)])]
    .filter(id => !id.includes('${'))
    .filter(id => !ids.has(id));
  assert.deepEqual(ausentes, []);
});

test('o resultado fica antes do formulário no fluxo da tela', () => {
  assert.ok(html.indexOf('id="leitura-resultado"') < html.indexOf('id="scanner-form-card"'));
});

test('a orquestração da câmera reside no controlador dedicado', () => {
  assert.match(app, /criarControladorCamera/);
  assert.doesNotMatch(app, /new Html5Qrcode/);
  assert.match(controlador, /TEMPO_AJUDA_LEITURA_MS/);
});

test('a interface identifica a Sprint 0.9', () => {
  assert.match(html, /v1\.9\.0 • Sprint 0\.9/);
});
