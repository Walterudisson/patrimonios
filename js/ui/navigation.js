const PAGINAS = {
  dashboard: { titulo: 'Painel', trilha: ['CM APP', 'Painel'] },
  scanner: { titulo: 'Leitura', trilha: ['CM APP', 'Patrimônio', 'Leitura'] },
  lista: { titulo: 'Relação', trilha: ['CM APP', 'Patrimônio', 'Relação'] },
  transferencias: { titulo: 'Fila de aprovação', trilha: ['CM APP', 'Movimentações', 'Fila'] },
  usuarios: { titulo: 'Administração', trilha: ['CM APP', 'Administração'] }
};

let navegar = () => {};

function iniciais(nome = '') {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'CM';
  return `${partes[0][0] || ''}${partes.length > 1 ? partes.at(-1)[0] : ''}`.toLocaleUpperCase('pt-BR');
}

function ehDesktop() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

export function fecharNavegacaoMovel() {
  document.body.classList.remove('sidebar-open');
  const overlay = document.getElementById('sidebar-overlay');
  overlay?.classList.add('hidden');
  overlay?.setAttribute('aria-hidden', 'true');
  document.getElementById('btn-menu')?.setAttribute('aria-expanded', 'false');
}

function alternarSidebar() {
  if (ehDesktop()) {
    const recolhida = document.body.classList.toggle('sidebar-collapsed');
    try { localStorage.setItem('cmapp-sidebar-recolhida', String(recolhida)); } catch (_) {}
    return;
  }
  const aberta = document.body.classList.toggle('sidebar-open');
  const overlay = document.getElementById('sidebar-overlay');
  overlay?.classList.toggle('hidden', !aberta);
  overlay?.setAttribute('aria-hidden', String(!aberta));
  document.getElementById('btn-menu')?.setAttribute('aria-expanded', String(aberta));
}

function fecharPerfil() {
  document.getElementById('profile-menu')?.classList.add('hidden');
  document.getElementById('btn-profile-menu')?.setAttribute('aria-expanded', 'false');
}

export function inicializarNavegacao(aoNavegar) {
  navegar = aoNavegar;
  try {
    if (localStorage.getItem('cmapp-sidebar-recolhida') === 'true') {
      document.body.classList.add('sidebar-collapsed');
    }
  } catch (_) {}

  document.getElementById('btn-menu')?.addEventListener('click', alternarSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', fecharNavegacaoMovel);
  document.querySelectorAll('[data-nav-page]').forEach(botao => {
    botao.addEventListener('click', () => {
      navegar(botao.dataset.navPage);
      fecharNavegacaoMovel();
    });
  });

  const profileButton = document.getElementById('btn-profile-menu');
  profileButton?.addEventListener('click', event => {
    event.stopPropagation();
    const menu = document.getElementById('profile-menu');
    const abrir = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !abrir);
    profileButton.setAttribute('aria-expanded', String(abrir));
  });
  document.addEventListener('click', fecharPerfil);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      fecharPerfil();
      fecharNavegacaoMovel();
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

export function atualizarUsuarioNavegacao(usuario) {
  const letras = iniciais(usuario?.nome);
  ['sidebar-avatar', 'header-avatar', 'dash-avatar'].forEach(id => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = letras;
  });
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
