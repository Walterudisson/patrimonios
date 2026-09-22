const PAGINAS = {
  dashboard: { titulo: 'Painel', trilha: ['CM APP', 'Painel'] },
  scanner: { titulo: 'Leitura', trilha: ['CM APP', 'Patrimônio', 'Leitura'] },
  lista: { titulo: 'Relação', trilha: ['CM APP', 'Patrimônio', 'Relação'] },
  transferencias: { titulo: 'Fila de aprovação', trilha: ['CM APP', 'Movimentações', 'Fila'] },
  usuarios: { titulo: 'Gestão de usuários', trilha: ['CM APP', 'Gestão', 'Usuários'] },
  inventarios: { titulo: 'Inventários', trilha: ['CM APP', 'Patrimônio', 'Inventários'] },
  perfil: { titulo: 'Meu perfil', trilha: ['CM APP', 'Conta', 'Meu perfil'] }
};

let navegar = () => {};
let registrarCamada = () => {};
let removerCamada = () => {};

function iniciais(nome = '') {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'CM';
  return `${partes[0][0] || ''}${partes.length > 1 ? partes.at(-1)[0] : ''}`.toLocaleUpperCase('pt-BR');
}

function ehDesktop() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

export function fecharNavegacaoMovel({ sincronizarHistorico = false } = {}) {
  const estavaAberta = document.body.classList.contains('sidebar-open');
  document.body.classList.remove('sidebar-open');
  const overlay = document.getElementById('sidebar-overlay');
  overlay?.classList.add('hidden');
  overlay?.setAttribute('aria-hidden', 'true');
  document.getElementById('btn-menu')?.setAttribute('aria-expanded', 'false');
  if (estavaAberta && sincronizarHistorico) removerCamada('menu');
  return estavaAberta;
}

function alternarSidebar() {
  if (ehDesktop()) {
    const recolhida = document.body.classList.toggle('sidebar-collapsed');
    try { localStorage.setItem('cmapp-sidebar-recolhida', String(recolhida)); } catch (_) {}
    document.getElementById('btn-menu')?.setAttribute('aria-expanded', String(!recolhida));
    return;
  }
  const aberta = document.body.classList.toggle('sidebar-open');
  const overlay = document.getElementById('sidebar-overlay');
  overlay?.classList.toggle('hidden', !aberta);
  overlay?.setAttribute('aria-hidden', String(!aberta));
  document.getElementById('btn-menu')?.setAttribute('aria-expanded', String(aberta));
  if (aberta) registrarCamada('menu');
  else removerCamada('menu');
}

function fecharPerfil({ sincronizarHistorico = false } = {}) {
  const menu = document.getElementById('profile-menu');
  const estavaAberto = Boolean(menu && !menu.classList.contains('hidden'));
  menu?.classList.add('hidden');
  document.getElementById('btn-profile-menu')?.setAttribute('aria-expanded', 'false');
  if (estavaAberto && sincronizarHistorico) removerCamada('perfil');
  return estavaAberto;
}

export function fecharCamadasNavegacao() {
  const perfilFechado = fecharPerfil();
  const menuFechado = fecharNavegacaoMovel();
  return perfilFechado || menuFechado;
}

export function inicializarNavegacao(aoNavegar, opcoes = {}) {
  navegar = aoNavegar;
  registrarCamada = opcoes.aoAbrirCamada || (() => {});
  removerCamada = opcoes.aoFecharCamada || (() => {});
  try {
    if (localStorage.getItem('cmapp-sidebar-recolhida') === 'true') {
      document.body.classList.add('sidebar-collapsed');
    }
  } catch (_) {}
  if (ehDesktop()) {
    document.getElementById('btn-menu')?.setAttribute(
      'aria-expanded',
      String(!document.body.classList.contains('sidebar-collapsed'))
    );
  }

  document.getElementById('btn-menu')?.addEventListener('click', alternarSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    fecharNavegacaoMovel({ sincronizarHistorico: true });
  });
  document.querySelectorAll('[data-nav-page]').forEach(botao => {
    botao.addEventListener('click', () => {
      navegar(botao.dataset.navPage);
      fecharNavegacaoMovel();
    });
  });

  const profileButton = document.getElementById('btn-profile-menu');
  document.getElementById('profile-menu')?.addEventListener('click', event => event.stopPropagation());
  profileButton?.addEventListener('click', event => {
    event.stopPropagation();
    const menu = document.getElementById('profile-menu');
    const abrir = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !abrir);
    profileButton.setAttribute('aria-expanded', String(abrir));
    if (abrir) registrarCamada('perfil');
    else removerCamada('perfil');
  });
  document.getElementById('btn-abrir-perfil')?.addEventListener('click', () => {
    navegar('perfil');
    fecharPerfil();
  });
  document.addEventListener('click', () => fecharPerfil({ sincronizarHistorico: true }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (fecharPerfil({ sincronizarHistorico: true })) return;
      fecharNavegacaoMovel({ sincronizarHistorico: true });
    }
  });
}

export function ativarPagina(aba) {
  const pagina = PAGINAS[aba] || PAGINAS.dashboard;
  document.getElementById('page-title').textContent = pagina.titulo;
  document.getElementById('breadcrumb-current').textContent = pagina.trilha.at(-1);
  document.getElementById('breadcrumb-path').textContent = pagina.trilha.slice(0, -1).join(' / ');
  document.querySelectorAll('[data-nav-page]').forEach(botao => {
    const ativa = botao.dataset.navPage === aba;
    botao.classList.toggle('active', ativa);
    if (ativa) botao.setAttribute('aria-current', 'page');
    else botao.removeAttribute('aria-current');
  });
}

export function atualizarFotoUsuario(usuario, fotoUrl = '') {
  const letras = iniciais(usuario?.nome);
  ['sidebar-avatar', 'header-avatar', 'profile-avatar'].forEach(id => {
    const elemento = document.getElementById(id);
    if (!elemento) return;
    elemento.replaceChildren();
    if (fotoUrl) {
      const imagem = document.createElement('img');
      imagem.src = fotoUrl;
      imagem.alt = '';
      imagem.referrerPolicy = 'no-referrer';
      elemento.appendChild(imagem);
    } else {
      elemento.textContent = letras;
    }
  });
}

export function atualizarUsuarioNavegacao(usuario, fotoUrl = '') {
  atualizarFotoUsuario(usuario, fotoUrl);
  const nome = usuario?.nome || 'Usuário';
  const perfil = usuario?.perfil || '';
  document.getElementById('sidebar-user-name').textContent = nome;
  document.getElementById('sidebar-user-role').textContent = perfil;
  document.getElementById('header-user-name').textContent = nome;
  document.getElementById('header-user-role').textContent = perfil;
}

export function atualizarAcessoNavegacao(perfil) {
  document.querySelectorAll('[data-perfis]').forEach(elemento => {
    const perfis = elemento.dataset.perfis.split(',');
    elemento.classList.toggle('hidden', !perfis.includes(perfil));
  });
}
