import {
  TEMPO_AJUDA_LEITURA_MS,
  calcularAreaLeitura,
  calcularRecortePreview,
  criarTextoResultado,
  descreverErroCamera,
  escolherCameraPreferida,
  extrairCandidatosOcr,
  limitarZoom,
  obterCapacidadesVideo,
  obterComportamentoRolagem
} from '../core/camera.js?v=1.9.2';

export function criarControladorCamera({
  limparPlaqueta,
  aoReconhecerPlaqueta,
  aoPrepararNovaLeitura = () => {},
  podeManterCamera = () => true
}) {
  let scanner = null;
  let cameraAtiva = false;
  let cameraIniciando = false;
  let cameraPausadaPorLeitura = false;
  let cameraRetomarAoVoltar = false;
  let leituraPendenteSemCamera = false;
  let cameraTrack = null;
  let cameraIdAtual = '';
  let camerasDisponiveis = [];
  let cameraPossuiZoomHardware = false;
  let cameraTorchAtiva = false;
  let ocrEmAndamento = false;
  let leituraCameraEmAndamento = false;
  let ultimoCodigoLido = '';
  let instanteUltimoCodigo = 0;
  let nivelZoomAtual = 1;
  let distanciaInicialPinca = 0;
  let timerOrientacao = null;
  let timerAjuda = null;
  let ajudaIgnoradaNestaTentativa = false;
  let inicializado = false;

  const porId = id => document.getElementById(id);

  function obterCameraPreferidaSalva() {
    try { return sessionStorage.getItem('cmapp-camera-preferida') || ''; }
    catch (_) { return ''; }
  }

  function salvarCameraPreferida(cameraId) {
    if (!cameraId) return;
    try { sessionStorage.setItem('cmapp-camera-preferida', cameraId); }
    catch (_) {}
  }

  function rolarPara(elemento, block = 'start') {
    if (!elemento) return;
    const reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    requestAnimationFrame(() => elemento.scrollIntoView({
      behavior: obterComportamentoRolagem(reduzirMovimento),
      block,
      inline: 'nearest'
    }));
  }

  function centralizarCamera() {
    rolarPara(porId('scanner-camera-card'), 'center');
  }

  function esconderAjuda({ ignorar = false } = {}) {
    clearTimeout(timerAjuda);
    timerAjuda = null;
    if (ignorar) ajudaIgnoradaNestaTentativa = true;
    porId('camera-assistance')?.classList.add('hidden');
  }

  function iniciarTemporizadorAjuda() {
    esconderAjuda();
    if (!cameraAtiva || cameraPausadaPorLeitura || ajudaIgnoradaNestaTentativa) return;
    timerAjuda = window.setTimeout(() => {
      if (cameraAtiva && !cameraPausadaPorLeitura && !ocrEmAndamento) {
        porId('camera-assistance')?.classList.remove('hidden');
      }
    }, TEMPO_AJUDA_LEITURA_MS);
  }

  function definirEstadoCamera(estado, mensagem) {
    const status = porId('camera-status');
    const statusIcon = porId('camera-status-icon');
    const statusText = porId('camera-status-text');
    const btnCam = porId('btn-toggle-cam');
    const controles = porId('camera-controls-bar');
    const btnOcr = porId('btn-capturar-frame');
    const btnRetomar = porId('btn-retomar-leitura');
    const readerContainer = porId('reader-container');
    const icones = { idle: '📷', starting: '⏳', running: '🟢', paused: '⏸️', error: '⚠️' };

    const resultadoVisivel = !porId('leitura-resultado')?.classList.contains('hidden');
    const ocultarStatusDuplicado = estado === 'paused'
      && cameraPausadaPorLeitura
      && resultadoVisivel
      && !ocrEmAndamento;
    status.className = `camera-status camera-status-${estado}${ocultarStatusDuplicado ? ' camera-status-result' : ''}`;
    statusIcon.textContent = icones[estado] || '📷';
    statusText.textContent = mensagem;
    btnCam.disabled = estado === 'starting';
    btnCam.textContent = estado === 'starting'
      ? 'Iniciando...'
      : (cameraAtiva ? 'Desligar Câmera' : (estado === 'error' ? 'Tentar novamente' : 'Ligar Câmera'));

    const exibirControles = cameraAtiva && (estado === 'running' || estado === 'paused');
    controles.classList.toggle('hidden', !exibirControles);
    btnOcr.classList.toggle('hidden', estado !== 'running');
    btnRetomar.classList.toggle('hidden', !(estado === 'paused' && cameraPausadaPorLeitura && !ocrEmAndamento));
    readerContainer.classList.toggle('camera-running', estado === 'running');
    readerContainer.classList.toggle('camera-paused', estado === 'paused');
    if (estado !== 'running') esconderAjuda();
  }

  function exibirFeedbackCamera(mensagem, tipo = 'erro') {
    const feedback = porId('camera-feedback');
    feedback.textContent = mensagem;
    feedback.className = tipo === 'erro'
      ? 'camera-feedback border-red-500/50 bg-red-950/50 text-red-200'
      : 'camera-feedback';
    feedback.classList.remove('hidden');
    window.setTimeout(() => {
      if (feedback.textContent === mensagem) feedback.classList.add('hidden');
    }, 4500);
  }

  function obterTrackCamera() {
    const video = document.querySelector('#reader video');
    return video?.srcObject?.getVideoTracks?.()[0] || null;
  }

  function atualizarSeletorCameras() {
    const select = porId('select-camera');
    select.replaceChildren();
    camerasDisponiveis.forEach((camera, indice) => {
      const option = document.createElement('option');
      option.value = camera.id;
      option.textContent = camera.label || `Câmera ${indice + 1}`;
      option.selected = camera.id === cameraIdAtual;
      select.appendChild(option);
    });
    select.disabled = camerasDisponiveis.length < 2;
    if (camerasDisponiveis.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Câmera em uso';
      select.appendChild(option);
    }
  }

  async function configurarRecursosCamera() {
    cameraTrack = obterTrackCamera();
    const capacidades = obterCapacidadesVideo(cameraTrack);
    const zoomInput = porId('camera-zoom');
    const focoStatus = porId('camera-focus-status');
    const btnTorch = porId('btn-camera-torch');
    const configuracoesTrack = cameraTrack?.getSettings?.() || {};

    if (configuracoesTrack.deviceId) {
      cameraIdAtual = configuracoesTrack.deviceId;
      salvarCameraPreferida(cameraIdAtual);
      atualizarSeletorCameras();
    }

    cameraPossuiZoomHardware = Boolean(capacidades.zoom);
    if (capacidades.zoom) {
      zoomInput.min = capacidades.zoom.min;
      zoomInput.max = capacidades.zoom.max;
      zoomInput.step = capacidades.zoom.step;
      nivelZoomAtual = limitarZoom(configuracoesTrack.zoom || capacidades.zoom.min, capacidades.zoom);
    } else {
      zoomInput.min = 1;
      zoomInput.max = 4;
      zoomInput.step = 0.1;
      nivelZoomAtual = 1;
    }
    zoomInput.value = nivelZoomAtual;
    porId('camera-zoom-value').textContent = `${nivelZoomAtual.toFixed(1)}x${cameraPossuiZoomHardware ? '' : ' digital'}`;
    porId('reader-container').style.setProperty('--camera-css-zoom', '1');

    btnTorch.classList.toggle('hidden', !capacidades.torch);
    btnTorch.setAttribute('aria-pressed', 'false');
    btnTorch.textContent = '🔦 Lanterna';
    cameraTorchAtiva = false;

    if (capacidades.focoContinuo) {
      try { await cameraTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); }
      catch (_) {}
      focoStatus.textContent = 'Foco contínuo';
      focoStatus.classList.remove('unsupported');
    } else {
      focoStatus.textContent = 'Foco automático';
      focoStatus.classList.add('unsupported');
    }
  }

  async function aplicarZoomCamera(valor) {
    const zoomInput = porId('camera-zoom');
    const zoomValue = porId('camera-zoom-value');
    if (cameraPossuiZoomHardware && cameraTrack) {
      const capacidades = obterCapacidadesVideo(cameraTrack).zoom;
      nivelZoomAtual = limitarZoom(valor, capacidades || {});
      try {
        await cameraTrack.applyConstraints({ advanced: [{ zoom: nivelZoomAtual }] });
      } catch (erro) {
        console.warn('Zoom óptico indisponível; usando aproximação digital.', erro);
        cameraPossuiZoomHardware = false;
      }
    } else {
      nivelZoomAtual = limitarZoom(valor, { min: 1, max: 4, step: 0.1 });
    }
    zoomInput.value = nivelZoomAtual;
    zoomValue.textContent = `${nivelZoomAtual.toFixed(1)}x${cameraPossuiZoomHardware ? '' : ' digital'}`;
    porId('reader-container').style.setProperty(
      '--camera-css-zoom',
      cameraPossuiZoomHardware ? '1' : String(nivelZoomAtual)
    );
  }

  function capturarQuadroVideo() {
    const video = document.querySelector('#reader video');
    if (!video || video.readyState < 2 || !video.videoWidth) return null;
    const escala = Math.min(1, 1280 / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(video.videoWidth * escala));
    canvas.height = Math.max(1, Math.floor(video.videoHeight * escala));
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function desenharPreviewRecortado(quadroFonte) {
    const canvas = porId('leitura-preview');
    const largura = quadroFonte?.width || 640;
    const altura = quadroFonte?.height || 360;
    const recorte = calcularRecortePreview(largura, altura);
    canvas.width = recorte.width;
    canvas.height = recorte.height;
    const ctx = canvas.getContext('2d');

    if (quadroFonte) {
      ctx.drawImage(
        quadroFonte,
        recorte.x, recorte.y, recorte.width, recorte.height,
        0, 0, canvas.width, canvas.height
      );
    }
    else {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function limparResultadoLeitura() {
    const resultado = porId('leitura-resultado');
    resultado.classList.add('hidden');
    porId('camera-status').classList.remove('camera-status-result');
    porId('leitura-resultado-codigo').textContent = '---';
    const canvas = porId('leitura-preview');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    porId('reader-container').classList.remove('camera-success');
  }

  function exibirResultadoLeitura(codigo, origem, quadroFonte) {
    const resultado = porId('leitura-resultado');
    porId('leitura-resultado-origem').textContent = origem === 'ocr' ? 'RECONHECIDO POR OCR' : 'RECONHECIDO PELO CÓDIGO';
    porId('leitura-resultado-codigo').textContent = codigo;
    porId('leitura-resultado-texto').textContent = criarTextoResultado(codigo, origem);
    desenharPreviewRecortado(quadroFonte);
    resultado.classList.remove('hidden');
    porId('camera-status').classList.add('camera-status-result');
    resultado.focus({ preventScroll: true });
    rolarPara(resultado, 'start');
  }

  async function desligarCamera({
    preservarIntento = false,
    mensagem = '',
    limparResultado = false,
    retomarAposSalvar = false
  } = {}) {
    const haviaLeituraPendente = cameraPausadaPorLeitura && !porId('leitura-resultado').classList.contains('hidden');
    cameraRetomarAoVoltar = preservarIntento && !haviaLeituraPendente;
    leituraPendenteSemCamera = retomarAposSalvar && haviaLeituraPendente;
    cameraPausadaPorLeitura = false;
    ocrEmAndamento = false;
    esconderAjuda();
    try {
      if (scanner && cameraAtiva) await scanner.stop();
    } catch (erro) {
      console.warn('A câmera já estava encerrada.', erro);
    }
    cameraAtiva = false;
    cameraTrack = null;
    cameraTorchAtiva = false;
    cameraPossuiZoomHardware = false;
    try { scanner?.clear(); } catch (_) {}
    porId('reader').textContent = preservarIntento ? 'Câmera pausada' : 'Câmera desligada';
    if (limparResultado) {
      limparResultadoLeitura();
      leituraPendenteSemCamera = false;
    }
    definirEstadoCamera(
      preservarIntento ? 'paused' : 'idle',
      mensagem || (haviaLeituraPendente
        ? 'Leitura preservada. Confira o formulário antes de iniciar outra captura.'
        : (preservarIntento
          ? 'Câmera pausada enquanto o aplicativo está em segundo plano.'
          : 'Câmera desligada. A digitação manual continua disponível.'))
    );
  }

  async function iniciarCamera(cameraSolicitada = '', { centralizar = false, novaTentativa = true } = {}) {
    if (cameraIniciando || cameraAtiva) return;
    cameraRetomarAoVoltar = false;
    leituraPendenteSemCamera = false;
    if (novaTentativa) {
      ajudaIgnoradaNestaTentativa = false;
      limparResultadoLeitura();
      await aoPrepararNovaLeitura();
    }

    const ambiente = {
      contextoSeguro: window.isSecureContext,
      possuiMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia)
    };
    const Html5QrcodeClass = window.Html5Qrcode;
    const formatos = window.Html5QrcodeSupportedFormats;
    if (!ambiente.contextoSeguro || !ambiente.possuiMediaDevices || !Html5QrcodeClass || !formatos) {
      definirEstadoCamera('error', descreverErroCamera(null, ambiente));
      return;
    }

    cameraIniciando = true;
    definirEstadoCamera('starting', 'Solicitando acesso e preparando a câmera...');
    try {
      if (!scanner) scanner = new Html5QrcodeClass('reader');
      try { camerasDisponiveis = await Html5QrcodeClass.getCameras(); }
      catch (_) { camerasDisponiveis = []; }

      const preferida = escolherCameraPreferida(
        camerasDisponiveis,
        cameraSolicitada || obterCameraPreferidaSalva()
      );
      const origemCamera = preferida?.id || { facingMode: 'environment' };
      const config = {
        fps: 12,
        qrbox: (largura, altura) => calcularAreaLeitura(largura, altura),
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        formatsToSupport: [
          formatos.CODE_128,
          formatos.CODE_39,
          formatos.EAN_13,
          formatos.EAN_8,
          formatos.QR_CODE
        ]
      };

      await scanner.start(
        origemCamera,
        config,
        decodedText => processarCodigoDetectado(decodedText),
        () => {}
      );

      cameraAtiva = true;
      cameraIdAtual = preferida?.id || '';
      if (!podeManterCamera()) {
        await desligarCamera();
        return;
      }
      if (cameraIdAtual) salvarCameraPreferida(cameraIdAtual);
      if (camerasDisponiveis.length === 0) {
        try { camerasDisponiveis = await Html5QrcodeClass.getCameras(); }
        catch (_) {}
      }
      atualizarSeletorCameras();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await configurarRecursosCamera();
      definirEstadoCamera('running', 'Câmera ativa. Centralize o código dentro da moldura.');
      iniciarTemporizadorAjuda();
      if (centralizar) centralizarCamera();
    } catch (erro) {
      console.error('Falha ao iniciar a câmera:', erro);
      cameraAtiva = false;
      cameraTrack = null;
      try { scanner?.clear(); } catch (_) {}
      scanner = null;
      definirEstadoCamera('error', descreverErroCamera(erro, ambiente));
    } finally {
      cameraIniciando = false;
    }
  }

  async function pausarLeituraCamera(mensagem) {
    if (!cameraAtiva || cameraPausadaPorLeitura) return;
    esconderAjuda();
    try { scanner.pause(true); }
    catch (_) { return; }
    cameraPausadaPorLeitura = true;
    definirEstadoCamera('paused', mensagem);
  }

  async function retomarLeituraCamera({ limparFormulario = true } = {}) {
    if (!cameraAtiva || !cameraPausadaPorLeitura) return;
    try {
      scanner.resume();
      cameraPausadaPorLeitura = false;
      leituraPendenteSemCamera = false;
      ajudaIgnoradaNestaTentativa = false;
      limparResultadoLeitura();
      porId('camera-feedback').classList.add('hidden');
      if (limparFormulario) await aoPrepararNovaLeitura();
      definirEstadoCamera('running', 'Câmera ativa. Centralize o próximo código dentro da moldura.');
      iniciarTemporizadorAjuda();
    } catch (_) {
      await desligarCamera({
        preservarIntento: true,
        mensagem: 'A câmera foi interrompida. Toque em “Ligar Câmera” para tentar novamente.'
      });
    }
  }

  async function processarCodigoDetectado(codigoLido) {
    const codigo = limparPlaqueta(codigoLido);
    const agora = Date.now();
    if (ocrEmAndamento || leituraCameraEmAndamento || codigo.length < 3
      || (codigo === ultimoCodigoLido && agora - instanteUltimoCodigo < 2500)) return;

    leituraCameraEmAndamento = true;
    ultimoCodigoLido = codigo;
    instanteUltimoCodigo = agora;
    const quadro = capturarQuadroVideo();
    try {
      await pausarLeituraCamera(`Código ${codigo} reconhecido. Confira os dados antes de salvar.`);
      porId('reader-container').classList.add('camera-success');
      if (navigator.vibrate) navigator.vibrate([80, 40, 100]);
      exibirResultadoLeitura(codigo, 'codigo', quadro);
      try {
        await aoReconhecerPlaqueta(codigo, 'codigo');
      } catch (erro) {
        console.error('Falha ao consultar a plaqueta reconhecida:', erro);
        exibirFeedbackCamera('A plaqueta foi reconhecida, mas a consulta falhou. Verifique a conexão e tente buscar novamente.', 'erro');
      }
    } finally {
      leituraCameraEmAndamento = false;
    }
  }

  async function executarOcr() {
    if (!cameraAtiva || !scanner || ocrEmAndamento) return;
    const ocrStatus = porId('ocr-status');
    const btnOcr = porId('btn-capturar-frame');
    ocrEmAndamento = true;
    esconderAjuda();
    btnOcr.disabled = true;
    ocrStatus.textContent = 'Preparando imagem para leitura...';
    ocrStatus.classList.remove('hidden');

    try {
      const video = document.querySelector('#reader video');
      if (!video || video.readyState < 2 || !video.videoWidth) {
        throw new Error('Feed de vídeo indisponível no momento.');
      }

      const quadroCompleto = capturarQuadroVideo();
      const origemLargura = video.videoWidth;
      const origemAltura = video.videoHeight;
      const recorteLargura = Math.floor(origemLargura * 0.9);
      const recorteAltura = Math.floor(origemAltura * 0.48);
      const origemX = Math.floor((origemLargura - recorteLargura) / 2);
      const origemY = Math.floor((origemAltura - recorteAltura) / 2);
      const escala = Math.min(1, 1600 / recorteLargura);
      const canvasOcr = document.createElement('canvas');
      canvasOcr.width = Math.max(1, Math.floor(recorteLargura * escala));
      canvasOcr.height = Math.max(1, Math.floor(recorteAltura * escala));
      const ctx = canvasOcr.getContext('2d', { willReadFrequently: true });
      ctx.filter = 'grayscale(1) contrast(1.8)';
      ctx.drawImage(
        video,
        origemX, origemY, recorteLargura, recorteAltura,
        0, 0, canvasOcr.width, canvasOcr.height
      );

      await pausarLeituraCamera('Processando a numeração impressa por OCR...');
      const TesseractClass = window.Tesseract;
      if (!TesseractClass) {
        throw new Error('O mecanismo de OCR não foi carregado. Verifique a conexão ou digite a plaqueta manualmente.');
      }
      const result = await TesseractClass.recognize(canvasOcr, 'eng', {
        logger: progresso => {
          if (progresso.status === 'recognizing text') {
            ocrStatus.textContent = `Processando OCR: ${Math.round((progresso.progress || 0) * 100)}%`;
          }
        }
      });

      const [numeroReconhecido] = extrairCandidatosOcr(result.data.text);
      if (numeroReconhecido) {
        porId('reader-container').classList.add('camera-success');
        if (navigator.vibrate) navigator.vibrate([80, 40, 100]);
        exibirResultadoLeitura(numeroReconhecido, 'ocr', quadroCompleto);
        try {
          await aoReconhecerPlaqueta(numeroReconhecido, 'ocr');
        } catch (erro) {
          console.error('Falha ao consultar a plaqueta reconhecida por OCR:', erro);
          exibirFeedbackCamera('O OCR reconheceu a plaqueta, mas a consulta falhou. Verifique a conexão e tente buscar novamente.', 'erro');
        }
        definirEstadoCamera('paused', `OCR reconheceu ${numeroReconhecido}. Confira os dados antes de salvar.`);
      } else {
        exibirFeedbackCamera('O OCR não encontrou uma numeração clara. Aproxime a etiqueta, melhore a iluminação ou digite a plaqueta.', 'erro');
        ocrEmAndamento = false;
        await retomarLeituraCamera({ limparFormulario: false });
      }
    } catch (erro) {
      console.error('Erro durante o OCR:', erro);
      exibirFeedbackCamera(erro.message || 'Não foi possível processar a imagem por OCR.', 'erro');
      ocrEmAndamento = false;
      await retomarLeituraCamera({ limparFormulario: false });
    } finally {
      ocrEmAndamento = false;
      btnOcr.disabled = false;
      ocrStatus.classList.add('hidden');
      if (cameraAtiva && cameraPausadaPorLeitura) {
        definirEstadoCamera('paused', porId('camera-status-text').textContent);
      }
    }
  }

  async function retomarAposSalvar() {
    limparResultadoLeitura();
    if (cameraAtiva && cameraPausadaPorLeitura) {
      await retomarLeituraCamera({ limparFormulario: false });
    } else if (leituraPendenteSemCamera && podeManterCamera()) {
      leituraPendenteSemCamera = false;
      ajudaIgnoradaNestaTentativa = false;
      await iniciarCamera(cameraIdAtual, { centralizar: false, novaTentativa: false });
    }
  }

  function inicializarEventos() {
    if (inicializado) return;
    inicializado = true;

    porId('btn-toggle-cam').addEventListener('click', async () => {
      if (cameraAtiva) await desligarCamera();
      else await iniciarCamera(cameraIdAtual, { centralizar: true, novaTentativa: true });
    });

    porId('select-camera').addEventListener('change', async event => {
      const cameraSelecionada = event.target.value;
      if (!cameraSelecionada || cameraSelecionada === cameraIdAtual) return;
      await desligarCamera({ preservarIntento: true, mensagem: 'Trocando a câmera selecionada...' });
      cameraIdAtual = cameraSelecionada;
      salvarCameraPreferida(cameraSelecionada);
      ajudaIgnoradaNestaTentativa = false;
      await iniciarCamera(cameraSelecionada, { centralizar: false, novaTentativa: false });
    });

    porId('camera-zoom').addEventListener('input', event => aplicarZoomCamera(Number(event.target.value)));

    const readerContainer = porId('reader-container');
    readerContainer.addEventListener('touchstart', event => {
      if (event.touches.length !== 2 || !cameraAtiva) return;
      distanciaInicialPinca = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
    }, { passive: true });
    readerContainer.addEventListener('touchmove', event => {
      if (event.touches.length !== 2 || !cameraAtiva || distanciaInicialPinca <= 0) return;
      const distanciaAtual = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      const diferenca = distanciaAtual - distanciaInicialPinca;
      if (Math.abs(diferenca) >= 24) {
        event.preventDefault();
        aplicarZoomCamera(nivelZoomAtual + (diferenca > 0 ? 0.25 : -0.25));
        distanciaInicialPinca = distanciaAtual;
      }
    }, { passive: false });
    readerContainer.addEventListener('touchend', () => { distanciaInicialPinca = 0; }, { passive: true });

    porId('btn-camera-torch').addEventListener('click', async event => {
      if (!cameraTrack) return;
      const proximoEstado = !cameraTorchAtiva;
      try {
        await cameraTrack.applyConstraints({ advanced: [{ torch: proximoEstado }] });
        cameraTorchAtiva = proximoEstado;
        event.currentTarget.setAttribute('aria-pressed', String(proximoEstado));
        event.currentTarget.textContent = proximoEstado ? '🔦 Desligar' : '🔦 Lanterna';
      } catch (_) {
        exibirFeedbackCamera('A lanterna não pôde ser controlada neste dispositivo.', 'erro');
      }
    });

    porId('btn-retomar-leitura').addEventListener('click', () => retomarLeituraCamera({ limparFormulario: true }));
    porId('btn-capturar-frame').addEventListener('click', executarOcr);
    porId('btn-ajuda-ocr').addEventListener('click', () => {
      esconderAjuda({ ignorar: true });
      executarOcr();
    });
    porId('btn-ajuda-manual').addEventListener('click', async () => {
      esconderAjuda({ ignorar: true });
      await pausarLeituraCamera('Leitura pausada para digitação manual. Use “Ler outra plaqueta” para voltar à câmera.');
      const input = porId('input-plaqueta');
      rolarPara(input, 'center');
      window.setTimeout(() => input.focus({ preventScroll: true }), 250);
    });
    porId('btn-ajuda-continuar').addEventListener('click', () => esconderAjuda({ ignorar: true }));

    document.addEventListener('visibilitychange', async () => {
      if (document.hidden && cameraAtiva) {
        await desligarCamera({
          preservarIntento: true,
          mensagem: 'Câmera pausada enquanto o aplicativo está em segundo plano.',
          retomarAposSalvar: true
        });
      } else if (!document.hidden && cameraRetomarAoVoltar && podeManterCamera()) {
        const cameraParaRetomar = cameraIdAtual;
        cameraRetomarAoVoltar = false;
        ajudaIgnoradaNestaTentativa = false;
        await iniciarCamera(cameraParaRetomar, { centralizar: false, novaTentativa: false });
      }
    });

    window.addEventListener('orientationchange', () => {
      clearTimeout(timerOrientacao);
      timerOrientacao = window.setTimeout(async () => {
        if (!cameraAtiva || cameraPausadaPorLeitura || !podeManterCamera()) return;
        const cameraParaRetomar = cameraIdAtual;
        await desligarCamera({ preservarIntento: true, mensagem: 'Ajustando a câmera à nova orientação...' });
        cameraRetomarAoVoltar = false;
        ajudaIgnoradaNestaTentativa = false;
        await iniciarCamera(cameraParaRetomar, { centralizar: false, novaTentativa: false });
      }, 450);
    });

    window.addEventListener('pagehide', () => {
      if (cameraAtiva) desligarCamera();
    });
  }

  return {
    inicializar: inicializarEventos,
    iniciar: iniciarCamera,
    desligar: desligarCamera,
    estaAtiva: () => cameraAtiva,
    retomarAposSalvar,
    limparResultado: limparResultadoLeitura
  };
}
