const CHAVE_INSTALACAO_RECUSADA = 'cmapp-instalacao-recusada-em';
const INTERVALO_NOVA_OFERTA_MS = 7 * 24 * 60 * 60 * 1000;

let eventoInstalacao = null;
let recarregandoAposAtualizacao = false;

export function estaEmModoInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function ofertaFoiRecusadaRecentemente() {
  try {
    const quando = Number(localStorage.getItem(CHAVE_INSTALACAO_RECUSADA));
    return Number.isFinite(quando) && Date.now() - quando < INTERVALO_NOVA_OFERTA_MS;
  } catch (_) {
    return false;
  }
}

function atualizarInterfaceInstalacao() {
  const instalado = estaEmModoInstalado();
  const podeInstalar = Boolean(eventoInstalacao) && !instalado;
  document.getElementById('btn-instalar-app-menu')?.classList.toggle('hidden', !podeInstalar);
  document.getElementById('btn-instalar-app')?.classList.toggle('hidden', !podeInstalar);

  const status = document.getElementById('pwa-install-status');
  if (status) {
    if (instalado) status.textContent = 'O CM APP está instalado e sendo executado em modo de aplicativo.';
    else if (podeInstalar) status.textContent = 'Instale o CM APP para abrir por um ícone e usar uma janela sem a barra do navegador.';
    else status.textContent = 'A instalação pode ser feita pelo menu do navegador quando estiver disponível.';
  }
}

async function solicitarInstalacao(notificarMensagem) {
  if (!eventoInstalacao) return;
  const evento = eventoInstalacao;
  eventoInstalacao = null;
  atualizarInterfaceInstalacao();
  await evento.prompt();
  const escolha = await evento.userChoice;
  if (escolha.outcome === 'accepted') {
    try { localStorage.removeItem(CHAVE_INSTALACAO_RECUSADA); } catch (_) {}
    notificarMensagem('Instalação iniciada. O CM APP será adicionado ao dispositivo.', 'sucesso');
  } else {
    try { localStorage.setItem(CHAVE_INSTALACAO_RECUSADA, String(Date.now())); } catch (_) {}
  }
}

function configurarConectividade(notificarMensagem) {
  let estavaOffline = !navigator.onLine;
  const atualizar = () => {
    const online = navigator.onLine;
    document.getElementById('app-offline-banner')?.classList.toggle('hidden', online);
    document.getElementById('login-offline')?.classList.toggle('hidden', online);
    document.body.classList.toggle('app-offline', !online);
    if (online && estavaOffline) {
      notificarMensagem('Conexão restabelecida. Os dados podem ser consultados novamente.', 'sucesso');
    }
    estavaOffline = !online;
  };
  window.addEventListener('online', atualizar);
  window.addEventListener('offline', atualizar);
  atualizar();
}

function oferecerAtualizacao(worker, notificarMensagem) {
  if (!worker) return;
  notificarMensagem('Uma nova versão do CM APP está pronta para uso.', 'info', {
    titulo: 'Atualização disponível',
    persistente: true,
    acaoTexto: 'ATUALIZAR AGORA',
    aoAcao: () => worker.postMessage({ tipo: 'ATIVAR_ATUALIZACAO' })
  });
}

async function registrarServiceWorker(notificarMensagem) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registro = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    if (registro.waiting) oferecerAtualizacao(registro.waiting, notificarMensagem);

    registro.addEventListener('updatefound', () => {
      const worker = registro.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          oferecerAtualizacao(worker, notificarMensagem);
        }
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recarregandoAposAtualizacao) return;
      recarregandoAposAtualizacao = true;
      window.location.reload();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registro.update().catch(() => {});
    });
  } catch (erro) {
    console.error('Não foi possível registrar o modo PWA:', erro);
  }
}

export function inicializarPwa({ notificarMensagem }) {
  configurarConectividade(notificarMensagem);
  atualizarInterfaceInstalacao();

  window.addEventListener('beforeinstallprompt', evento => {
    evento.preventDefault();
    eventoInstalacao = evento;
    if (!ofertaFoiRecusadaRecentemente()) atualizarInterfaceInstalacao();
  });

  window.addEventListener('appinstalled', () => {
    eventoInstalacao = null;
    atualizarInterfaceInstalacao();
    notificarMensagem('CM APP instalado com sucesso neste dispositivo.', 'sucesso');
  });

  ['btn-instalar-app', 'btn-instalar-app-menu'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => solicitarInstalacao(notificarMensagem));
  });

  registrarServiceWorker(notificarMensagem);
}
