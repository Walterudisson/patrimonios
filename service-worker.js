const VERSAO = 'v1.12.5';
const CACHE_SHELL = `cmapp-shell-${VERSAO}`;
const CACHE_RUNTIME = `cmapp-runtime-${VERSAO}`;
const PREFIXO_CACHE = 'cmapp-';

const ARQUIVOS_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './app.css',
  './app.js',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png',
  './js/config/firebase.js',
  './js/controllers/camera.controller.js',
  './js/core/camera.js',
  './js/core/movimentacao.js',
  './js/core/paginacao.js',
  './js/core/relacao.js',
  './js/core/perfil.js',
  './js/services/divisoes.service.js',
  './js/services/perfil.service.js',
  './js/ui/feedback.js',
  './js/ui/navigation.js',
  './js/pwa.js'
];

const DEPENDENCIAS_EXTERNAS = [
  'https://cdn.tailwindcss.com/',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://unpkg.com/tesseract.js@v5.1.0/dist/tesseract.min.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js'
];

const HOSTS_ESTATICOS = new Set(['cdn.tailwindcss.com', 'unpkg.com', 'www.gstatic.com']);

async function armazenarDependenciasExternas() {
  const cache = await caches.open(CACHE_RUNTIME);
  await Promise.allSettled(DEPENDENCIAS_EXTERNAS.map(async url => {
    const resposta = await fetch(url, { cache: 'reload' });
    if (resposta.ok || resposta.type === 'opaque') await cache.put(url, resposta);
  }));
}

self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE_SHELL);
    await cache.addAll(ARQUIVOS_SHELL);
    await armazenarDependenciasExternas();
  })());
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes
      .filter(nome => nome.startsWith(PREFIXO_CACHE) && ![CACHE_SHELL, CACHE_RUNTIME].includes(nome))
      .map(nome => caches.delete(nome)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', evento => {
  if (evento.data?.tipo === 'ATIVAR_ATUALIZACAO') self.skipWaiting();
});

async function redePrimeiro(requisicao, fallback) {
  try {
    const resposta = await fetch(requisicao);
    if (resposta.ok && requisicao.method === 'GET') {
      const cache = await caches.open(CACHE_RUNTIME);
      await cache.put(requisicao, resposta.clone());
    }
    return resposta;
  } catch (_) {
    return (await caches.match(requisicao, { ignoreSearch: true }))
      || (fallback ? await caches.match(fallback, { ignoreSearch: true }) : null)
      || Response.error();
  }
}

async function cachePrimeiroComAtualizacao(requisicao) {
  const cache = await caches.open(CACHE_RUNTIME);
  const armazenada = await caches.match(requisicao, { ignoreSearch: true });
  const atualizacao = fetch(requisicao)
    .then(resposta => {
      if (resposta.ok || resposta.type === 'opaque') cache.put(requisicao, resposta.clone());
      return resposta;
    })
    .catch(() => null);
  return armazenada || await atualizacao || Response.error();
}

self.addEventListener('fetch', evento => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET') return;

  const url = new URL(requisicao.url);
  if (requisicao.mode === 'navigate') {
    evento.respondWith(redePrimeiro(requisicao, './index.html').then(resposta => {
      if (resposta.type !== 'error') return resposta;
      return caches.match('./offline.html');
    }));
    return;
  }

  const recursoLocalEstatico = url.origin === self.location.origin
    && ['script', 'style', 'worker', 'image', 'font', 'manifest'].includes(requisicao.destination);
  if (recursoLocalEstatico) {
    const codigo = ['script', 'style', 'worker'].includes(requisicao.destination);
    evento.respondWith(codigo
      ? redePrimeiro(requisicao)
      : cachePrimeiroComAtualizacao(requisicao));
    return;
  }

  const dependenciaEstatica = HOSTS_ESTATICOS.has(url.hostname)
    && ['script', 'style', 'worker'].includes(requisicao.destination);
  if (dependenciaEstatica) evento.respondWith(cachePrimeiroComAtualizacao(requisicao));
});
