const TERMOS_CAMERA_TRASEIRA = [
  'back', 'rear', 'environment', 'traseira', 'posterior', 'externa'
];

export const TEMPO_AJUDA_LEITURA_MS = 10000;

export function calcularAreaLeitura(largura, altura) {
  const larguraSegura = Math.max(0, Number(largura) || 0);
  const alturaSegura = Math.max(0, Number(altura) || 0);
  const larguraArea = Math.max(180, Math.min(360, Math.floor(larguraSegura * 0.82)));
  const alturaArea = Math.max(90, Math.min(180, Math.floor(alturaSegura * 0.38)));
  return {
    width: Math.min(larguraArea, larguraSegura || larguraArea),
    height: Math.min(alturaArea, alturaSegura || alturaArea)
  };
}

export function escolherCameraPreferida(cameras = [], idPreferido = '') {
  if (!Array.isArray(cameras) || cameras.length === 0) return null;
  const cameraSalva = cameras.find(camera => camera.id === idPreferido);
  if (cameraSalva) return cameraSalva;

  const cameraTraseira = cameras.find(camera => {
    const rotulo = String(camera.label || '').toLocaleLowerCase('pt-BR');
    return TERMOS_CAMERA_TRASEIRA.some(termo => rotulo.includes(termo));
  });
  return cameraTraseira || cameras[cameras.length - 1];
}

export function limitarZoom(valor, capacidades = {}) {
  const minimo = Number.isFinite(capacidades.min) ? capacidades.min : 1;
  const maximo = Number.isFinite(capacidades.max) ? capacidades.max : 4;
  const passo = Number.isFinite(capacidades.step) && capacidades.step > 0
    ? capacidades.step
    : 0.1;
  const solicitado = Number.isFinite(Number(valor)) ? Number(valor) : minimo;
  const limitado = Math.min(maximo, Math.max(minimo, solicitado));
  const ajustado = minimo + Math.round((limitado - minimo) / passo) * passo;
  return Number(Math.min(maximo, Math.max(minimo, ajustado)).toFixed(2));
}

export function calcularMolduraSobreposicao(largura, altura) {
  const larguraSegura = Math.max(1, Number(largura) || 1);
  const alturaSegura = Math.max(1, Number(altura) || 1);
  const width = Math.round(larguraSegura * 0.8);
  const height = Math.round(alturaSegura * 0.36);
  return {
    x: Math.round((larguraSegura - width) / 2),
    y: Math.round((alturaSegura - height) / 2),
    width,
    height
  };
}

export function calcularRecortePreview(largura, altura) {
  const larguraSegura = Math.max(1, Number(largura) || 1);
  const alturaSegura = Math.max(1, Number(altura) || 1);
  const moldura = calcularMolduraSobreposicao(larguraSegura, alturaSegura);
  const margemHorizontal = Math.round(moldura.width * 0.04);
  const margemVertical = Math.round(moldura.height * 0.12);
  const x = Math.max(0, moldura.x - margemHorizontal);
  const y = Math.max(0, moldura.y - margemVertical);
  const limiteX = Math.min(larguraSegura, moldura.x + moldura.width + margemHorizontal);
  const limiteY = Math.min(alturaSegura, moldura.y + moldura.height + margemVertical);
  return {
    x,
    y,
    width: Math.max(1, limiteX - x),
    height: Math.max(1, limiteY - y)
  };
}

export function criarTextoResultado(codigo, origem = 'codigo') {
  const tipo = origem === 'ocr' ? 'OCR' : 'Código de barras';
  return `${tipo} reconheceu a plaqueta ${codigo}. Confira a localização antes de salvar.`;
}

export function obterComportamentoRolagem(reduzirMovimento = false) {
  return reduzirMovimento ? 'auto' : 'smooth';
}

export function extrairCandidatosOcr(texto = '', minimo = 5, maximo = 16) {
  const normalizado = String(texto)
    .toLocaleUpperCase('pt-BR')
    .replace(/[OQ]/g, '0')
    .replace(/[IL|]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');

  const candidatos = [];
  normalizado.split(/\r?\n/).forEach(linha => {
    const gruposCompactos = linha.match(/\d(?:[._/-]?\d){4,15}/g) || [];
    gruposCompactos.forEach(grupo => candidatos.push(grupo.replace(/\D/g, '')));

    const linhaSemSeparadores = linha.replace(/[\d\s._/-]/g, '');
    const digitosDaLinha = linha.replace(/\D/g, '');
    if (!linhaSemSeparadores && digitosDaLinha.length >= minimo && digitosDaLinha.length <= maximo) {
      candidatos.push(digitosDaLinha);
    }
  });

  return [...new Set(candidatos)]
    .filter(numero => numero.length >= minimo && numero.length <= maximo)
    .sort((a, b) => b.length - a.length || a.localeCompare(b, 'pt-BR', { numeric: true }));
}

export function descreverErroCamera(erro, ambiente = {}) {
  const nome = String(erro?.name || '');
  const mensagem = String(erro?.message || erro || '').toLocaleLowerCase('pt-BR');

  if (ambiente.contextoSeguro === false) {
    return 'A câmera exige HTTPS ou acesso por localhost. Abra o sistema em uma conexão segura.';
  }
  if (ambiente.possuiMediaDevices === false) {
    return 'Este navegador não oferece acesso compatível à câmera. Use a digitação manual.';
  }
  if (nome === 'NotAllowedError' || mensagem.includes('notallowed')
    || mensagem.includes('permission') || mensagem.includes('permiss') || mensagem.includes('denied')) {
    return 'Permissão da câmera negada. Libere o acesso nas configurações do navegador e tente novamente.';
  }
  if (nome === 'NotFoundError' || nome === 'DevicesNotFoundError' || mensagem.includes('not found')) {
    return 'Nenhuma câmera compatível foi encontrada neste dispositivo.';
  }
  if (nome === 'NotReadableError' || nome === 'TrackStartError'
    || mensagem.includes('notreadable') || mensagem.includes('could not start')) {
    return 'A câmera está ocupada por outro aplicativo ou não pôde ser iniciada. Feche outros usos da câmera e tente novamente.';
  }
  if (nome === 'OverconstrainedError') {
    return 'A câmera selecionada não aceita a configuração solicitada. Escolha outra câmera.';
  }
  if (nome === 'AbortError') {
    return 'A inicialização da câmera foi interrompida. Tente ligá-la novamente.';
  }
  return 'Não foi possível iniciar a câmera. Verifique a permissão e tente novamente; a digitação manual continua disponível.';
}

export function obterCapacidadesVideo(track) {
  if (!track) return { zoom: null, torch: false, focoContinuo: false };
  let capacidades = {};
  try {
    capacidades = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
  } catch (_) {
    capacidades = {};
  }
  return {
    zoom: capacidades.zoom && Number.isFinite(capacidades.zoom.min)
      ? {
          min: capacidades.zoom.min,
          max: capacidades.zoom.max,
          step: capacidades.zoom.step || 0.1
        }
      : null,
    torch: capacidades.torch === true,
    focoContinuo: Array.isArray(capacidades.focusMode)
      && capacidades.focusMode.includes('continuous')
  };
}
