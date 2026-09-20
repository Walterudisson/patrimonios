import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TEMPO_AJUDA_LEITURA_MS,
  calcularAreaLeitura,
  calcularMolduraSobreposicao,
  criarTextoResultado,
  descreverErroCamera,
  escolherCameraPreferida,
  extrairCandidatosOcr,
  limitarZoom,
  obterComportamentoRolagem
} from '../js/core/camera.js';

test('mantém a ajuda assistida em cinco segundos sem encerrar a câmera', () => {
  assert.equal(TEMPO_AJUDA_LEITURA_MS, 5000);
});

test('calcula uma área de leitura responsiva e limitada', () => {
  assert.deepEqual(calcularAreaLeitura(400, 800), { width: 328, height: 180 });
  assert.deepEqual(calcularAreaLeitura(240, 160), { width: 196, height: 90 });
});

test('centraliza a moldura visual sobre a imagem congelada', () => {
  assert.deepEqual(calcularMolduraSobreposicao(1000, 500), {
    x: 100,
    y: 160,
    width: 800,
    height: 180
  });
});

test('descreve a origem e o código no resultado da leitura', () => {
  assert.equal(
    criarTextoResultado('123456', 'codigo'),
    'Código de barras reconheceu a plaqueta 123456. Confira a localização antes de salvar.'
  );
  assert.equal(
    criarTextoResultado('987654', 'ocr'),
    'OCR reconheceu a plaqueta 987654. Confira a localização antes de salvar.'
  );
});

test('respeita a preferência de movimento reduzido na rolagem', () => {
  assert.equal(obterComportamentoRolagem(false), 'smooth');
  assert.equal(obterComportamentoRolagem(true), 'auto');
});

test('prioriza a câmera salva e depois uma câmera traseira', () => {
  const cameras = [
    { id: 'front', label: 'Câmera frontal' },
    { id: 'back', label: 'Câmera traseira' }
  ];
  assert.equal(escolherCameraPreferida(cameras, 'front').id, 'front');
  assert.equal(escolherCameraPreferida(cameras).id, 'back');
});

test('limita e arredonda o zoom conforme as capacidades', () => {
  const capacidades = { min: 1, max: 3, step: 0.5 };
  assert.equal(limitarZoom(9, capacidades), 3);
  assert.equal(limitarZoom(1.74, capacidades), 1.5);
});

test('extrai candidatos numéricos plausíveis do OCR', () => {
  assert.deepEqual(extrairCandidatosOcr('Patrimônio O1234-567\nruído'), ['01234567']);
});

test('explica falhas comuns de câmera', () => {
  assert.match(descreverErroCamera(null, { contextoSeguro: false }), /HTTPS/);
  assert.match(
    descreverErroCamera({ name: 'NotAllowedError' }, { contextoSeguro: true, possuiMediaDevices: true }),
    /Permissão/
  );
});
