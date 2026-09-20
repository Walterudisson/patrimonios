const ICONES = {
  sucesso: '✓',
  erro: '!',
  aviso: '!',
  info: 'i'
};

let confirmacaoPendente = null;
let registrarCamada = () => {};
let removerCamada = () => {};

export function inferirTipoNotificacao(mensagem = '') {
  const texto = String(mensagem).toLocaleLowerCase('pt-BR');
  if (/erro|falh|negad|não foi possível|incorret|bloquead|não permitid|restrit/.test(texto)) return 'erro';
  if (/já está cadastrad|senha|não encontrad|aprovação/.test(texto)) return 'aviso';
  if (/sucesso|atualizad|cadastrad|aprovad|rejeitad|reiniciad|registrad|retornad/.test(texto)) return 'sucesso';
  if (/atenção|aguard|pendente|selecione|nenhum|não há|aviso/.test(texto)) return 'aviso';
  return 'info';
}

export function configurarHistoricoFeedback(opcoes = {}) {
  registrarCamada = opcoes.aoAbrirCamada || (() => {});
  removerCamada = opcoes.aoFecharCamada || (() => {});
}

export function notificarMensagem(mensagem, tipo = 'auto', opcoes = {}) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const tipoFinal = tipo === 'auto' ? inferirTipoNotificacao(mensagem) : tipo;
  const toast = document.createElement('div');
  toast.className = `app-toast app-toast-${tipoFinal}`;
  toast.setAttribute('role', tipoFinal === 'erro' ? 'alert' : 'status');
  toast.innerHTML = `
    <span class="app-toast-icon" aria-hidden="true">${ICONES[tipoFinal] || ICONES.info}</span>
    <div class="app-toast-content">
      ${opcoes.titulo ? `<strong>${opcoes.titulo}</strong>` : ''}
      <p></p>
    </div>
    <button type="button" class="app-toast-close" aria-label="Fechar notificação">×</button>
  `;
  toast.querySelector('p').textContent = String(mensagem).replace(/^[✅⚠️❌ℹ️]\s*/u, '');
  const fechar = () => {
    toast.classList.add('app-toast-leaving');
    window.setTimeout(() => toast.remove(), 180);
  };
  toast.querySelector('.app-toast-close').addEventListener('click', fechar);
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('app-toast-visible'));
  const duracao = opcoes.persistente ? 0 : (opcoes.duracao || (tipoFinal === 'erro' ? 7000 : 4500));
  if (duracao > 0) window.setTimeout(fechar, duracao);
}

export function confirmarAcao({
  titulo = 'Confirmar ação',
  mensagem,
  confirmarTexto = 'Confirmar',
  cancelarTexto = 'Cancelar',
  perigosa = false
}) {
  if (confirmacaoPendente) confirmacaoPendente(false, { sincronizarHistorico: false });
  const modal = document.getElementById('modal-confirmacao');
  const tituloEl = document.getElementById('confirmacao-titulo');
  const mensagemEl = document.getElementById('confirmacao-mensagem');
  const confirmarBtn = document.getElementById('confirmacao-confirmar');
  const cancelarBtn = document.getElementById('confirmacao-cancelar');
  if (!modal || !tituloEl || !mensagemEl || !confirmarBtn || !cancelarBtn) {
    return Promise.resolve(false);
  }

  tituloEl.textContent = titulo;
  mensagemEl.textContent = mensagem;
  confirmarBtn.textContent = confirmarTexto;
  cancelarBtn.textContent = cancelarTexto;
  confirmarBtn.classList.toggle('app-button-danger', perigosa);
  confirmarBtn.classList.toggle('app-button-primary', !perigosa);
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  registrarCamada('confirmacao');

  return new Promise(resolve => {
    let focoAnterior = document.activeElement;
    const concluir = (resultado, { sincronizarHistorico = true } = {}) => {
      if (!confirmacaoPendente) return;
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      confirmacaoPendente = null;
      document.removeEventListener('keydown', tratarTeclado);
      const finalizar = () => {
        focoAnterior?.focus?.();
        resolve(resultado);
      };
      if (sincronizarHistorico) {
        const retorno = removerCamada('confirmacao');
        if (retorno && typeof retorno.finally === 'function') retorno.finally(finalizar);
        else finalizar();
      } else {
        finalizar();
      }
    };
    const tratarTeclado = event => {
      if (event.key === 'Escape') concluir(false);
    };
    confirmacaoPendente = concluir;
    confirmarBtn.onclick = () => concluir(true);
    cancelarBtn.onclick = () => concluir(false);
    modal.onclick = event => {
      if (event.target === modal) concluir(false);
    };
    document.addEventListener('keydown', tratarTeclado);
    requestAnimationFrame(() => cancelarBtn.focus());
  });
}

export function fecharConfirmacaoAtiva() {
  if (!confirmacaoPendente) return false;
  confirmacaoPendente(false, { sincronizarHistorico: false });
  return true;
}
