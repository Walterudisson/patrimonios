    import {
      EmailAuthProvider,
      onAuthStateChanged,
      reauthenticateWithCredential,
      sendPasswordResetEmail,
      signInWithEmailAndPassword,
      signOut,
      updatePassword,
      updateProfile
    } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
    import {
      doc, getDoc, getDocFromServer, setDoc, updateDoc,
      collection, getDocs, onSnapshot, writeBatch, query, where,
      and, or, orderBy, startAt, startAfter, endAt, limit, documentId,
      getCountFromServer
    } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
    import { auth, db } from "./js/config/firebase.js";
    import {
      ehPerfilValidador,
      prepararAtualizacaoPatrimonio,
      prepararResolucaoSugestaoDestino,
      prepararResolucaoTransferencia,
      prepararSugestaoDestino
    } from "./js/core/movimentacao.js?v=1.13.9";
    import { situacaoPatrimonio, divisoesVisiveisPatrimonio, patrimonioVisivelParaDivisoes, correspondeSituacaoPatrimonio, contarSituacoesPatrimonio, descontarItensForaDoEscopo, resumirProgressoDivisao } from "./js/core/relacao.js?v=1.13.3";
    import { carregarPaginaIntercalada } from "./js/core/paginacao.js?v=1.12.4";
    import { divisoesDisponiveis, escopoInicial } from "./js/core/escopo.js?v=1.13.0";
    import { validarNovaSenha } from "./js/core/perfil.js";
    import { criarControladorCamera } from "./js/controllers/camera.controller.js?v=1.12.0";
    import { listarDivisoesAtivas } from "./js/services/divisoes.service.js";
    import {
      consultarCicloDivisao, encerrarDivisao, reabrirDivisao,
      listarFechamentos, listarEventosInventario, listarItensFechamento,
      encerrarInventarioGeral, listarInventariosGerais,
      reiniciarDivisaoEncerrada, reiniciarInventarioGeral, divisoesDoInventarioAtual,
      consultarEncerramentoGeral
    } from "./js/services/inventarios.service.js?v=1.13.6";
    import { obterUrlFotoPerfil, removerFotoPerfil, salvarFotoPerfil } from "./js/services/perfil.service.js";
    import { alterarEstadoUsuario, atualizarUsuarioSeguro, criarUsuarioSeguro } from "./js/services/usuarios.service.js?v=1.13.7";
    import {
      configurarHistoricoFeedback,
      confirmarAcao,
      fecharConfirmacaoAtiva,
      notificarMensagem
    } from "./js/ui/feedback.js?v=1.12.0";
    import {
      ativarPagina,
      atualizarAcessoNavegacao,
      atualizarFotoUsuario,
      atualizarUsuarioNavegacao,
      fecharCamadasNavegacao,
      fecharNavegacaoMovel,
      inicializarNavegacao
    } from "./js/ui/navigation.js?v=1.12.0";
    import { inicializarPwa } from "./js/pwa.js?v=1.12.0";

    let usuarioLogado = null;
    let bancoPatrimonio = [];
    let bancoUsuarios = [];
    let bancoTransferencias = [];
    let filaTransferenciasFisicas = [];
    let filaSugestoesDestino = [];
    let itemAtualSelecionado = null;
    let metodoLocalizacaoSelecionado = 'digitacao';
    let itensFiltradosCache = [];
    let unsubscribeTransferencias = [];
    let abaAtual = 'dashboard';
    let usuariosCarregados = false;
    let relacaoCarregada = false;
    let timerAutocomplete = null;
    let timerFiltroRelacao = null;
    let catalogoDivisoesCarregado = false;
    let cursorRelacao = null;
    let totalRelacao = 0;
    let relacaoTemMais = true;
    let relacaoCarregando = false;
    let relacaoBaseCompleta = null;
    let relacaoUsandoBaseCompleta = false;
    let lotesRelacao = null;
    let fotoPerfilUrl = '';
    let escopoVisualizacao = '';
    let revisaoEscopo = 0;
    let revisaoInventarios = 0;
    let filtroStatusUsuarios = 'todos';
    let filtroPerfilUsuarios = 'todos';
    let paginaUsuarios = 1;
    let ordenacaoUsuarios = { campo: 'nome', direcao: 'asc' };
    let usuarioDetalhadoUid = '';
    const cacheFotosUsuarios = new Map();
    let tutorialConferente = null;
    let tutorialFinalizado = false;
    let tutorialEraRevisao = false;
    let filaSalvamentoTutorial = Promise.resolve();

    const TAMANHO_PAGINA_RELACAO = 50;
    const VALIDADE_RESUMO_INVENTARIO_MS = 120000;
    const nomeMetodoLocalizacao = metodo => ({
      codigo_barras: 'Código de barras',
      ocr: 'OCR',
      digitacao: 'Digitação'
    })[metodo] || 'Não registrado';
    const detalheMetodoHistorico = evento => !evento.acao
      || ['conferencia', 'transferencia_solicitada'].includes(evento.acao)
      ? ` · Método: ${nomeMetodoLocalizacao(evento.metodoLocalizacao)}`
      : '';
    const escaparHtml = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caractere]);

    auth.languageCode = 'pt-BR';

    const cachePatrimonios = new Map();
    const cacheResumoInventarios = new Map();
    const cacheSugestoes = new Map();
    const catalogoDivisoes = new Set();
    const resolvedoresHistorico = [];

    const controladorCamera = criarControladorCamera({
      limparPlaqueta,
      aoReconhecerPlaqueta: preencherEConsultarPlaqueta,
      aoPrepararNovaLeitura: limparFormularioLeitura,
      podeManterCamera: () => Boolean(usuarioLogado && abaAtual === 'scanner')
    });
    controladorCamera.inicializar();
    inicializarNavegacao(aba => alternarAba(aba), {
      aoAbrirCamada: registrarCamadaHistorico,
      aoFecharCamada: removerCamadaHistorico
    });
    configurarHistoricoFeedback({
      aoAbrirCamada: registrarCamadaHistorico,
      aoFecharCamada: removerCamadaHistorico
    });
    inicializarPwa({ notificarMensagem });
    inicializarAlternadoresSenha();
    window.addEventListener('popstate', tratarPopstate);

    function iconeAlternadorSenha(visivel) {
      return visivel
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a15.7 15.7 0 0 1-2.1 2.6M6.6 6.6A16.2 16.2 0 0 0 3 12s3.5 5 9 5a10.5 10.5 0 0 0 4.1-.8"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Zm9 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>';
    }

    function inicializarAlternadoresSenha() {
      document.querySelectorAll('input[type="password"]').forEach(input => {
        if (input.closest('.password-control')) return;
        const controle = document.createElement('div');
        controle.className = 'password-control';
        input.parentNode.insertBefore(controle, input);
        controle.appendChild(input);
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'password-toggle';
        botao.setAttribute('aria-label', 'Mostrar senha');
        botao.setAttribute('aria-pressed', 'false');
        botao.innerHTML = iconeAlternadorSenha(false);
        botao.addEventListener('click', () => {
          const visivel = input.type === 'text';
          input.type = visivel ? 'password' : 'text';
          botao.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
          botao.setAttribute('aria-pressed', String(!visivel));
          botao.innerHTML = iconeAlternadorSenha(!visivel);
          input.focus({ preventScroll: true });
        });
        controle.appendChild(botao);
      });
    }

    function urlDaAba(aba) {
      return `#${aba || 'dashboard'}`;
    }

    function registrarAbaHistorico(aba, { substituir = false } = {}) {
      const estado = { cmApp: true, aba };
      if (substituir || !history.state?.cmApp || history.state?.camada) {
        history.replaceState(estado, '', urlDaAba(aba));
      } else if (history.state.aba !== aba) {
        history.pushState(estado, '', urlDaAba(aba));
      }
    }

    function registrarCamadaHistorico(camada) {
      if (!usuarioLogado || history.state?.camada === camada) return;
      const estado = { cmApp: true, aba: abaAtual, camada };
      const camadasNavegacao = new Set(['menu', 'perfil']);
      if (history.state?.cmApp && camadasNavegacao.has(camada) && camadasNavegacao.has(history.state.camada)) {
        history.replaceState(estado, '', urlDaAba(abaAtual));
      } else {
        history.pushState(estado, '', urlDaAba(abaAtual));
      }
    }

    function removerCamadaHistorico(camada) {
      if (!history.state?.cmApp || history.state.camada !== camada) return Promise.resolve();
      const conclusao = new Promise(resolve => resolvedoresHistorico.push({ camada, resolve }));
      history.back();
      return conclusao;
    }

    function consumirRemocoesHistorico() {
      return resolvedoresHistorico.splice(0);
    }

    function abrirModalHistorico(id, camada) {
      document.getElementById(id)?.classList.remove('hidden');
      registrarCamadaHistorico(camada);
    }

    function fecharModalHistorico(id, camada, { sincronizarHistorico = true } = {}) {
      const modal = document.getElementById(id);
      const estavaAberto = Boolean(modal && !modal.classList.contains('hidden'));
      modal?.classList.add('hidden');
      if (estavaAberto && sincronizarHistorico) return removerCamadaHistorico(camada);
      return Promise.resolve();
    }

    function fecharCamadaSobreposta() {
      if (fecharConfirmacaoAtiva()) return true;
      const camadas = [
        ['modal-sugerir-destino', 'sugerir-destino'],
        ['modal-detalhes-item', 'detalhes-item'],
        ['modal-detalhes-usuario', 'detalhes-usuario'],
        ['modal-edicao-usuario', 'edicao-usuario'],
        ['modal-criacao-usuario', 'criacao-usuario']
      ];
      for (const [id, camada] of camadas) {
        const modal = document.getElementById(id);
        if (modal && !modal.classList.contains('hidden')) {
          fecharModalHistorico(id, camada, { sincronizarHistorico: false });
          return true;
        }
      }
      return fecharCamadasNavegacao();
    }

    async function tratarPopstate(evento) {
      const remocoesProgramaticas = consumirRemocoesHistorico();
      const fechouCamada = remocoesProgramaticas.length === 0 && fecharCamadaSobreposta();
      const destino = evento.state?.cmApp ? evento.state.aba : null;
      if (!fechouCamada && destino && destino !== abaAtual) {
        await alternarAba(destino, { registrarHistorico: false });
      }
      remocoesProgramaticas.forEach(({ resolve }) => resolve());
    }

    function invalidarCacheRelacao({ preservarInventarios = false } = {}) {
      relacaoBaseCompleta = null;
      relacaoUsandoBaseCompleta = false;
      lotesRelacao = null;
      relacaoCarregada = false;
      cursorRelacao = null;
      totalRelacao = 0;
      relacaoTemMais = true;
      if (!preservarInventarios) {
        revisaoInventarios++;
        cacheResumoInventarios.clear();
      }
    }

    function normalizarPatrimonio(docSnap) {
      const dados = docSnap.data();
      return { id: docSnap.id, ...dados, plaqueta: dados.plaqueta || docSnap.id };
    }

    function cachearPatrimonios(itens) {
      itens.forEach(item => cachePatrimonios.set(item.plaqueta, item));
    }

    function adicionarDivisoesAoCatalogo(itens = []) {
      itens.forEach(item => {
        [item.divisaoOrigem, item.divisao, item.localizacaoAtual, item.divisaoDestinoSugerida]
          .filter(Boolean)
          .forEach(divisao => catalogoDivisoes.add(divisao));
      });
      popularSelectsDivisao();
    }

    function dividirEmLotes(lista, tamanho = 7) {
      const lotes = [];
      for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho));
      return lotes;
    }

    const dicasLista = [
      { titulo: "🔍 Leitura Óptica por OCR", texto: "Se o código estiver ilegível, centralize a numeração impressa e use 'Ler via OCR'. Após dez segundos, o app também oferece OCR, digitação manual ou a opção de continuar tentando." },
      { titulo: "📱 Câmera, foco e iluminação", texto: "Ao ligar a câmera, o app centraliza o visor. Depois de reconhecer a plaqueta, congela a imagem e leva você ao resultado e ao formulário de confirmação." },
      { titulo: "⚠️ Divergências de Setor", texto: "Achou um bem em local diferente? A mudança seguirá para a Fila de aprovação, qualquer que seja seu perfil. O local atual permanece até a decisão." },
      { titulo: "🔄 Gestão Hierárquica", texto: "Administradores gerenciam todo o sistema. Gestores podem atualizar seus dados e cadastrar ou editar os conferentes sob sua alçada." },
      { titulo: "🔄 Ciclo das Transferências", texto: "Toda mudança de divisão registrada na leitura gera pendência na Fila. Gestores e Administradores aprovam ou rejeitam a transferência depois da leitura." },
      { titulo: "🔍 Busca Rápida por Digitação", texto: "Na aba 'Leitura', comece a digitar os números da plaqueta para ver sugestões instantâneas e agilizar o preenchimento sem precisar usar a câmera." },
      { titulo: "📋 Acompanhamento por Setor (Relação)", texto: "Utilize a aba 'Relação' para acompanhar o progresso do inventário. Os blocos mostram o total de itens e quantos já foram conferidos em cada divisão." },
      { titulo: "🔎 Leitura com alternativas", texto: "Após reconhecer um código, a câmera pausa para evitar duplicidade. Use 'Ler outra plaqueta' para continuar; digitação manual e OCR permanecem disponíveis." }
    ];
    let dicaIndiceAtual = 0;

    function atualizarCarrossel() {
      const tituloEl = document.getElementById('carrossel-titulo');
      const textoEl = document.getElementById('carrossel-texto');
      const indicador = document.getElementById('carrossel-indicador');
      if (tituloEl && textoEl && indicador) {
        tituloEl.innerText = dicasLista[dicaIndiceAtual].titulo;
        textoEl.innerText = dicasLista[dicaIndiceAtual].texto;
        indicador.innerText = `${dicaIndiceAtual + 1}/${dicasLista.length}`;
      }
    }

    document.getElementById('carrossel-next')?.addEventListener('click', () => {
      dicaIndiceAtual = (dicaIndiceAtual + 1) % dicasLista.length;
      atualizarCarrossel();
    });

    document.getElementById('carrossel-prev')?.addEventListener('click', () => {
      dicaIndiceAtual = (dicaIndiceAtual - 1 + dicasLista.length) % dicasLista.length;
      atualizarCarrossel();
    });

    setInterval(() => {
      dicaIndiceAtual = (dicaIndiceAtual + 1) % dicasLista.length;
      atualizarCarrossel();
    }, 18000);

    function atualizarEstadoTutorialConferente() {
      const ehConferente = usuarioLogado?.perfil === 'conferente';
      document.getElementById('tutorial-conferente-card')?.classList.toggle('hidden', !ehConferente);
      if (!ehConferente) return;
      const concluido = usuarioLogado.tutorialConferenteV1Concluido === true;
      const adiado = usuarioLogado.tutorialConferenteV1Adiado === true;
      const status = document.getElementById('tutorial-conferente-status');
      const botao = document.getElementById('btn-iniciar-tutorial');
      if (status) status.textContent = concluido
        ? 'Tutorial concluído. Você pode revê-lo sempre que precisar.'
        : (adiado ? 'Tutorial pausado. Continue a partir da última orientação.' : 'Conheça o fluxo de leitura e conferência sem alterar dados patrimoniais.');
      if (botao) botao.textContent = concluido ? 'REVER TUTORIAL' : (adiado ? 'CONTINUAR TUTORIAL' : 'INICIAR TUTORIAL');
    }

    async function salvarEstadoTutorialConferente({ etapa, concluido, adiado }) {
      if (!usuarioLogado || usuarioLogado.perfil !== 'conferente') return;
      const dados = {
        tutorialConferenteV1Etapa: Math.max(0, Number(etapa) || 0),
        tutorialConferenteV1Concluido: Boolean(concluido),
        tutorialConferenteV1Adiado: Boolean(adiado)
      };
      Object.assign(usuarioLogado, dados);
      atualizarEstadoTutorialConferente();
      filaSalvamentoTutorial = filaSalvamentoTutorial
        .catch(() => {})
        .then(() => updateDoc(doc(db, 'usuarios', usuarioLogado.uid), dados));
      try { await filaSalvamentoTutorial; }
      catch (erro) { console.warn('Não foi possível salvar o progresso do tutorial.', erro); }
    }

    function adicionarBotaoPularTutorial(popover) {
      const rodape = popover?.footerButtons || document.querySelector('.driver-popover-footer');
      if (!rodape || rodape.querySelector('.tutorial-skip-button')) return;
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'driver-popover-footer-btn tutorial-skip-button';
      botao.textContent = 'Pular';
      botao.addEventListener('click', () => {
        const etapa = tutorialConferente?.getActiveIndex?.() || 0;
        void salvarEstadoTutorialConferente({
          etapa,
          concluido: tutorialEraRevisao,
          adiado: !tutorialEraRevisao
        });
        tutorialConferente?.destroy();
      });
      rodape.prepend(botao);
    }

    function passosTutorialConferente() {
      return [
        {
          element: '.app-topbar',
          popover: {
            title: 'Bem-vindo ao CM APP',
            description: 'Este guia apresenta o fluxo do Conferente. Nenhum patrimônio será alterado durante o tutorial.'
          }
        },
        {
          element: '#escopo-barra',
          popover: {
            title: 'Sua divisão de trabalho',
            description: 'Quando houver mais de uma divisão atribuída sob sua responsabilidade, escolha aqui qual deseja visualizar e operar no sistema. Quando necessário, você poderá alternar entre elas.',
            onNextClick: async () => {
              await alternarAba('scanner');
              tutorialConferente.moveNext();
            }
          }
        },
        {
          element: '#scanner-camera-card',
          popover: {
            title: 'Leitura pela câmera',
            description: 'Ligue a câmera quando quiser ler o código de barras. Caso necessário, lembre-se de que a leitura dos números por OCR e a digitação manual também estão disponíveis como alternativas.',
            onPrevClick: async () => {
              await alternarAba('dashboard');
              tutorialConferente.movePrevious();
            }
          }
        },
        {
          element: '#input-plaqueta',
          popover: {
            title: 'Digitação manual',
            description: 'Se a etiqueta não puder ser lida, digite somente os números da plaqueta e use Buscar.'
          }
        },
        {
          element: '#scanner-form-card',
          popover: {
            title: 'Consulta da plaqueta',
            description: 'Toda leitura chega a este formulário. Aqui você confere o patrimônio antes de registrar qualquer informação.'
          }
        },
        {
          element: '#scanner-form-card',
          popover: {
            title: 'Resultado encontrado',
            description: 'O aplicativo mostrará a descrição, a divisão anterior e o histórico. Leia <strong>atentamente</strong> esses dados antes de continuar.'
          }
        },
        {
          element: '#select-localizacao',
          popover: {
            title: 'Local onde o item foi encontrado',
            description: 'Informe a divisão real em que o patrimônio está. Se estiver na mesma divisão, a conferência será concluída diretamente quando você clicar em <strong>Registrar conferência</strong>.'
          }
        },
        {
          element: '#btn-salvar',
          popover: {
            title: 'Registrar conferência',
            description: 'Este botão grava a conferência real. Ele está bloqueado durante o tutorial e nenhum dado será enviado.'
          }
        },
        {
          element: '#patrimonio-atualizacao-form',
          popover: {
            title: 'Transferência para aprovação',
            description: 'Se a divisão informada for diferente da atual, o sistema criará uma solicitação para a Seção de Patrimônio analisar.'
          }
        },
        {
          element: '#scanner-form-card',
          popover: {
            title: 'Sugerir destino',
            description: 'Se um item pendente estiver em outra divisão, utilize <strong>Sugerir destino</strong>. A informação será enviada para análise e não marcará o patrimônio como localizado.'
          }
        },
        {
          element: '#scanner-form-card',
          popover: {
            title: 'Plaqueta não encontrada',
            description: 'Confira <strong>atentamente</strong> o número. Se estiver correto e o patrimônio ainda não for localizado, ele pode não existir na base ou pertencer a outro órgão. Comunique a Seção de Patrimônio para análise.'
          }
        },
        {
          element: '#btn-profile-menu',
          popover: {
            title: 'Tutorial concluído',
            description: 'Parabéns! Você concluiu o guia e já conhece o fluxo essencial para conferir seus patrimônios. Você poderá rever este guia a qualquer momento em <strong>Meu perfil</strong>.'
          }
        }
      ];
    }

    async function iniciarTutorialConferente({ automatico = false } = {}) {
      if (usuarioLogado?.perfil !== 'conferente') return;
      const criarDriver = window.driver?.js?.driver;
      if (typeof criarDriver !== 'function') {
        if (!automatico) notificarMensagem('O tutorial não pôde ser carregado. Verifique a conexão e tente novamente.', 'aviso');
        return;
      }
      tutorialConferente?.destroy?.();
      tutorialFinalizado = false;
      tutorialEraRevisao = usuarioLogado.tutorialConferenteV1Concluido === true;
      await alternarAba('dashboard');
      tutorialConferente = criarDriver({
        popoverClass: 'cmapp-tutorial',
        showProgress: true,
        progressText: '{{current}} de {{total}}',
        nextBtnText: 'Próximo',
        prevBtnText: 'Anterior',
        doneBtnText: 'Concluir',
        showButtons: ['next', 'previous'],
        allowClose: false,
        overlayClickBehavior: 'none',
        disableActiveInteraction: true,
        smoothScroll: true,
        steps: passosTutorialConferente(),
        onPopoverRender: adicionarBotaoPularTutorial,
        onHighlighted: (_elemento, _passo, opcoes) => {
          const etapa = opcoes?.state?.activeIndex ?? tutorialConferente?.getActiveIndex?.() ?? 0;
          salvarEstadoTutorialConferente({ etapa, concluido: tutorialEraRevisao, adiado: false });
        },
        onDoneClick: () => {
          tutorialFinalizado = true;
          void salvarEstadoTutorialConferente({ etapa: 0, concluido: true, adiado: false });
          tutorialConferente.destroy();
          notificarMensagem('Tutorial do Conferente concluído.', 'sucesso');
        },
        onDestroyed: () => {
          tutorialConferente = null;
          if (tutorialFinalizado) atualizarEstadoTutorialConferente();
        }
      });
      const etapaSalva = usuarioLogado.tutorialConferenteV1Adiado === true
        ? Math.min(Number(usuarioLogado.tutorialConferenteV1Etapa) || 0, passosTutorialConferente().length - 1)
        : 0;
      if (etapaSalva >= 2) await alternarAba('scanner');
      tutorialConferente.drive(etapaSalva);
    }

    function agendarTutorialConferente() {
      atualizarEstadoTutorialConferente();
      if (usuarioLogado?.perfil !== 'conferente'
        || usuarioLogado.tutorialConferenteV1Concluido === true
        || usuarioLogado.tutorialConferenteV1Adiado === true) return;
      window.setTimeout(() => iniciarTutorialConferente({ automatico: true }), 700);
    }

    document.getElementById('btn-iniciar-tutorial')?.addEventListener('click', () => iniciarTutorialConferente());

    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const loginErro = document.getElementById('login-erro');
      loginErro.classList.add('hidden');
      const email = document.getElementById('login-email').value.trim();
      const senha = document.getElementById('login-senha').value;

      try {
        const cred = await signInWithEmailAndPassword(auth, email, senha);
        const userDoc = await getDoc(doc(db, "usuarios", cred.user.uid));
        if (!userDoc.exists()) {
          await signOut(auth);
          throw new Error("Acesso negado: Esta conta foi desativada ou removida do sistema.");
        }
      } catch (err) {
        let mensagemAmigavel = "Erro ao realizar autenticação. Verifique suas credenciais.";
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
          mensagemAmigavel = "E-mail ou senha incorretos. Por favor, tente novamente.";
        } else if (err.code === 'auth/user-disabled') {
          mensagemAmigavel = "Este acesso está desativado. Procure um Administrador do CM APP para solicitar a reativação.";
        } else if (err.code === 'auth/too-many-requests') {
          mensagemAmigavel = "Muitas tentativas falhas. O acesso foi temporariamente bloqueado por segurança.";
        } else if (err.message) {
          mensagemAmigavel = err.message;
        }
        loginErro.innerText = mensagemAmigavel;
        loginErro.classList.remove('hidden');
      }
    });

    ['btn-logout', 'btn-logout-sidebar'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => signOut(auth));
    });

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (!userDoc.exists()) {
          await signOut(auth);
          return;
        }
        usuarioLogado = { uid: user.uid, email: user.email, ...userDoc.data() };
        if (usuarioLogado.ativo === false) {
          await signOut(auth);
          notificarMensagem('Este acesso está desativado. Procure um Administrador.', 'erro');
          return;
        }
        
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-app').classList.remove('hidden');
        atualizarCabecalhoUsuario();
        try { await carregarCatalogoDivisoes(); }
        catch (erro) { console.warn('Catálogo indisponível ao abrir o aplicativo.', erro); }
        inicializarEscopoVisualizacao();
        await carregarFotoPerfilAtual();
        atualizarCarrossel();
        if (usuarioLogado.perfil !== 'conferente') iniciarOuvinteTransferencias();
        await alternarAba('dashboard', { substituirHistorico: true });
        agendarTutorialConferente();
      } else {
        encerrarOuvinteTransferencias();
        if (controladorCamera.estaAtiva()) await controladorCamera.desligar({ limparResultado: true });
        usuarioLogado = null;
        escopoVisualizacao = '';
        revisaoEscopo++;
        bancoPatrimonio = [];
        bancoUsuarios = [];
        bancoTransferencias = [];
        cachePatrimonios.clear();
        cacheSugestoes.clear();
        catalogoDivisoes.clear();
        usuariosCarregados = false;
        invalidarCacheRelacao();
        catalogoDivisoesCarregado = false;
        fotoPerfilUrl = '';
        fecharCamadaSobreposta();
        if (history.state?.cmApp) {
          history.replaceState({ cmAppLogin: true }, '', `${location.pathname}${location.search}`);
        }
        document.getElementById('view-app').classList.add('hidden');
        document.getElementById('view-login').classList.remove('hidden');
      }
    });

    function atualizarCabecalhoUsuario() {
      atualizarUsuarioNavegacao(usuarioLogado, fotoPerfilUrl);
      atualizarAcessoNavegacao(usuarioLogado.perfil);
      atualizarEstadoTutorialConferente();
      document.getElementById('profile-menu-name').innerText = usuarioLogado.nome;
      atualizarDadosTelaPerfil();
      
      const btnTransf = document.getElementById('tab-btn-transferencias');
      const btnUsuarios = document.getElementById('tab-btn-usuarios');
      const btnInventarios = document.getElementById('tab-btn-inventarios');
      const btnNovoUsuario = document.getElementById('btn-novo-usuario');
      const campoPerfil = document.getElementById('campo-perfil-container');
      const tituloCad = document.getElementById('titulo-cad-usuario');
      const boxExportacao = document.getElementById('container-botoes-exportacao');
      const panelCiclo = document.getElementById('panel-gestao-ciclo');
      const btnSalvar = document.getElementById('btn-salvar');
      document.getElementById('dash-aguardando-acao').innerText = usuarioLogado.perfil === 'conferente'
        ? 'Ver na relação →' : 'Abrir fila geral →';
      btnNovoUsuario?.classList.toggle('hidden', usuarioLogado.perfil !== 'admin');

      if (usuarioLogado.perfil === 'conferente') {
        btnTransf.classList.add('hidden');
        btnUsuarios.classList.add('hidden');
        btnInventarios.classList.remove('hidden');
        if (boxExportacao) boxExportacao.classList.add('hidden');
        if (panelCiclo) panelCiclo.classList.add('hidden');
        if (btnSalvar) btnSalvar.innerText = '✅ Registrar Conferência';
      } else {
        if (boxExportacao) boxExportacao.classList.remove('hidden');
        if (panelCiclo) panelCiclo.classList.remove('hidden');
        if (btnSalvar) btnSalvar.innerText = '✅ Atualizar Patrimônio';
        if (usuarioLogado.perfil === 'gestor') {
          btnTransf.classList.remove('hidden');
          btnUsuarios.classList.remove('hidden');
          btnInventarios.classList.remove('hidden');
          campoPerfil.classList.add('hidden');
          tituloCad.innerText = "👥 Cadastrar Novo Conferente";
        } else if (usuarioLogado.perfil === 'admin') {
          btnTransf.classList.remove('hidden');
          btnUsuarios.classList.remove('hidden');
          btnInventarios.classList.remove('hidden');
          campoPerfil.classList.remove('hidden');
          tituloCad.innerText = "👥 Cadastrar Novo Gestor ou Conferente";
        }
      }

    }

    function atualizarDadosTelaPerfil() {
      if (!usuarioLogado) return;
      document.getElementById('perfil-nome').textContent = usuarioLogado.nome || 'Usuário';
      document.getElementById('perfil-editar-nome').value = usuarioLogado.nome || '';
      document.getElementById('perfil-email').textContent = usuarioLogado.email || 'Não informado';
      document.getElementById('perfil-papel').textContent = usuarioLogado.perfil || 'Não informado';
      const divisoes = usuarioLogado.perfil === 'conferente'
        ? [...new Set(usuarioLogado.divisoesAtribuidas || [])].sort((a, b) => a.localeCompare(b, 'pt-BR'))
        : [];
      document.getElementById('perfil-divisoes').textContent = divisoes.length
        ? divisoes.join(', ')
        : 'Abrangência global no módulo de patrimônio';
      document.getElementById('btn-remover-foto')?.classList.toggle('hidden', !fotoPerfilUrl);
    }

    document.getElementById('form-meu-nome')?.addEventListener('submit', async evento => {
      evento.preventDefault();
      if (!usuarioLogado) return;
      const nome = document.getElementById('perfil-editar-nome').value.trim();
      if (nome.length < 3) return notificarMensagem('Informe um nome com pelo menos 3 caracteres.', 'aviso');
      const botao = document.getElementById('btn-salvar-meu-nome');
      botao.disabled = true;
      botao.textContent = 'SALVANDO...';
      try {
        await updateDoc(doc(db, 'usuarios', usuarioLogado.uid), { nome });
        if (auth.currentUser) {
          try { await updateProfile(auth.currentUser, { displayName: nome }); }
          catch (erroPerfil) { console.warn('Nome salvo, mas o perfil do Authentication não foi sincronizado.', erroPerfil); }
        }
        usuarioLogado = { ...usuarioLogado, nome };
        atualizarCabecalhoUsuario();
        notificarMensagem('Nome atualizado com sucesso.', 'sucesso');
      } catch (erro) {
        console.error('Erro ao atualizar o próprio nome:', erro);
        notificarMensagem('Não foi possível atualizar seu nome.', 'erro');
      } finally {
        botao.disabled = false;
        botao.textContent = 'SALVAR NOME';
      }
    });

    async function carregarFotoPerfilAtual() {
      if (!usuarioLogado) return;
      try {
        fotoPerfilUrl = await obterUrlFotoPerfil(usuarioLogado.uid);
      } catch (erro) {
        if (erro?.code !== 'storage/object-not-found') {
          console.warn('Foto de perfil indisponível; usando iniciais.', erro);
          fotoPerfilUrl = auth.currentUser?.photoURL || '';
        } else {
          fotoPerfilUrl = '';
        }
      }
      atualizarFotoUsuario(usuarioLogado, fotoPerfilUrl);
      atualizarDadosTelaPerfil();
    }

    const inputFotoPerfil = document.getElementById('input-foto-perfil');
    const btnSelecionarFoto = document.getElementById('btn-selecionar-foto');
    const btnRemoverFoto = document.getElementById('btn-remover-foto');

    btnSelecionarFoto?.addEventListener('click', () => inputFotoPerfil?.click());
    inputFotoPerfil?.addEventListener('change', async () => {
      const arquivo = inputFotoPerfil.files?.[0];
      inputFotoPerfil.value = '';
      if (!arquivo || !usuarioLogado) return;

      btnSelecionarFoto.disabled = true;
      btnSelecionarFoto.textContent = 'ENVIANDO FOTO...';
      try {
        fotoPerfilUrl = await salvarFotoPerfil(usuarioLogado.uid, arquivo);
        if (auth.currentUser) {
          try { await updateProfile(auth.currentUser, { photoURL: fotoPerfilUrl }); }
          catch (erroPerfil) { console.warn('Foto salva, mas o perfil do Authentication não foi sincronizado.', erroPerfil); }
        }
        atualizarFotoUsuario(usuarioLogado, fotoPerfilUrl);
        atualizarDadosTelaPerfil();
        notificarMensagem('Foto de perfil atualizada com sucesso.', 'sucesso');
      } catch (erro) {
        console.error('Erro ao atualizar foto de perfil:', erro);
        const mensagem = erro?.code === 'storage/unauthorized'
          ? 'O Firebase Storage recusou o envio. Confira se o serviço está ativo e se as regras do Storage foram publicadas.'
          : (erro?.message || 'Não foi possível atualizar a foto de perfil.');
        notificarMensagem(mensagem, erro?.message ? 'aviso' : 'erro');
      } finally {
        btnSelecionarFoto.disabled = false;
        btnSelecionarFoto.textContent = 'ALTERAR FOTO';
      }
    });

    btnRemoverFoto?.addEventListener('click', async () => {
      if (!usuarioLogado || !fotoPerfilUrl) return;
      const confirmado = await confirmarAcao({
        titulo: 'Remover foto do perfil',
        mensagem: 'As iniciais do seu nome voltarão a ser usadas como avatar.',
        confirmarTexto: 'Remover foto',
        perigosa: true
      });
      if (!confirmado) return;

      btnRemoverFoto.disabled = true;
      try {
        await removerFotoPerfil(usuarioLogado.uid);
        if (auth.currentUser) {
          try { await updateProfile(auth.currentUser, { photoURL: null }); }
          catch (erroPerfil) { console.warn('Foto removida, mas o perfil do Authentication não foi sincronizado.', erroPerfil); }
        }
        fotoPerfilUrl = '';
        atualizarFotoUsuario(usuarioLogado);
        atualizarDadosTelaPerfil();
        notificarMensagem('Foto de perfil removida.', 'sucesso');
      } catch (erro) {
        console.error('Erro ao remover foto de perfil:', erro);
        notificarMensagem('Não foi possível remover a foto. Verifique sua conexão e as regras do Storage.', 'erro');
      } finally {
        btnRemoverFoto.disabled = false;
      }
    });

    document.getElementById('form-alterar-senha')?.addEventListener('submit', async evento => {
      evento.preventDefault();
      if (!auth.currentUser || !usuarioLogado?.email) return;
      const formulario = evento.currentTarget;

      const senhaAtual = document.getElementById('perfil-senha-atual').value;
      const novaSenha = document.getElementById('perfil-nova-senha').value;
      const confirmacao = document.getElementById('perfil-confirmar-senha').value;
      const validacao = validarNovaSenha(senhaAtual, novaSenha, confirmacao);
      if (!validacao.valido) return notificarMensagem(validacao.mensagem, 'aviso');

      const botao = document.getElementById('btn-alterar-senha');
      botao.disabled = true;
      botao.textContent = 'ATUALIZANDO...';
      try {
        const credencial = EmailAuthProvider.credential(usuarioLogado.email, senhaAtual);
        await reauthenticateWithCredential(auth.currentUser, credencial);
        await updatePassword(auth.currentUser, novaSenha);
        formulario.reset();
        notificarMensagem('Senha atualizada com sucesso.', 'sucesso');
      } catch (erro) {
        console.error('Erro ao alterar senha:', erro);
        let mensagem = 'Não foi possível atualizar sua senha.';
        let tipo = 'erro';
        if (['auth/invalid-credential', 'auth/wrong-password'].includes(erro?.code)) {
          mensagem = 'A senha atual informada está incorreta.';
          tipo = 'aviso';
        } else if (erro?.code === 'auth/too-many-requests') {
          mensagem = 'Muitas tentativas foram realizadas. Aguarde alguns minutos e tente novamente.';
          tipo = 'aviso';
        } else if (erro?.code === 'auth/network-request-failed') {
          mensagem = 'Falha de conexão. Verifique a internet e tente novamente.';
        }
        notificarMensagem(mensagem, tipo);
      } finally {
        botao.disabled = false;
        botao.textContent = 'ATUALIZAR SENHA';
      }
    });

    async function carregarUsuarios(forcar = false) {
      if (usuariosCarregados && !forcar) {
        renderizarListaUsuarios();
        return bancoUsuarios;
      }

      const consultaUsuarios = usuarioLogado?.perfil === 'gestor'
        ? query(collection(db, "usuarios"), where("perfil", "==", "conferente"))
        : collection(db, "usuarios");
      const snapshot = await getDocs(consultaUsuarios);
      bancoUsuarios = snapshot.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() }));
      usuariosCarregados = true;

      bancoUsuarios.forEach(usuario => {
        (usuario.divisaoAtribuidas || usuario.divisoesAtribuidas || []).forEach(divisao => catalogoDivisoes.add(divisao));
      });
      popularSelectsDivisao();
      renderizarListaUsuarios();
      return bancoUsuarios;
    }

    async function carregarCatalogoDivisoes(forcar = false) {
      (usuarioLogado?.divisoesAtribuidas || []).forEach(divisao => catalogoDivisoes.add(divisao));
      if (catalogoDivisoesCarregado && !forcar) {
        popularSelectsDivisao();
        return;
      }

      try {
        const resultado = await listarDivisoesAtivas();
        resultado.nomes.forEach(nome => catalogoDivisoes.add(nome));
        catalogoDivisoesCarregado = true;
      } catch (erro) {
        console.warn("Catálogo de divisões indisponível; usando atribuições dos usuários como fallback.", erro);
      }

      if (catalogoDivisoes.size === 0 && usuarioLogado?.perfil !== 'conferente' && !usuariosCarregados) {
        await carregarUsuarios();
      }

      popularSelectsDivisao();
    }

    async function carregarPatrimoniosPermitidos() {
      if (!usuarioLogado) return [];
      if (usuarioLogado.perfil === 'admin' || usuarioLogado.perfil === 'gestor') {
        const snapshot = await getDocs(collection(db, "patrimonios"));
        const itens = snapshot.docs.map(normalizarPatrimonio);
        cachearPatrimonios(itens);
        adicionarDivisoesAoCatalogo(itens);
        return itens;
      }

      const divisoes = [...new Set(usuarioLogado.divisoesAtribuidas || [])];
      if (divisoes.length === 0) return [];

      const resultados = new Map();
      for (const lote of dividirEmLotes(divisoes)) {
        const consulta = query(collection(db, "patrimonios"), or(
          where("divisaoOrigem", "in", lote),
          where("divisao", "in", lote),
          where("localizacaoAtual", "in", lote),
          and(where("statusTransferencia", "==", "pendente"), where("divisaoDestinoSugerida", "in", lote))
        ));
        const snapshot = await getDocs(consulta);
        snapshot.docs.map(normalizarPatrimonio).forEach(item => resultados.set(item.plaqueta, item));
      }
      const itens = [...resultados.values()].filter(item => patrimonioVisivelParaDivisoes(item, divisoes));
      cachearPatrimonios(itens);
      adicionarDivisoesAoCatalogo(itens);
      return itens;
    }

    function limparPlaqueta(str) {
      if (!str) return '';
      return String(str).replace(/\D/g, '');
    }

    function usuarioTemAcessoDivisao(divisao) {
      if (!usuarioLogado) return false;
      if (usuarioLogado.perfil === 'admin' || usuarioLogado.perfil === 'gestor') return true;
      return (usuarioLogado.divisoesAtribuidas || []).includes(divisao);
    }

    function popularSelectsDivisao() {
      const selectLocalizacao = document.getElementById('select-localizacao');
      const selectReversao = document.getElementById('select-divisao-reversao');
      const selectHistorico = document.getElementById('select-divisao-historico');
      const checkContainer = document.getElementById('cad-divisoes-checkboxes');
      const editCheckContainer = document.getElementById('edit-divisoes-checkboxes');
      const comparadorPtBr = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
      const divSet = [...catalogoDivisoes].filter(Boolean).sort(comparadorPtBr.compare);
      if (divSet.length === 0) return;

      const reconstruirSelect = (select, filtro = () => true) => {
        if (!select) return;
        const valorSelecionado = select.value;
        const opcaoInicial = select.options[0]?.cloneNode(true);
        select.replaceChildren();
        if (opcaoInicial) select.appendChild(opcaoInicial);
        divSet.filter(filtro).forEach(divisao => {
          const option = document.createElement('option');
          option.value = divisao;
          option.innerText = divisao;
          select.appendChild(option);
        });
        if ([...select.options].some(option => option.value === valorSelecionado)) {
          select.value = valorSelecionado;
        }
      };

      reconstruirSelect(selectLocalizacao, usuarioTemAcessoDivisao);
      reconstruirSelect(selectReversao);
      reconstruirSelect(selectHistorico, usuarioTemAcessoDivisao);
      atualizarSeletorEscopo();

      const marcadasCadastro = new Set([...document.querySelectorAll('input[name="divisao-check"]:checked')].map(cb => cb.value));
      const marcadasEdicao = new Set([...document.querySelectorAll('input[name="edit-divisao-check"]:checked')].map(cb => cb.value));
      const preencherCheckboxes = (container, nome, marcadas) => {
        if (!container) return;
        container.replaceChildren();
        divSet.forEach(divisao => {
          const label = document.createElement('label');
          label.className = 'flex items-center gap-2 cursor-pointer text-slate-300';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.name = nome;
          checkbox.value = divisao;
          checkbox.checked = marcadas.has(divisao);
          checkbox.className = 'rounded bg-slate-800 border-slate-700';
          const texto = document.createElement('span');
          texto.textContent = divisao;
          label.append(checkbox, texto);
          container.appendChild(label);
        });
      };

      preencherCheckboxes(checkContainer, 'divisao-check', marcadasCadastro);
      preencherCheckboxes(editCheckContainer, 'edit-divisao-check', marcadasEdicao);
    }

    function atualizarSeletorEscopo() {
      const select = document.getElementById('escopo-divisao');
      if (!select || !usuarioLogado) return;
      const divisoes = divisoesDisponiveis(usuarioLogado, [...catalogoDivisoes]);
      const opcoes = [];
      if (usuarioLogado.perfil === 'conferente' && divisoes.length > 1) {
        opcoes.push({ valor: '', texto: 'Escolha uma divisão para começar' });
      }
      if (usuarioLogado.perfil !== 'conferente' || divisoes.length > 1) {
        opcoes.push({ valor: 'todas', texto: 'Todas as divisões permitidas' });
      }
      divisoes.forEach(divisao => opcoes.push({ valor: divisao, texto: divisao }));
      select.replaceChildren(...opcoes.map(({ valor, texto }) => {
        const opcao = document.createElement('option');
        opcao.value = valor;
        opcao.textContent = texto;
        return opcao;
      }));
      select.value = escopoVisualizacao;
      document.getElementById('escopo-descricao').textContent = !escopoVisualizacao
        ? 'Escolha uma divisão para consultar o Painel e a Relação.'
        : escopoVisualizacao === 'todas'
          ? 'Painel e Relação: todas as divisões permitidas. A Fila de aprovação mantém a visão geral.'
          : `Painel e Relação: itens atualmente em ${escopoVisualizacao} e transferências aguardando entrada. A Fila de aprovação mantém a visão geral.`;
    }

    function inicializarEscopoVisualizacao() {
      let salvo = '';
      try { salvo = sessionStorage.getItem(`cmapp-escopo-${usuarioLogado.uid}`) || ''; }
      catch (_) {}
      escopoVisualizacao = escopoInicial(usuarioLogado, [...catalogoDivisoes], salvo);
      revisaoEscopo++;
      atualizarSeletorEscopo();
    }

    document.getElementById('escopo-divisao').addEventListener('change', async evento => {
      if (!usuarioLogado) return;
      const valor = evento.target.value;
      const permitidas = divisoesDisponiveis(usuarioLogado, [...catalogoDivisoes]);
      if (valor !== 'todas' && !permitidas.includes(valor)) return;
      if (valor === escopoVisualizacao) return;
      escopoVisualizacao = valor;
      revisaoEscopo++;
      try { sessionStorage.setItem(`cmapp-escopo-${usuarioLogado.uid}`, valor); }
      catch (_) {}
      invalidarCacheRelacao({ preservarInventarios: true });
      bancoPatrimonio = [];
      itensFiltradosCache = [];
      atualizarSeletorEscopo();
      if (abaAtual === 'dashboard') await carregarDashboard();
      if (abaAtual === 'lista') await carregarRelacaoPatrimonial({ reiniciar: true });
    });

    async function alternarAba(abaAtiva, { registrarHistorico = true, substituirHistorico = false } = {}) {
      if (usuarioLogado && usuarioLogado.perfil === 'conferente') {
        if (abaAtiva === 'transferencias' || abaAtiva === 'usuarios') {
          return;
        }
      }

      if (registrarHistorico) registrarAbaHistorico(abaAtiva, { substituir: substituirHistorico });
      abaAtual = abaAtiva;
      ativarPagina(abaAtiva);
      document.getElementById('escopo-barra').classList.toggle('hidden', !['dashboard', 'lista'].includes(abaAtiva));
      fecharNavegacaoMovel();

      if (abaAtiva !== 'scanner' && controladorCamera.estaAtiva()) {
        await controladorCamera.desligar({ retomarAposSalvar: true });
      }

      ['dashboard', 'scanner', 'transferencias', 'usuarios', 'inventarios', 'lista', 'perfil'].forEach(aba => {
        const sec = document.getElementById(`sec-${aba}`);
        if (sec) sec.classList.toggle('hidden', aba !== abaAtiva);
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (usuarioLogado && usuarioLogado.perfil === 'conferente') {
        document.getElementById('tab-btn-transferencias').classList.add('hidden');
        document.getElementById('tab-btn-usuarios').classList.add('hidden');
      }

      try {
        if (abaAtiva === 'dashboard') await carregarDashboard();
        if (abaAtiva === 'scanner') await carregarCatalogoDivisoes();
        if (abaAtiva === 'transferencias' && unsubscribeTransferencias.length === 0) iniciarOuvinteTransferencias();
        if (abaAtiva === 'usuarios') {
          await carregarUsuarios();
          await carregarCatalogoDivisoes();
        }
        if (abaAtiva === 'inventarios') {
          await carregarCatalogoDivisoes();
          await Promise.all([carregarProgressoInventarios(), carregarHistoricoInventarios(), carregarHistoricoGeral()]);
          if (usuarioLogado.perfil !== 'conferente') await atualizarEstadoDivisaoInventario();
        }
        if (abaAtiva === 'perfil') atualizarDadosTelaPerfil();
        if (abaAtiva === 'lista') await carregarRelacaoPatrimonial();
      } catch (erro) {
        console.error(`Erro ao carregar a aba ${abaAtiva}:`, erro);
        notificarMensagem("Não foi possível carregar os dados desta tela. Verifique sua conexão e tente novamente.", 'erro');
      }
    }

    function aplicarNumerosDashboard(total, localizados, pendentes, aguardando, aguardandoGlobal = aguardando) {
      document.getElementById('dash-total').innerText = total;
      document.getElementById('dash-localizados').innerText = localizados;
      document.getElementById('dash-pendentes').innerText = pendentes;
      document.getElementById('dash-aguardando').innerText = aguardando;
      const percentual = total > 0 ? Math.round((localizados / total) * 100) : 0;
      document.getElementById('dash-progress-text').innerText = `${percentual}% concluído`;
      document.getElementById('dash-progress-bar').style.width = `${percentual}%`;
      const progresso = document.querySelector('.progress-track');
      progresso?.setAttribute('aria-valuenow', String(percentual));

      // O badge da fila é mantido pelos listeners em tempo real, incluindo
      // transferências físicas e sugestões de destino.
    }

    document.querySelectorAll('[data-dashboard-target]').forEach(card => {
      card.addEventListener('click', async () => {
        const destino = card.dataset.dashboardTarget;
        if (destino === 'transferencias') {
          if (usuarioLogado?.perfil !== 'conferente') {
            await alternarAba('transferencias');
            return;
          }
          document.getElementById('filtro-status').value = 'aguardando';
          if (!aplicarFiltrosNaBaseCompleta()) relacaoCarregada = false;
          await alternarAba('lista');
          return;
        }
        document.getElementById('filtro-status').value = destino === 'todos' ? 'todos' : destino;
        if (!aplicarFiltrosNaBaseCompleta()) relacaoCarregada = false;
        await alternarAba('lista');
      });
    });

    async function buscarItensHistoricosForaDoEscopo(divisoes) {
      // Contagens da consulta incluem a origem histórica. A desigualdade consulta
      // somente bens que já receberam um local atual diferente da origem.
      const patrimoniosRef = collection(db, 'patrimonios');
      const consultas = divisoes.flatMap(divisao => ['divisaoOrigem', 'divisao'].map(campo =>
        getDocs(query(patrimoniosRef,
          where(campo, '==', divisao), where('localizacaoAtual', '!=', divisao)))
      ));
      const snapshots = await Promise.all(consultas);
      const candidatos = new Map();
      snapshots.forEach(snapshot => snapshot.docs.forEach(docSnap =>
        candidatos.set(docSnap.id, normalizarPatrimonio(docSnap))));
      return [...candidatos.values()].filter(item => !patrimonioVisivelParaDivisoes(item, divisoes));
    }

    function criarFiltroDivisao(divisao) {
      return or(
        where('divisaoOrigem', '==', divisao),
        where('divisao', '==', divisao),
        where('localizacaoAtual', '==', divisao),
        and(where('statusTransferencia', '==', 'pendente'),
          where('divisaoDestinoSugerida', '==', divisao))
      );
    }

    async function obterContagensDivisao(divisao, { incluirEntradas = false } = {}) {
      const patrimoniosRef = collection(db, 'patrimonios');
      const filtroDivisao = criarFiltroDivisao(divisao);
      const [totalSnap, localizadosSnap, aguardandoSnap, movidosParaFora, entradasSnap] = await Promise.all([
        getCountFromServer(query(patrimoniosRef, filtroDivisao)),
        getCountFromServer(query(patrimoniosRef, and(filtroDivisao, where('localizado', '==', true)))),
        getCountFromServer(query(patrimoniosRef, and(filtroDivisao, where('statusTransferencia', '==', 'pendente')))),
        buscarItensHistoricosForaDoEscopo([divisao]),
        incluirEntradas
          ? getDocs(query(patrimoniosRef,
            where('statusTransferencia', '==', 'pendente'),
            where('divisaoDestinoSugerida', '==', divisao)))
          : Promise.resolve(null)
      ]);
      const aguardandoInicial = aguardandoSnap.data().count;
      const contagens = descontarItensForaDoEscopo({
        total: totalSnap.data().count,
        localizados: Math.max(0, localizadosSnap.data().count - aguardandoInicial),
        aguardando: aguardandoInicial
      }, movidosParaFora);
      const entradas = entradasSnap?.docs.map(normalizarPatrimonio).filter(item =>
        (item.localizacaoAtual || item.divisaoOrigem || item.divisao) !== divisao).length || 0;
      return { contagens, entradas };
    }

    function criarCardProgressoInventario(divisao) {
      const card = document.createElement('article');
      card.className = 'inventario-card';
      card.innerHTML = `
        <span class="inventario-ribbon hidden" aria-label="Inventário encerrado">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.2 3.2 7.8-8.2"/></svg>
          <span>ENCERRADO</span>
        </span>
        <div class="inventario-card-header">
          <h3 class="inventario-nome font-bold text-white text-sm break-words"></h3>
          <strong class="inventario-percentual text-slate-300 text-sm whitespace-nowrap">…</strong>
        </div>
        <p class="inventario-ciclo mt-1 text-[11px] text-slate-300">Consultando ciclo…</p>
        <p class="inventario-resumo mt-1 text-xs text-slate-400" role="status">Consultando progresso…</p>
        <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <span></span>
        </div>
        <div class="inventario-estatisticas hidden">
          <span class="text-emerald-300"><strong class="inventario-localizados">0</strong> localizados</span>
          <span class="text-red-300"><strong class="inventario-pendentes">0</strong> pendentes</span>
          <span class="text-amber-300"><strong class="inventario-aguardando">0</strong> aguardando aprovação</span>
        </div>
        <p class="inventario-entradas hidden mt-2 text-[11px] text-amber-300"></p>
        <button type="button" class="inventario-abrir mt-3 text-xs font-bold text-blue-300 hover:text-blue-200">Ver na Relação →</button>
      `;
      card.querySelector('.inventario-nome').textContent = divisao;
      card.querySelector('.progress-track').setAttribute('aria-label', `Progresso do inventário: ${divisao}`);
      card.querySelector('.inventario-abrir').addEventListener('click', async () => {
        if (!usuarioLogado || !divisoesDisponiveis(usuarioLogado, [...catalogoDivisoes]).includes(divisao)) return;
        escopoVisualizacao = divisao;
        revisaoEscopo++;
        try { sessionStorage.setItem(`cmapp-escopo-${usuarioLogado.uid}`, divisao); } catch (_) {}
        invalidarCacheRelacao({ preservarInventarios: true });
        bancoPatrimonio = [];
        itensFiltradosCache = [];
        atualizarSeletorEscopo();
        document.getElementById('filtro-status').value = 'todos';
        document.getElementById('filtro-busca').value = '';
        await alternarAba('lista');
      });
      return card;
    }

    function mostrarResumoInventario(card, resumo) {
      const { total, localizados, pendentes, aguardando, entradas, percentual } = resumo;
      card.classList.toggle('com-progresso', total > 0);
      if (total > 0) {
        // Vermelho (0%), âmbar (50%) e verde (100%), com transição contínua.
        const tom = percentual <= 50
          ? 42 * percentual / 50
          : 42 + 103 * (percentual - 50) / 50;
        card.style.setProperty('--inventario-tom', String(Math.round(tom)));
      } else card.style.removeProperty('--inventario-tom');
      card.querySelector('.inventario-percentual').textContent = total ? `${percentual}%` : '—';
      card.querySelector('.inventario-resumo').textContent = total
        ? `${localizados} de ${total} itens localizados`
        : 'Nenhum item atualmente nesta divisão';
      const barra = card.querySelector('.progress-track');
      barra.setAttribute('aria-valuenow', String(percentual));
      barra.querySelector('span').style.width = `${percentual}%`;
      card.querySelector('.inventario-localizados').textContent = localizados;
      card.querySelector('.inventario-pendentes').textContent = pendentes;
      card.querySelector('.inventario-aguardando').textContent = aguardando;
      card.querySelector('.inventario-estatisticas').classList.remove('hidden');
      const textoEntradas = card.querySelector('.inventario-entradas');
      textoEntradas.textContent = `${entradas} ${entradas === 1 ? 'entrada' : 'entradas'} aguardando aprovação, fora do percentual`;
      textoEntradas.classList.toggle('hidden', entradas === 0);
    }

    async function carregarProgressoInventarios({ forcar = false } = {}) {
      if (!usuarioLogado) return;
      const uid = usuarioLogado.uid;
      const revisao = ++revisaoInventarios;
      const divisoes = divisoesDisponiveis(usuarioLogado, [...catalogoDivisoes]);
      const container = document.getElementById('lista-progresso-inventarios');
      const botaoAtualizar = document.getElementById('btn-atualizar-inventarios');
      if (forcar) cacheResumoInventarios.clear();
      botaoAtualizar.disabled = true;
      botaoAtualizar.classList.add('opacity-60');
      const cards = new Map(divisoes.map(divisao => [divisao, criarCardProgressoInventario(divisao)]));
      container.replaceChildren(...cards.values());
      if (divisoes.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400">Nenhuma divisão disponível para acompanhar.</p>';
        botaoAtualizar.disabled = false;
        botaoAtualizar.classList.remove('opacity-60');
        return;
      }
      const pendentes = [];
      divisoes.forEach(divisao => {
        const salvo = cacheResumoInventarios.get(divisao);
        if (salvo && Date.now() - salvo.atualizadoEm < VALIDADE_RESUMO_INVENTARIO_MS) {
          mostrarResumoInventario(cards.get(divisao), salvo.resumo);
        } else pendentes.push(divisao);
      });
      const buscar = async () => {
        while (pendentes.length && revisao === revisaoInventarios && abaAtual === 'inventarios') {
          const divisao = pendentes.shift();
          try {
            const { contagens, entradas } = await obterContagensDivisao(divisao, { incluirEntradas: true });
            if (revisao !== revisaoInventarios || usuarioLogado?.uid !== uid) return;
            const resumo = resumirProgressoDivisao(contagens, entradas);
            cacheResumoInventarios.set(divisao, { resumo, atualizadoEm: Date.now() });
            mostrarResumoInventario(cards.get(divisao), resumo);
          } catch (erro) {
            console.error(`Falha ao consultar o inventário de ${divisao}:`, erro);
            if (revisao !== revisaoInventarios || usuarioLogado?.uid !== uid) return;
            cards.get(divisao).querySelector('.inventario-percentual').textContent = '—';
            cards.get(divisao).querySelector('.inventario-resumo').textContent = 'Contagem indisponível. Tente atualizar.';
          }
        }
      };
      const estadosPendentes = [...divisoes];
      const buscarEstados = async () => {
        while (estadosPendentes.length && revisao === revisaoInventarios && abaAtual === 'inventarios') {
          const divisao = estadosPendentes.shift();
          try {
            const estado = await consultarCicloDivisao(divisao);
            if (revisao !== revisaoInventarios || usuarioLogado?.uid !== uid) return;
            const card = cards.get(divisao);
            card.querySelector('.inventario-ciclo').textContent = `Ciclo ${estado.ciclo} · ${({
              aberto: 'Em andamento', encerrando: 'Encerramento em andamento',
              encerrado: 'Encerrado', reiniciando: 'Reinício em andamento'
            })[estado.estado] || 'Estado indisponível'}`;
            const encerrado = estado.estado === 'encerrado';
            card.classList.toggle('esta-encerrado', encerrado);
            card.querySelector('.inventario-ribbon').classList.toggle('hidden', !encerrado);
          } catch (_) {
            if (revisao !== revisaoInventarios || usuarioLogado?.uid !== uid) return;
            cards.get(divisao).querySelector('.inventario-ciclo').textContent = 'Estado indisponível';
          }
        }
      };
      await Promise.all([
        ...Array.from({ length: Math.min(2, pendentes.length) }, () => buscar()),
        ...Array.from({ length: Math.min(2, estadosPendentes.length) }, () => buscarEstados())
      ]);
      if (revisao === revisaoInventarios && usuarioLogado?.uid === uid) {
        botaoAtualizar.disabled = false;
        botaoAtualizar.classList.remove('opacity-60');
      }
    }

    document.getElementById('btn-atualizar-inventarios').addEventListener('click', () => {
      void carregarProgressoInventarios({ forcar: true });
    });

    async function carregarDashboard() {
      if (!usuarioLogado) return;
      const escopoDaConsulta = escopoVisualizacao;
      const revisaoDaConsulta = revisaoEscopo;
      ['dash-total', 'dash-localizados', 'dash-pendentes', 'dash-aguardando']
        .forEach(id => document.getElementById(id).innerText = '…');

      if (!escopoDaConsulta) {
        ['dash-total', 'dash-localizados', 'dash-pendentes', 'dash-aguardando']
          .forEach(id => document.getElementById(id).innerText = '—');
        document.getElementById('dash-progress-text').innerText = 'Escolha uma divisão para começar';
        document.getElementById('dash-progress-bar').style.width = '0%';
        document.querySelector('.progress-track')?.setAttribute('aria-valuenow', '0');
        return;
      }

      if (escopoDaConsulta !== 'todas') {
        const patrimoniosRef = collection(db, 'patrimonios');
        try {
          const [{ contagens }, globalSnap] = await Promise.all([
            obterContagensDivisao(escopoDaConsulta),
            usuarioLogado.perfil === 'conferente'
              ? Promise.resolve(null)
              : getCountFromServer(query(patrimoniosRef, where('statusTransferencia', '==', 'pendente')))
                .catch(erro => {
                  console.warn('Contagem global da Fila indisponível.', erro);
                  return null;
                })
          ]);
          if (revisaoDaConsulta !== revisaoEscopo) return;
          aplicarNumerosDashboard(contagens.total, contagens.localizados,
            contagens.pendentes, contagens.aguardando, globalSnap?.data().count ?? 0);
        } catch (erro) {
          if (revisaoDaConsulta !== revisaoEscopo) return;
          console.error('Falha nas contagens da divisão selecionada:', erro);
          ['dash-total', 'dash-localizados', 'dash-pendentes', 'dash-aguardando']
            .forEach(id => document.getElementById(id).innerText = '—');
          document.getElementById('dash-progress-text').innerText = 'Contagens indisponíveis para esta divisão';
          document.getElementById('dash-progress-bar').style.width = '0%';
          document.querySelector('.progress-track')?.setAttribute('aria-valuenow', '0');
        }
        return;
      }

      if (usuarioLogado.perfil === 'admin' || usuarioLogado.perfil === 'gestor') {
        const patrimoniosRef = collection(db, "patrimonios");
        const [totalSnap, localizadosSnap, aguardandoSnap] = await Promise.all([
          getCountFromServer(patrimoniosRef),
          getCountFromServer(query(patrimoniosRef, where("localizado", "==", true))),
          getCountFromServer(query(patrimoniosRef, where("statusTransferencia", "==", "pendente")))
        ]);
        if (revisaoDaConsulta !== revisaoEscopo) return;

        const total = totalSnap.data().count;
        const totalMarcadosLocalizados = localizadosSnap.data().count;
        const aguardando = aguardandoSnap.data().count;
        const localizados = Math.max(0, totalMarcadosLocalizados - aguardando);
        const pendentes = Math.max(0, total - localizados - aguardando);
        aplicarNumerosDashboard(total, localizados, pendentes, aguardando);
        return;
      }

      const divisoes = [...new Set(usuarioLogado.divisoesAtribuidas || [])];
      if (divisoes.length === 0) {
        aplicarNumerosDashboard(0, 0, 0, 0);
        return;
      }

      if (divisoes.length <= 10) {
        try {
          const patrimoniosRef = collection(db, "patrimonios");
          const filtroAcesso = or(
            where("divisaoOrigem", "in", divisoes),
            where("divisao", "in", divisoes),
            where("localizacaoAtual", "in", divisoes)
          );
          const filtroDestinosPendentes = and(
            where("statusTransferencia", "==", "pendente"),
            where("divisaoDestinoSugerida", "in", divisoes)
          );
          const [totalSnap, localizadosSnap, aguardandoSnap, movidosParaFora] = await Promise.all([
            getCountFromServer(query(patrimoniosRef, filtroAcesso)),
            getCountFromServer(query(patrimoniosRef, and(filtroAcesso, where("localizado", "==", true)))),
            getCountFromServer(query(patrimoniosRef, and(filtroAcesso, where("statusTransferencia", "==", "pendente")))),
            buscarItensHistoricosForaDoEscopo(divisoes)
          ]);
          let extras;
          if (divisoes.length <= 3) {
            try {
              const [destinosSnap, sobreposicaoSnap] = await Promise.all([
                getCountFromServer(query(patrimoniosRef, filtroDestinosPendentes)),
                getCountFromServer(query(patrimoniosRef, and(filtroDestinosPendentes, filtroAcesso)))
              ]);
              extras = Math.max(0, destinosSnap.data().count - sobreposicaoSnap.data().count);
            } catch (erroContagem) {
              console.warn('Contagem das pendências de entrada indisponível; consultando somente pendências.', erroContagem);
            }
          }
          if (extras === undefined) {
            const destinosSnap = await getDocs(query(patrimoniosRef, filtroDestinosPendentes));
            extras = destinosSnap.docs.map(normalizarPatrimonio).filter(item =>
              ![item.divisaoOrigem, item.divisao, item.localizacaoAtual].some(divisao => divisoes.includes(divisao))
            ).length;
          }
          if (revisaoDaConsulta !== revisaoEscopo) return;
          const aguardandoInicial = aguardandoSnap.data().count;
          const contagens = descontarItensForaDoEscopo({
            total: totalSnap.data().count + extras,
            localizados: Math.max(0, localizadosSnap.data().count - aguardandoInicial),
            aguardando: aguardandoInicial + extras
          }, movidosParaFora);
          aplicarNumerosDashboard(
            contagens.total,
            contagens.localizados,
            contagens.pendentes,
            contagens.aguardando
          );
          return;
        } catch (erro) {
          console.warn("Contagens por alçada indisponíveis.", erro);
        }
      }

      if (divisoes.length > 10) {
        ['dash-total', 'dash-localizados', 'dash-pendentes', 'dash-aguardando']
          .forEach(id => document.getElementById(id).innerText = '—');
        document.getElementById('dash-progress-text').innerText = 'Consulte a Relação paginada';
        document.getElementById('dash-progress-bar').style.width = '0%';
        document.querySelector('.progress-track')?.setAttribute('aria-valuenow', '0');
        document.getElementById('badge-fila-count').classList.add('hidden');
        return;
      }

      if (revisaoDaConsulta !== revisaoEscopo) return;
      ['dash-total', 'dash-localizados', 'dash-pendentes', 'dash-aguardando']
        .forEach(id => document.getElementById(id).innerText = '—');
      document.getElementById('dash-progress-text').innerText = 'Contagens indisponíveis; consulte a Relação';
      document.getElementById('dash-progress-bar').style.width = '0%';
      document.querySelector('.progress-track')?.setAttribute('aria-valuenow', '0');
      document.getElementById('badge-fila-count').classList.add('hidden');
    }

    const formatarDataInventario = valor => valor?.toDate?.().toLocaleString('pt-BR') || 'Data indisponível';
    const botoesCiclo = [
      'btn-encerrar-divisao', 'btn-reabrir-divisao', 'btn-reverter-divisao',
      'btn-encerrar-geral', 'btn-reverter-geral'
    ];

    async function atualizarEstadoDivisaoInventario() {
      const divisao = document.getElementById('select-divisao-reversao').value;
      const texto = document.getElementById('estado-divisao-inventario');
      const fechar = document.getElementById('btn-encerrar-divisao');
      const reabrir = document.getElementById('bloco-reabertura-divisao');
      const reiniciar = document.getElementById('btn-reverter-divisao');
      fechar.classList.toggle('hidden', !divisao);
      reabrir.classList.add('hidden');
      reiniciar.classList.add('hidden');
      if (!divisao) {
        texto.textContent = 'Selecione uma divisão para consultar o ciclo.';
        return;
      }
      try {
        const estado = await consultarCicloDivisao(divisao);
        const geral = estado.estado === 'encerrado'
          ? await consultarEncerramentoGeral(estado.ciclo) : null;
        if (document.getElementById('select-divisao-reversao').value !== divisao) return;
        texto.textContent = `${divisao} · Ciclo ${estado.ciclo} · ${({
          aberto: 'Em andamento', encerrando: 'Encerramento em andamento',
          encerrado: 'Encerrado', reiniciando: 'Reinício em andamento'
        })[estado.estado] || 'Estado indisponível'}${geral ? ' · Inventário geral consolidado' : ''}`;
        fechar.classList.toggle('hidden', !['aberto', 'encerrando'].includes(estado.estado));
        fechar.textContent = estado.estado === 'encerrando' ? 'Retomar encerramento' : 'Encerrar e registrar divisão';
        reabrir.classList.toggle('hidden', estado.estado !== 'encerrado' || Boolean(geral));
        reiniciar.classList.toggle('hidden', estado.estado !== 'reiniciando'
          && (estado.estado !== 'encerrado' || !geral));
        reiniciar.textContent = estado.estado === 'reiniciando'
          ? 'Retomar início do próximo ciclo' : 'Iniciar próximo ciclo da divisão';
      } catch (erro) {
        texto.textContent = 'Estado indisponível. Verifique a conexão e as regras do Firestore.';
        fechar.classList.add('hidden');
      }
    }

    async function executarAcaoCiclo(acao) {
      botoesCiclo.forEach(id => { document.getElementById(id).disabled = true; });
      try {
        const mensagem = await acao();
        if (mensagem) notificarMensagem(mensagem, 'sucesso');
        invalidarCacheRelacao();
        await Promise.all([
          carregarProgressoInventarios({ forcar: true }),
          carregarHistoricoInventarios(), carregarHistoricoGeral(),
          atualizarEstadoDivisaoInventario()
        ]);
      } catch (erro) {
        console.error('Falha na gestão do inventário:', erro);
        notificarMensagem(erro.message || 'Não foi possível concluir a operação. Você pode retomá-la nesta tela.', 'erro', { duracao: 11000 });
        await atualizarEstadoDivisaoInventario();
      } finally {
        botoesCiclo.forEach(id => { document.getElementById(id).disabled = false; });
      }
    }

    async function carregarHistoricoInventarios() {
      const divisao = document.getElementById('select-divisao-historico').value;
      const lista = document.getElementById('lista-historico-inventarios');
      if (!divisao) {
        lista.textContent = 'Selecione uma divisão para consultar os encerramentos.';
        return;
      }
      lista.textContent = 'Carregando o histórico…';
      try {
        const [fechamentos, eventos] = await Promise.all([
          listarFechamentos(divisao), listarEventosInventario(divisao)
        ]);
        if (document.getElementById('select-divisao-historico').value !== divisao) return;
        lista.replaceChildren();
        if (!fechamentos.length) {
          lista.textContent = 'Ainda não há encerramentos registrados nesta divisão.';
          return;
        }
        for (const fechamento of fechamentos) {
          const reaberturas = eventos.filter(evento => evento.fechamentoId === fechamento.id)
            .sort((a, b) => (a.registradoEm?.toMillis?.() || 0) - (b.registradoEm?.toMillis?.() || 0));
          const card = document.createElement('article');
          card.className = 'rounded-lg border border-slate-700 bg-slate-900/70 p-3 space-y-2';
          card.innerHTML = `
            <div class="flex justify-between gap-2"><strong class="text-white">Ciclo ${escaparHtml(fechamento.ciclo)}</strong><span>${escaparHtml(formatarDataInventario(fechamento.encerradoEm))}</span></div>
            <p>Início: ${fechamento.iniciadoEm ? escaparHtml(formatarDataInventario(fechamento.iniciadoEm)) : 'não registrado'}</p>
            <p>${escaparHtml(fechamento.localizados)} localizados · ${escaparHtml(fechamento.pendentes)} pendentes · ${escaparHtml(fechamento.total)} no total</p>
            <p>Encerrado por ${escaparHtml(fechamento.encerradoPorNome || fechamento.encerradoPorEmail || 'Não registrado')}</p>
            ${reaberturas.map(evento => `<p class="text-amber-300">Reaberto em ${escaparHtml(formatarDataInventario(evento.registradoEm))} por ${escaparHtml(evento.usuarioNome || evento.usuarioEmail)} · Motivo: ${escaparHtml(evento.motivo)}</p>`).join('')}
            <button type="button" class="text-blue-300 font-bold hover:text-blue-200">Ver itens desta fotografia</button>
            <div class="hidden space-y-1 max-h-80 overflow-y-auto"></div>`;
          const btn = card.querySelector('button');
          const destino = card.lastElementChild;
          btn.addEventListener('click', async () => {
            if (!destino.classList.contains('hidden')) {
              destino.classList.add('hidden'); btn.textContent = 'Ver itens desta fotografia'; return;
            }
            destino.classList.remove('hidden');
            if (destino.dataset.carregado) { btn.textContent = 'Ocultar itens'; return; }
            destino.textContent = 'Carregando itens…';
            try {
              const itens = await listarItensFechamento(divisao, fechamento.id);
              destino.innerHTML = itens.length ? itens.map(item => {
                const conferencia = item.localizado ? [...(item.historico || [])].reverse()
                  .find(evento => ['conferencia', 'transferencia_solicitada'].includes(evento.acao)) : null;
                const responsavel = item.localizado
                  ? (conferencia?.responsavel || item.conferidoPor || 'Não registrada')
                  : 'Não registrada neste ciclo';
                return `<div class="rounded bg-slate-950/70 p-2 border border-slate-800">
                  <strong class="text-white">${escaparHtml(item.plaqueta)}</strong> · ${escaparHtml(item.descricao || 'Sem descrição')}<br>
                  ${item.localizado ? 'Localizado' : 'Pendente'} · ${escaparHtml(item.localizacaoEfetivaNoEncerramento)}<br>
                  Conferência: ${escaparHtml(responsavel)} · ${item.localizado ? escaparHtml(nomeMetodoLocalizacao(conferencia?.metodoLocalizacao)) : '—'}
                </div>`;
              }).join('') : 'Nenhum item registrado nesta fotografia.';
              destino.dataset.carregado = 'true';
              btn.textContent = 'Ocultar itens';
            } catch (erro) { destino.textContent = 'Não foi possível carregar os itens. Tente novamente.'; }
          });
          lista.appendChild(card);
        }
      } catch (erro) {
        lista.textContent = 'Histórico indisponível. Verifique a conexão e as regras do Firestore.';
      }
    }

    async function carregarHistoricoGeral() {
      const lista = document.getElementById('lista-inventarios-gerais');
      if (usuarioLogado?.perfil === 'conferente') { lista.classList.add('hidden'); return; }
      lista.classList.remove('hidden');
      try {
        const fechamentos = await listarInventariosGerais();
        lista.innerHTML = `<strong class="text-white">Consolidações gerais</strong>${fechamentos.length ? fechamentos.map(item => `
          <p class="mt-2">Ciclo ${escaparHtml(item.ciclo)} · ${escaparHtml(formatarDataInventario(item.encerradoEm))}
          · ${escaparHtml(item.localizados)} localizados, ${escaparHtml(item.pendentes)} pendentes
          (${escaparHtml(item.total)} itens em ${escaparHtml(item.divisoes.length)} divisões). Encerrado por ${escaparHtml(item.encerradoPorNome || item.encerradoPorEmail)}.</p>
        `).join('') : '<p class="mt-2">Nenhuma consolidação registrada.</p>'}`;
      } catch (_) { lista.textContent = 'Consolidações indisponíveis. Verifique as regras do Firestore.'; }
    }

    document.getElementById('select-divisao-reversao').addEventListener('change', atualizarEstadoDivisaoInventario);
    document.getElementById('select-divisao-historico').addEventListener('change', carregarHistoricoInventarios);

    document.getElementById('btn-encerrar-divisao').addEventListener('click', async () => {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return;
      const divisao = document.getElementById('select-divisao-reversao').value;
      if (!divisao) return notificarMensagem('Selecione uma divisão.', 'aviso');
      const confirmado = await confirmarAcao({
        titulo: 'Encerrar divisão',
        mensagem: `Registrar uma fotografia de ${divisao} e bloquear novas conferências nesta divisão? Itens não localizados permanecerão como pendentes no resultado.`,
        confirmarTexto: 'Encerrar divisão'
      });
      if (!confirmado) return;
      await executarAcaoCiclo(async () => {
        const resultado = await encerrarDivisao(divisao, usuarioLogado);
        document.getElementById('select-divisao-historico').value = divisao;
        return `Divisão ${divisao} encerrada: ${resultado.localizados} localizados e ${resultado.pendentes} pendentes.`;
      });
    });

    document.getElementById('btn-reabrir-divisao').addEventListener('click', async () => {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return;
      const divisao = document.getElementById('select-divisao-reversao').value;
      const motivo = document.getElementById('motivo-reabertura-divisao').value.trim();
      if (!motivo) return notificarMensagem('Informe a justificativa da reabertura.', 'aviso');
      const confirmado = await confirmarAcao({ titulo: 'Reabrir divisão',
        mensagem: `Reabrir ${divisao} para correções? O encerramento anterior e a justificativa permanecerão no histórico.`,
        confirmarTexto: 'Reabrir divisão' });
      if (!confirmado) return;
      await executarAcaoCiclo(async () => {
        await reabrirDivisao(divisao, motivo, usuarioLogado);
        document.getElementById('motivo-reabertura-divisao').value = '';
        document.getElementById('select-divisao-historico').value = divisao;
        return `Divisão ${divisao} reaberta com justificativa registrada.`;
      });
    });

    document.getElementById('btn-encerrar-geral').addEventListener('click', async () => {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return;
      const confirmado = await confirmarAcao({ titulo: 'Consolidar inventário geral',
        mensagem: 'Consolidar os resultados encerrados de todas as divisões? Depois disso, não será possível reabri-las neste ciclo.',
        confirmarTexto: 'Consolidar resultado' });
      if (!confirmado) return;
      await executarAcaoCiclo(async () => {
        const divisoes = await divisoesDoInventarioAtual();
        const resultado = await encerrarInventarioGeral(divisoes, usuarioLogado);
        return `Inventário geral do ciclo ${resultado.ciclo} registrado: ${resultado.total} itens.`;
      });
    });

    document.getElementById('btn-reverter-divisao').addEventListener('click', async () => {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return;
      const divisao = document.getElementById('select-divisao-reversao').value;
      if (!divisao) return notificarMensagem('Selecione uma divisão.', 'aviso');
      const confirmado = await confirmarAcao({ titulo: 'Iniciar próximo ciclo da divisão',
        mensagem: `Reiniciar os itens de ${divisao} após o encerramento geral? O resultado histórico permanecerá salvo.`,
        confirmarTexto: 'Iniciar próximo ciclo', perigosa: true });
      if (!confirmado) return;
      await executarAcaoCiclo(async () => {
        const quantidade = await reiniciarDivisaoEncerrada(divisao, usuarioLogado);
        return `Novo ciclo de ${divisao} iniciado: ${quantidade} itens retornaram a pendente.`;
      });
    });

    document.getElementById('btn-reverter-geral').addEventListener('click', async () => {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return;
      const confirmado = await confirmarAcao({ titulo: 'Iniciar próximo ciclo geral',
        mensagem: 'Reiniciar todas as divisões após o encerramento geral? O histórico ficará preservado. Uma falha poderá ser retomada nesta tela.',
        confirmarTexto: 'Iniciar próximo ciclo', perigosa: true });
      if (!confirmado) return;
      await executarAcaoCiclo(async () => {
        const divisoes = await divisoesDoInventarioAtual();
        const quantidade = await reiniciarInventarioGeral(divisoes, usuarioLogado);
        return `Novo ciclo geral iniciado: ${quantidade} itens reiniciados.`;
      });
    });

    window.reverterItemIndividual = async function(plaqueta) {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return notificarMensagem("Acesso negado.", 'erro');
      const confirmarReversao = await confirmarAcao({
        titulo: 'Retornar item para pendente',
        mensagem: `O patrimônio ${plaqueta} voltará ao status pendente.`,
        confirmarTexto: 'Retornar item',
        perigosa: true
      });
      if (!confirmarReversao) return;

      try {
        const atual = await getDocFromServer(doc(db, 'patrimonios', plaqueta));
        if (!atual.exists()) return notificarMensagem('Patrimônio não encontrado.', 'aviso');
        if (atual.data().statusTransferencia === 'pendente') {
          return notificarMensagem('Este patrimônio aguarda decisão na Fila de aprovação antes de poder ser reiniciado.', 'aviso');
        }
        await updateDoc(doc(db, "patrimonios", plaqueta), {
          localizado: false,
          statusTransferencia: "concluido",
          conferidoPor: "",
          observacaoAtual: "Item retornado manualmente para pendente",
          dataLocalizacao: ""
        });
        const itemCache = cachePatrimonios.get(plaqueta);
        if (itemCache) cachePatrimonios.set(plaqueta, { ...itemCache, localizado: false, statusTransferencia: "concluido" });
        invalidarCacheRelacao();
        notificarMensagem("Item retornado para pendente com sucesso.", 'sucesso');
        await fecharModalHistorico('modal-detalhes-item', 'detalhes-item');
      } catch (e) {
        notificarMensagem(e?.code === 'permission-denied'
          ? 'Item bloqueado: a divisão pode estar encerrada ou em processamento. Consulte Inventários.'
          : 'Erro ao reverter item.', 'erro');
      }
    };

    function atualizarDivisoesCadastro() {
      const perfil = usuarioLogado?.perfil === 'gestor'
        ? 'conferente'
        : document.getElementById('cad-perfil').value;
      const container = document.getElementById('cad-divisoes-container');
      container.classList.toggle('hidden', perfil !== 'conferente');
      if (perfil !== 'conferente') {
        document.querySelectorAll('input[name="divisao-check"]').forEach(cb => { cb.checked = false; });
      }
    }

    document.getElementById('cad-perfil')?.addEventListener('change', atualizarDivisoesCadastro);

    window.abrirModalCriacaoUsuario = function() {
      atualizarDivisoesCadastro();
      abrirModalHistorico('modal-criacao-usuario', 'criacao-usuario');
    }

    window.fecharModalCriacaoUsuario = function() {
      return fecharModalHistorico('modal-criacao-usuario', 'criacao-usuario');
    }

    document.getElementById('form-cad-usuario').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (usuarioLogado.perfil !== 'admin') return notificarMensagem("Apenas Administradores podem cadastrar usuários.", 'erro');

      const nome = document.getElementById('cad-nome').value.trim();
      const email = document.getElementById('cad-email').value.trim();
      const senha = document.getElementById('cad-senha').value;
      const perfil = document.getElementById('cad-perfil').value;
      const checkboxes = document.querySelectorAll('input[name="divisao-check"]:checked');
      const divisoes = perfil === 'conferente' ? Array.from(checkboxes).map(cb => cb.value) : [];

      try {
        await criarUsuarioSeguro({ nome, email, senha, perfil, divisoesAtribuidas: divisoes });

        notificarMensagem(`Colaborador ${nome} cadastrado com sucesso.`, 'sucesso');
        document.getElementById('form-cad-usuario').reset();
        document.querySelectorAll('input[name="divisao-check"]').forEach(cb => cb.checked = false);
        await fecharModalCriacaoUsuario();
        await carregarUsuarios(true);
      } catch (err) {
        let msg = "Não foi possível concluir o cadastro.";
        let tipo = 'erro';
        if (err.code === 'functions/already-exists') {
          msg = "Este e-mail já está cadastrado no sistema.";
          tipo = 'aviso';
        } else if (err.code === 'functions/invalid-argument') {
          msg = err.message || "Confira os dados informados.";
          tipo = 'aviso';
        }
        notificarMensagem(msg, tipo);
      }
    });

    function iniciaisUsuario(nome = '') {
      return nome.split(/\s+/).filter(Boolean).slice(0, 2).map(parte => parte[0]).join('').toUpperCase() || 'US';
    }

    function formatarDataUsuario(valor) {
      const data = valor?.toDate?.() || (valor ? new Date(valor) : null);
      return data && !Number.isNaN(data.getTime()) ? data.toLocaleDateString('pt-BR') : 'Legado';
    }

    function valorOrdenacaoUsuario(usuario, campo) {
      const divisoes = usuario.divisoesAtribuidas || usuario.divisaoAtribuidas || [];
      if (campo === 'criadoEm') {
        const data = usuario.criadoEm?.toDate?.() || (usuario.criadoEm ? new Date(usuario.criadoEm) : null);
        return data && !Number.isNaN(data.getTime()) ? data.getTime() : 0;
      }
      if (campo === 'ativo') return usuario.ativo === false ? 'inativo' : 'ativo';
      if (campo === 'divisoes') return divisoes.join(' ');
      return usuario[campo] || '';
    }

    function compararUsuarios(a, b) {
      const valorA = valorOrdenacaoUsuario(a, ordenacaoUsuarios.campo);
      const valorB = valorOrdenacaoUsuario(b, ordenacaoUsuarios.campo);
      const resultado = typeof valorA === 'number'
        ? valorA - valorB
        : String(valorA).localeCompare(String(valorB), 'pt-BR', { sensitivity: 'base', numeric: true });
      return ordenacaoUsuarios.direcao === 'desc' ? -resultado : resultado;
    }

    function atualizarControlesOrdenacaoUsuarios() {
      document.querySelectorAll('[data-users-sort]').forEach(botao => {
        const selecionado = botao.dataset.usersSort === ordenacaoUsuarios.campo;
        botao.classList.toggle('is-sorted', selecionado);
        botao.setAttribute('aria-sort', selecionado
          ? (ordenacaoUsuarios.direcao === 'asc' ? 'ascending' : 'descending')
          : 'none');
        const indicador = botao.querySelector('span');
        if (indicador) indicador.textContent = selecionado ? (ordenacaoUsuarios.direcao === 'asc' ? '↑' : '↓') : '';
      });
      const seletor = document.getElementById('ordenacao-usuarios');
      if (seletor) seletor.value = `${ordenacaoUsuarios.campo}:${ordenacaoUsuarios.direcao}`;
    }

    function cardUsuarioCorrespondente() {
      if (filtroStatusUsuarios === 'ativos' && filtroPerfilUsuarios === 'todos') return 'ativos';
      if (filtroStatusUsuarios === 'inativos' && filtroPerfilUsuarios === 'todos') return 'inativos';
      if (filtroStatusUsuarios === 'todos' && filtroPerfilUsuarios === 'conferente') return 'conferentes';
      if (filtroStatusUsuarios === 'todos' && filtroPerfilUsuarios === 'todos') return 'todos';
      return '';
    }

    function sincronizarFiltrosUsuarios() {
      document.querySelectorAll('[data-users-status]').forEach(item => {
        item.classList.toggle('active', item.dataset.usersStatus === filtroStatusUsuarios);
      });
      const seletorPerfil = document.getElementById('filtro-perfil-usuarios');
      if (seletorPerfil) seletorPerfil.value = filtroPerfilUsuarios;
      const cardAtual = cardUsuarioCorrespondente();
      document.querySelectorAll('[data-users-card]').forEach(card => {
        const selecionado = card.dataset.usersCard === cardAtual;
        card.classList.toggle('is-selected', selecionado);
        card.setAttribute('aria-pressed', String(selecionado));
      });
    }

    function aplicarFiltroCardUsuarios(card) {
      const repetido = card !== 'todos' && cardUsuarioCorrespondente() === card;
      const destino = repetido ? 'todos' : card;
      filtroStatusUsuarios = ['ativos', 'inativos'].includes(destino) ? destino : 'todos';
      filtroPerfilUsuarios = destino === 'conferentes' ? 'conferente' : 'todos';
      paginaUsuarios = 1;
      sincronizarFiltrosUsuarios();
      renderizarListaUsuarios();
    }

    async function obterFotoUsuarioCache(uid) {
      if (!cacheFotosUsuarios.has(uid)) {
        cacheFotosUsuarios.set(uid, obterUrlFotoPerfil(uid).catch(() => ''));
      }
      return cacheFotosUsuarios.get(uid);
    }

    async function carregarAvataresUsuarios(usuarios) {
      await Promise.all(usuarios.map(async usuario => {
        const url = await obterFotoUsuarioCache(usuario.uid);
        if (!url) return;
        document.querySelectorAll('[data-user-avatar]').forEach(avatar => {
          if (avatar.dataset.userAvatar === usuario.uid) {
            avatar.innerHTML = `<img src="${escaparHtml(url)}" alt="Foto de ${escaparHtml(usuario.nome)}">`;
          }
        });
      }));
    }

    function renderizarListaUsuarios() {
      const container = document.getElementById('lista-usuarios-container');
      const termoBusca = (document.getElementById('filtro-busca-usuarios')?.value || "").toLowerCase().trim();
      if (!container || !usuarioLogado) return;

      const usuariosFiltradosPorPermissao = bancoUsuarios.filter(u => {
        if (u.uid === usuarioLogado.uid) return false;
        if (usuarioLogado.perfil === 'admin') return true;
        if (usuarioLogado.perfil === 'gestor') {
          return u.perfil === 'conferente';
        }
        return false;
      });

      const usuariosFinais = usuariosFiltradosPorPermissao.filter(u => {
        const nomeMatch = (u.nome || "").toLowerCase().includes(termoBusca);
        const emailMatch = (u.email || "").toLowerCase().includes(termoBusca);
        const statusMatch = filtroStatusUsuarios === 'todos'
          || (filtroStatusUsuarios === 'ativos' && u.ativo !== false)
          || (filtroStatusUsuarios === 'inativos' && u.ativo === false);
        const perfilMatch = filtroPerfilUsuarios === 'todos' || u.perfil === filtroPerfilUsuarios;
        return (nomeMatch || emailMatch) && statusMatch && perfilMatch;
      }).sort(compararUsuarios);

      const total = usuariosFiltradosPorPermissao.length;
      const ativos = usuariosFiltradosPorPermissao.filter(u => u.ativo !== false).length;
      const inativos = total - ativos;
      const conferentes = usuariosFiltradosPorPermissao.filter(u => u.perfil === 'conferente').length;
      document.getElementById('usuarios-total').textContent = total;
      document.getElementById('usuarios-ativos').textContent = ativos;
      document.getElementById('usuarios-inativos').textContent = inativos;
      document.getElementById('usuarios-conferentes').textContent = conferentes;
      document.getElementById('usuarios-tab-todos-contagem').textContent = total;
      document.getElementById('usuarios-tab-ativos-contagem').textContent = ativos;
      document.getElementById('usuarios-tab-inativos-contagem').textContent = inativos;
      sincronizarFiltrosUsuarios();

      if (usuariosFinais.length === 0) {
        container.innerHTML = `<div class="users-empty">Nenhum usuário encontrado com os filtros selecionados.</div>`;
        document.getElementById('usuarios-paginacao').innerHTML = '';
        return;
      }
      const porPagina = 10;
      const totalPaginas = Math.max(1, Math.ceil(usuariosFinais.length / porPagina));
      paginaUsuarios = Math.min(paginaUsuarios, totalPaginas);
      const inicio = (paginaUsuarios - 1) * porPagina;
      const pagina = usuariosFinais.slice(inicio, inicio + porPagina);
      const rotuloPerfil = { admin: 'Administrador', gestor: 'Gestor', conferente: 'Conferente' };
      container.innerHTML = pagina.map(u => {
        const ativo = u.ativo !== false;
        const divisoes = u.divisoesAtribuidas || u.divisaoAtribuidas || [];
        return `<article class="user-row ${ativo ? '' : 'is-inactive'}" role="button" tabindex="0" data-user-details="${escaparHtml(u.uid)}" aria-label="Abrir detalhes de ${escaparHtml(u.nome)}">
          <div class="user-identity"><span class="user-avatar" data-user-avatar="${escaparHtml(u.uid)}">${escaparHtml(iniciaisUsuario(u.nome))}</span><div><strong>${escaparHtml(u.nome)}</strong><small>${escaparHtml(u.email)}</small></div></div>
          <div data-label="Perfil"><span class="user-role role-${u.perfil}">${escaparHtml(rotuloPerfil[u.perfil] || u.perfil)}</span></div>
          <div data-label="Divisões" class="user-divisions">${u.perfil === 'conferente' ? escaparHtml(divisoes.join(', ') || 'Nenhuma') : 'Acesso global'}</div>
          <div data-label="Status"><span class="user-status ${ativo ? 'active' : 'inactive'}">${ativo ? 'Ativo' : 'Inativo'}</span></div>
          <div data-label="Cadastro" class="user-date">${formatarDataUsuario(u.criadoEm)}</div>
          <div data-label="Detalhes"><span class="user-open-details">Abrir perfil →</span></div>
        </article>`;
      }).join('');
      document.getElementById('usuarios-paginacao').innerHTML = `
        <span>Exibindo ${inicio + 1}–${Math.min(inicio + porPagina, usuariosFinais.length)} de ${usuariosFinais.length}</span>
        <div><button ${paginaUsuarios === 1 ? 'disabled' : ''} onclick="mudarPaginaUsuarios(-1)" aria-label="Página anterior">‹</button><strong>${paginaUsuarios}/${totalPaginas}</strong><button ${paginaUsuarios === totalPaginas ? 'disabled' : ''} onclick="mudarPaginaUsuarios(1)" aria-label="Próxima página">›</button></div>`;
      atualizarControlesOrdenacaoUsuarios();
      carregarAvataresUsuarios(pagina);
    }

    window.mudarPaginaUsuarios = deslocamento => { paginaUsuarios += deslocamento; renderizarListaUsuarios(); };

    const filtroBuscaUsuarios = document.getElementById('filtro-busca-usuarios');
    const btnLimparBuscaUsuarios = document.getElementById('btn-limpar-busca-usuarios');
    filtroBuscaUsuarios?.addEventListener('input', () => {
      btnLimparBuscaUsuarios?.classList.toggle('hidden', !filtroBuscaUsuarios.value);
      paginaUsuarios = 1;
      renderizarListaUsuarios();
    });
    btnLimparBuscaUsuarios?.addEventListener('click', () => {
      filtroBuscaUsuarios.value = '';
      btnLimparBuscaUsuarios.classList.add('hidden');
      renderizarListaUsuarios();
      filtroBuscaUsuarios.focus();
    });

    document.querySelectorAll('[data-users-status]').forEach(botao => botao.addEventListener('click', () => {
      filtroStatusUsuarios = botao.dataset.usersStatus;
      paginaUsuarios = 1;
      sincronizarFiltrosUsuarios();
      renderizarListaUsuarios();
    }));
    document.getElementById('filtro-perfil-usuarios')?.addEventListener('change', evento => {
      filtroPerfilUsuarios = evento.target.value;
      paginaUsuarios = 1;
      sincronizarFiltrosUsuarios();
      renderizarListaUsuarios();
    });

    document.querySelectorAll('[data-users-card]').forEach(card => card.addEventListener('click', () => {
      aplicarFiltroCardUsuarios(card.dataset.usersCard);
    }));

    document.querySelectorAll('[data-users-sort]').forEach(botao => botao.addEventListener('click', () => {
      const campo = botao.dataset.usersSort;
      ordenacaoUsuarios = {
        campo,
        direcao: ordenacaoUsuarios.campo === campo && ordenacaoUsuarios.direcao === 'asc' ? 'desc' : 'asc'
      };
      paginaUsuarios = 1;
      renderizarListaUsuarios();
    }));

    document.getElementById('ordenacao-usuarios')?.addEventListener('change', evento => {
      const [campo, direcao] = evento.target.value.split(':');
      ordenacaoUsuarios = { campo, direcao };
      paginaUsuarios = 1;
      renderizarListaUsuarios();
    });

    document.getElementById('lista-usuarios-container')?.addEventListener('click', evento => {
      const linha = evento.target.closest('[data-user-details]');
      if (linha) window.abrirDetalhesUsuario(linha.dataset.userDetails);
    });

    document.getElementById('lista-usuarios-container')?.addEventListener('keydown', evento => {
      if (!['Enter', ' '].includes(evento.key)) return;
      const linha = evento.target.closest('[data-user-details]');
      if (!linha) return;
      evento.preventDefault();
      window.abrirDetalhesUsuario(linha.dataset.userDetails);
    });

    window.abrirDetalhesUsuario = async function(uid) {
      const usuario = bancoUsuarios.find(item => item.uid === uid);
      if (!usuario || !['admin', 'gestor'].includes(usuarioLogado?.perfil)) return;
      usuarioDetalhadoUid = uid;
      const ativo = usuario.ativo !== false;
      const divisoes = usuario.divisoesAtribuidas || usuario.divisaoAtribuidas || [];
      const rotuloPerfil = { admin: 'Administrador', gestor: 'Gestor', conferente: 'Conferente' };
      const avatar = document.getElementById('detalhes-usuario-avatar');
      avatar.textContent = iniciaisUsuario(usuario.nome);
      document.getElementById('detalhes-usuario-nome').textContent = usuario.nome || 'Sem nome';
      document.getElementById('detalhes-usuario-email').textContent = usuario.email || 'Sem e-mail';
      document.getElementById('detalhes-usuario-perfil').textContent = rotuloPerfil[usuario.perfil] || usuario.perfil;
      document.getElementById('detalhes-usuario-status').innerHTML = `<span class="user-status ${ativo ? 'active' : 'inactive'}">${ativo ? 'Ativo' : 'Inativo'}</span>`;
      document.getElementById('detalhes-usuario-divisoes').textContent = usuario.perfil === 'conferente'
        ? (divisoes.join(', ') || 'Nenhuma divisão atribuída')
        : 'Acesso global';
      document.getElementById('detalhes-usuario-cadastro').textContent = formatarDataUsuario(usuario.criadoEm);
      const acoes = document.getElementById('detalhes-usuario-acoes');
      acoes.innerHTML = usuarioLogado.perfil === 'admin'
        ? (ativo ? `
          <button type="button" data-user-action="editar">Editar dados</button>
          <button type="button" data-user-action="senha">Redefinir senha</button>
          <button type="button" class="danger" data-user-action="acesso">Desativar acesso</button>`
          : `<button type="button" class="success" data-user-action="acesso">Reativar acesso</button>`)
        : '<span class="users-readonly">Visualização disponível; alterações são exclusivas de Administradores.</span>';
      abrirModalHistorico('modal-detalhes-usuario', 'detalhes-usuario');
      const url = await obterFotoUsuarioCache(uid);
      if (url && usuarioDetalhadoUid === uid) {
        avatar.innerHTML = `<img src="${escaparHtml(url)}" alt="Foto de ${escaparHtml(usuario.nome)}">`;
      }
    };

    window.fecharDetalhesUsuario = function() {
      usuarioDetalhadoUid = '';
      return fecharModalHistorico('modal-detalhes-usuario', 'detalhes-usuario');
    };

    document.getElementById('btn-fechar-detalhes-usuario')?.addEventListener('click', () => window.fecharDetalhesUsuario());
    document.getElementById('detalhes-usuario-acoes')?.addEventListener('click', async evento => {
      const acao = evento.target.closest('[data-user-action]')?.dataset.userAction;
      const uid = usuarioDetalhadoUid;
      if (!acao || !uid) return;
      if (acao === 'editar') {
        await window.fecharDetalhesUsuario();
        window.abrirModalEdicao(uid);
      } else if (acao === 'senha') {
        await window.enviarRedefinicaoSenha(uid);
      } else if (acao === 'acesso') {
        await window.alterarAcessoUsuario(uid);
      }
    });

    window.alterarAcessoUsuario = async function(uid) {
      if (usuarioLogado?.perfil !== 'admin') return notificarMensagem('Apenas Administradores podem alterar acessos.', 'erro');
      const alvo = bancoUsuarios.find(u => u.uid === uid);
      if (!alvo) return;
      const reativar = alvo.ativo === false;
      const confirmado = await confirmarAcao({
        titulo: reativar ? 'Reativar acesso' : 'Desativar acesso',
        mensagem: reativar
          ? `${alvo.nome} poderá voltar a entrar no CM APP com a mesma conta.`
          : `${alvo.nome} perderá o acesso, mas seu cadastro e todo o histórico serão preservados.`,
        confirmarTexto: reativar ? 'Reativar acesso' : 'Desativar acesso',
        perigosa: !reativar
      });
      if (!confirmado) return;
      try {
        await alterarEstadoUsuario(uid, reativar);
        notificarMensagem(reativar ? 'Acesso reativado com sucesso.' : 'Acesso desativado e sessões revogadas.', 'sucesso');
        await window.fecharDetalhesUsuario();
        await carregarUsuarios(true);
      } catch (erro) {
        notificarMensagem(erro?.message || 'Não foi possível alterar o acesso.', 'erro');
      }
    };

    window.enviarRedefinicaoSenha = async function(uid) {
      if (usuarioLogado?.perfil !== 'admin') {
        return notificarMensagem('Apenas Administradores podem enviar redefinições de senha.', 'erro');
      }
      const destinatario = bancoUsuarios.find(usuario => usuario.uid === uid);
      if (!destinatario?.email) {
        return notificarMensagem('O usuário selecionado não possui um e-mail válido.', 'aviso');
      }

      const confirmado = await confirmarAcao({
        titulo: 'Enviar redefinição de senha',
        mensagem: `O Firebase enviará as instruções para ${destinatario.email}.`,
        confirmarTexto: 'Enviar e-mail'
      });
      if (!confirmado) return;

      try {
        await sendPasswordResetEmail(auth, destinatario.email);
        notificarMensagem(`E-mail de redefinição enviado para ${destinatario.email}.`, 'sucesso');
      } catch (erro) {
        console.error('Erro ao enviar redefinição de senha:', erro);
        let mensagem = 'Não foi possível enviar o e-mail de redefinição.';
        let tipo = 'erro';
        if (erro?.code === 'auth/too-many-requests') {
          mensagem = 'O limite temporário de envios foi atingido. Aguarde antes de tentar novamente.';
          tipo = 'aviso';
        } else if (erro?.code === 'auth/network-request-failed') {
          mensagem = 'Falha de conexão ao solicitar a redefinição.';
        }
        notificarMensagem(mensagem, tipo);
      }
    }

    window.abrirModalEdicao = function(uid) {
      const user = bancoUsuarios.find(u => u.uid === uid);
      if (!user) return;
      if (usuarioLogado?.perfil !== 'admin') return notificarMensagem('Apenas Administradores podem editar usuários.', 'erro');
      if (user.uid === usuarioLogado.uid) {
        return notificarMensagem('Altere seus próprios dados na tela Meu perfil.', 'aviso');
      }

      document.getElementById('edit-uid').value = user.uid;
      document.getElementById('edit-nome').value = user.nome || '';
      document.getElementById('edit-email').value = user.email || '';
      
      const perfilSelect = document.getElementById('edit-perfil');
      const campoPerfilEdit = document.getElementById('edit-campo-perfil-container');
      const campoDivisoesEdit = document.getElementById('edit-divisoes-container');
      
      campoPerfilEdit.classList.remove('hidden');
      perfilSelect.value = user.perfil || 'conferente';

      const atribuidas = user.divisaoAtribuidas || user.divisoesAtribuidas || [];
      document.querySelectorAll('input[name="edit-divisao-check"]').forEach(cb => {
        cb.checked = atribuidas.includes(cb.value);
      });

      campoDivisoesEdit.classList.toggle('hidden', user.perfil !== 'conferente');

      abrirModalHistorico('modal-edicao-usuario', 'edicao-usuario');
    }

    document.getElementById('edit-perfil')?.addEventListener('change', (evento) => {
      const ehConferente = evento.target.value === 'conferente';
      document.getElementById('edit-divisoes-container').classList.toggle('hidden', !ehConferente);
      if (!ehConferente) {
        document.querySelectorAll('input[name="edit-divisao-check"]').forEach(cb => { cb.checked = false; });
      }
    });

    document.getElementById('btn-fechar-modal').addEventListener('click', () => {
      fecharModalHistorico('modal-edicao-usuario', 'edicao-usuario');
    });

    document.getElementById('form-editar-usuario').addEventListener('submit', async (e) => {
      e.preventDefault();
      const uid = document.getElementById('edit-uid').value;
      const nome = document.getElementById('edit-nome').value.trim();
      const targetUser = bancoUsuarios.find(u => u.uid === uid);

      if (!targetUser) return;
      if (targetUser.uid === usuarioLogado.uid) {
        return notificarMensagem('Altere seus próprios dados na tela Meu perfil.', 'aviso');
      }

      if (usuarioLogado.perfil !== 'admin') return notificarMensagem('Apenas Administradores podem editar usuários.', 'erro');
      const perfilNovo = document.getElementById('edit-perfil').value;

      const checkboxes = document.querySelectorAll('input[name="edit-divisao-check"]:checked');
      const divisoes = perfilNovo === 'conferente' ? Array.from(checkboxes).map(cb => cb.value) : [];

      try {
        await atualizarUsuarioSeguro({ uid, nome, perfil: perfilNovo, divisoesAtribuidas: divisoes });
        notificarMensagem("Dados atualizados com sucesso.", 'sucesso');
        await fecharModalHistorico('modal-edicao-usuario', 'edicao-usuario');
        await carregarUsuarios(true);
      } catch (err) {
        notificarMensagem("Não foi possível salvar as alterações.", 'erro');
      }
    });

    async function preencherEConsultarPlaqueta(codigoLido, origem = 'digitacao') {
      const codLimpo = limparPlaqueta(codigoLido);
      if (!codLimpo) return false;
      document.getElementById('input-plaqueta').value = codLimpo;
      document.getElementById('btn-limpar-plaqueta')?.classList.remove('hidden');
      return buscarEExibirItem(codLimpo, origem);
    }

    const inputPlaqueta = document.getElementById('input-plaqueta');
    const suggestionsBox = document.getElementById('suggestions-box');
    const btnLimparPlaqueta = document.getElementById('btn-limpar-plaqueta');
    const painelPatrimonioNaoEncontrado = document.getElementById('patrimonio-nao-encontrado');
    const formularioAtualizacaoPatrimonio = document.getElementById('patrimonio-atualizacao-form');

    function ocultarPatrimonioNaoEncontrado() {
      painelPatrimonioNaoEncontrado?.classList.add('hidden');
      formularioAtualizacaoPatrimonio?.classList.remove('hidden');
    }

    function exibirPatrimonioNaoEncontrado(plaqueta) {
      document.getElementById('patrimonio-nao-encontrado-codigo').textContent = `Plaqueta ${plaqueta}`;
      painelPatrimonioNaoEncontrado?.classList.remove('hidden');
      formularioAtualizacaoPatrimonio?.classList.add('hidden');
      document.getElementById('select-localizacao').value = '';
      document.getElementById('input-observacao').value = '';
      document.getElementById('alerta-transferencia').classList.add('hidden');
      itemAtualSelecionado = null;
      requestAnimationFrame(() => {
        painelPatrimonioNaoEncontrado?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center'
        });
      });
    }

    function limparFormularioLeitura() {
      metodoLocalizacaoSelecionado = 'digitacao';
      inputPlaqueta.value = '';
      btnLimparPlaqueta?.classList.add('hidden');
      ocultarSugestoesPlaqueta();
      document.getElementById('select-localizacao').value = '';
      document.getElementById('input-observacao').value = '';
      document.getElementById('item-details').classList.add('hidden');
      document.getElementById('alerta-transferencia').classList.add('hidden');
      ocultarPatrimonioNaoEncontrado();
      itemAtualSelecionado = null;
    }

    inputPlaqueta.addEventListener('input', (e) => {
      metodoLocalizacaoSelecionado = 'digitacao';
      const valor = limparPlaqueta(e.target.value);
      ocultarPatrimonioNaoEncontrado();
      if (itemAtualSelecionado && valor !== String(itemAtualSelecionado.plaqueta)) {
        itemAtualSelecionado = null;
        document.getElementById('item-details').classList.add('hidden');
      }
      btnLimparPlaqueta?.classList.toggle('hidden', !e.target.value);
      clearTimeout(timerAutocomplete);
      if (valor.length < 3) {
        suggestionsBox.classList.add('hidden');
        return;
      }

      timerAutocomplete = setTimeout(async () => {
        try {
          let correspondencias = cacheSugestoes.get(valor);
          if (!correspondencias) {
            const consultas = [];
            if (usuarioLogado.perfil === 'conferente') {
              const divisoes = [...new Set(usuarioLogado.divisoesAtribuidas || [])];
              dividirEmLotes(divisoes).forEach(lote => {
                consultas.push(query(
                  collection(db, "patrimonios"),
                  or(
                    where("divisaoOrigem", "in", lote),
                    where("divisao", "in", lote),
                    where("localizacaoAtual", "in", lote),
                    and(where("statusTransferencia", "==", "pendente"), where("divisaoDestinoSugerida", "in", lote))
                  ),
                  orderBy(documentId()),
                  startAt(valor),
                  endAt(`${valor}\uf8ff`),
                  limit(5)
                ));
              });
            } else {
              consultas.push(query(
                collection(db, "patrimonios"),
                orderBy(documentId()),
                startAt(valor),
                endAt(`${valor}\uf8ff`),
                limit(5)
              ));
            }

            const snapshots = await Promise.all(consultas.map(consulta => getDocs(consulta)));
            const resultados = new Map();
            snapshots.forEach(snapshot => snapshot.docs.map(normalizarPatrimonio)
              .forEach(item => resultados.set(item.plaqueta, item)));
            correspondencias = [...resultados.values()]
              .sort((a, b) => String(a.plaqueta).localeCompare(String(b.plaqueta), 'pt-BR', { numeric: true }))
              .slice(0, 5);
            cacheSugestoes.set(valor, correspondencias);
            cachearPatrimonios(correspondencias);
          }

          if (inputPlaqueta.value.replace(/\D/g, '') !== valor) return;
          if (correspondencias.length > 0) {
            suggestionsBox.innerHTML = correspondencias.map(item => `
              <div class="p-2 hover:bg-slate-700 cursor-pointer text-xs border-b border-slate-700/50 flex justify-between" data-plaqueta="${item.plaqueta}">
                <span class="font-bold text-blue-400">${item.plaqueta}</span>
                <span class="text-slate-400 truncate max-w-[180px]">${item.descricao}</span>
              </div>
            `).join('');
            suggestionsBox.classList.remove('hidden');
          } else {
            suggestionsBox.classList.add('hidden');
          }
        } catch (erro) {
          console.error("Falha no autocomplete:", erro);
          suggestionsBox.classList.add('hidden');
        }
      }, 400);
    });

    suggestionsBox.addEventListener('click', (e) => {
      const item = e.target.closest('[data-plaqueta]');
      if (item) {
        ocultarSugestoesPlaqueta();
        preencherEConsultarPlaqueta(item.getAttribute('data-plaqueta'));
      }
    });

    document.getElementById('btn-buscar').addEventListener('click', () => {
      ocultarSugestoesPlaqueta();
      buscarEExibirItem(limparPlaqueta(inputPlaqueta.value), 'digitacao');
    });
    btnLimparPlaqueta?.addEventListener('click', () => {
      limparFormularioLeitura();
      inputPlaqueta.focus();
    });
    document.getElementById('btn-corrigir-plaqueta')?.addEventListener('click', () => {
      ocultarPatrimonioNaoEncontrado();
      inputPlaqueta.focus();
      inputPlaqueta.select();
    });
    inputPlaqueta.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      ocultarSugestoesPlaqueta();
      buscarEExibirItem(limparPlaqueta(inputPlaqueta.value), 'digitacao');
    });

    async function buscarEExibirItem(plaquetaCod, origem = 'digitacao') {
      ocultarSugestoesPlaqueta();
      if (!plaquetaCod) return false;
      metodoLocalizacaoSelecionado = origem === 'codigo' ? 'codigo_barras' : origem === 'ocr' ? 'ocr' : 'digitacao';
      const itemLocal = cachePatrimonios.get(plaquetaCod);
      if (itemLocal) {
        itemAtualSelecionado = itemLocal;
        exibirDetalhes(itemLocal);
        return true;
      }
      else {
        const docSnap = await getDoc(doc(db, "patrimonios", plaquetaCod));
        if (docSnap.exists()) {
          itemAtualSelecionado = normalizarPatrimonio(docSnap);
          cachearPatrimonios([itemAtualSelecionado]);
          adicionarDivisoesAoCatalogo([itemAtualSelecionado]);
          exibirDetalhes(itemAtualSelecionado);
          return true;
        }
        else {
          document.getElementById('item-details').classList.add('hidden');
          exibirPatrimonioNaoEncontrado(plaquetaCod);
          notificarMensagem(`Patrimônio com a plaqueta ${plaquetaCod} não foi encontrado.`, 'aviso');
          metodoLocalizacaoSelecionado = 'digitacao';
          return false;
        }
      }
    }

    function exibirDetalhes(item) {
      ocultarPatrimonioNaoEncontrado();
      document.getElementById('item-details').classList.remove('hidden');
      document.getElementById('det-plaqueta').innerText = `Plaqueta: ${item.plaqueta}`;
      document.getElementById('det-descricao').innerText = item.descricao;
      const divisaoOriginal = item.divisaoOrigem || item.divisao;
      document.getElementById('det-divisao').innerText = divisaoOriginal;

      const badgeStatus = document.getElementById('det-status');
      const btnSalvar = document.getElementById('btn-salvar');
      const sugestaoPendente = item.sugestaoDestinoStatus === 'pendente';
      const pendenteBloqueado = item.statusTransferencia === 'pendente' || sugestaoPendente;
      btnSalvar.disabled = pendenteBloqueado;
      btnSalvar.classList.toggle('opacity-50', pendenteBloqueado);
      btnSalvar.classList.toggle('cursor-not-allowed', pendenteBloqueado);
      btnSalvar.innerText = pendenteBloqueado
        ? (sugestaoPendente ? '⏳ Destino sugerido em análise' : '⏳ Aguardando aprovação')
        : (ehPerfilValidador(usuarioLogado?.perfil) ? '✅ Atualizar Patrimônio' : '✅ Registrar Conferência');
      if (item.statusTransferencia === 'pendente') {
        badgeStatus.innerText = "⏳ AGUARDANDO TRANSF.";
        badgeStatus.className = "px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-900 text-amber-300 border border-amber-500/30";
      } else if (sugestaoPendente) {
        badgeStatus.innerText = "📍 DESTINO SUGERIDO";
        badgeStatus.className = "px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-900 text-amber-300 border border-amber-500/30";
      } else if (item.localizado) {
        badgeStatus.innerText = "🟢 LOCALIZADO";
        badgeStatus.className = "px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-900 text-emerald-300 border border-emerald-500/30";
      } else {
        badgeStatus.innerText = "🔴 PENDENTE";
        badgeStatus.className = "px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-700 text-slate-300";
      }

      const histLista = document.getElementById('det-historico-lista');
      if (item.historico && item.historico.length > 0) {
        histLista.innerHTML = [...item.historico].reverse().map(h => `
          <div class="p-1.5 rounded bg-slate-950/60 border border-slate-800 text-[10px] space-y-0.5">
            <div class="flex justify-between font-bold text-blue-300">
              <span>📍 ${escaparHtml(h.local)}</span>
              <span class="text-slate-400">${escaparHtml(h.data)}</span>
            </div>
            <div class="text-slate-400">Por: ${escaparHtml(h.responsavel || 'Não registrado')}${detalheMetodoHistorico(h)}${h.obs ? ` · Obs: ${escaparHtml(h.obs)}` : ''}</div>
          </div>
        `).join('');
        document.getElementById('det-historico-box').classList.remove('hidden');
      } else { document.getElementById('det-historico-box').classList.add('hidden'); }

      const selectLoc = document.getElementById('select-localizacao');
      selectLoc.value = item.localizacaoAtual || divisaoOriginal;
      verificarAlertaTransferencia(item.localizacaoAtual || divisaoOriginal, selectLoc.value);
      const localEfetivo = item.localizacaoAtual || divisaoOriginal;
      const podeSugerir = usuarioLogado?.perfil === 'conferente'
        && item.localizado !== true
        && item.statusTransferencia !== 'pendente'
        && item.sugestaoDestinoStatus !== 'pendente'
        && (usuarioLogado.divisoesAtribuidas || []).includes(localEfetivo);
      document.getElementById('btn-sugerir-destino')?.classList.toggle('hidden', !podeSugerir);
    }

    function fecharModalSugestaoDestino() {
      return fecharModalHistorico('modal-sugerir-destino', 'sugerir-destino');
    }

    function abrirModalSugestaoDestino() {
      const item = itemAtualSelecionado;
      if (!item || usuarioLogado?.perfil !== 'conferente') return;
      const origem = item.localizacaoAtual || item.divisaoOrigem || item.divisao || '';
      if (item.localizado === true) {
        return notificarMensagem('O item já foi localizado. Utilize o fluxo normal de transferência.', 'aviso');
      }
      if (item.statusTransferencia === 'pendente' || item.sugestaoDestinoStatus === 'pendente') {
        return notificarMensagem('Este patrimônio já possui uma solicitação aguardando aprovação.', 'aviso');
      }
      if (!(usuarioLogado.divisoesAtribuidas || []).includes(origem)) {
        return notificarMensagem('Você só pode sugerir destino para itens de suas divisões atribuídas.', 'erro');
      }
      document.getElementById('sugestao-destino-plaqueta').textContent = `Plaqueta ${item.plaqueta}`;
      document.getElementById('sugestao-destino-descricao').textContent = item.descricao || 'Descrição não informada';
      document.getElementById('sugestao-destino-origem').textContent = origem;
      const seletor = document.getElementById('sugestao-destino-divisao');
      seletor.innerHTML = '<option value="">Selecione a divisão</option>'
        + [...catalogoDivisoes]
          .filter(divisao => divisao && divisao !== origem)
          .sort((a, b) => a.localeCompare(b, 'pt-BR'))
          .map(divisao => `<option value="${escaparHtml(divisao)}">${escaparHtml(divisao)}</option>`)
          .join('');
      document.getElementById('sugestao-destino-observacao').value = '';
      abrirModalHistorico('modal-sugerir-destino', 'sugerir-destino');
    }

    document.getElementById('btn-sugerir-destino')?.addEventListener('click', abrirModalSugestaoDestino);
    document.getElementById('btn-fechar-sugestao-destino')?.addEventListener('click', fecharModalSugestaoDestino);
    document.getElementById('btn-cancelar-sugestao-destino')?.addEventListener('click', fecharModalSugestaoDestino);
    document.getElementById('form-sugerir-destino')?.addEventListener('submit', async evento => {
      evento.preventDefault();
      const item = itemAtualSelecionado;
      if (!item) return;
      const destino = document.getElementById('sugestao-destino-divisao').value;
      const observacao = document.getElementById('sugestao-destino-observacao').value.trim();
      if (!destino) return notificarMensagem('Selecione a divisão de destino sugerida.', 'aviso');
      const confirmado = await confirmarAcao({
        titulo: 'Confirmar sugestão de destino',
        mensagem: `Sugerir ${destino} para o patrimônio ${item.plaqueta}? O item continuará não localizado até uma conferência física.`,
        confirmarTexto: 'Enviar sugestão'
      });
      if (!confirmado) return;
      try {
        const dadosAtualizacao = prepararSugestaoDestino({
          item,
          destino,
          usuario: usuarioLogado,
          observacao,
          dataHora: new Date().toLocaleString('pt-BR')
        });
        await updateDoc(doc(db, 'patrimonios', item.plaqueta), dadosAtualizacao);
        itemAtualSelecionado = { ...item, ...dadosAtualizacao };
        cachePatrimonios.set(item.plaqueta, itemAtualSelecionado);
        const indice = bancoPatrimonio.findIndex(registro => registro.plaqueta === item.plaqueta);
        if (indice >= 0) bancoPatrimonio[indice] = itemAtualSelecionado;
        invalidarCacheRelacao();
        await fecharModalSugestaoDestino();
        exibirDetalhes(itemAtualSelecionado);
        notificarMensagem('Sugestão de destino enviada para aprovação. O item permanece não localizado.', 'sucesso');
      } catch (erro) {
        console.error('Erro ao sugerir destino:', erro);
        notificarMensagem(erro?.code === 'permission-denied'
          ? 'Sugestão não autorizada. Verifique sua divisão, o estado do inventário e as regras publicadas.'
          : (erro?.message || 'Não foi possível enviar a sugestão.'), 'erro');
      }
    });

    document.getElementById('select-localizacao').addEventListener('change', (e) => {
      if (!itemAtualSelecionado) return;
      const localizacaoReferencia = itemAtualSelecionado.localizacaoAtual
        || itemAtualSelecionado.divisaoOrigem
        || itemAtualSelecionado.divisao;
      verificarAlertaTransferencia(localizacaoReferencia, e.target.value);
    });

    function verificarAlertaTransferencia(origem, destino) {
      const alerta = document.getElementById('alerta-transferencia');
      const titulo = document.getElementById('alerta-transferencia-titulo');
      const texto = document.getElementById('alerta-transferencia-texto');
      const houveMudanca = origem && destino && origem !== destino;
      if (!houveMudanca) {
        alerta.classList.add('hidden');
        return;
      }

      alerta.className = 'bg-amber-950/60 border border-amber-500/40 p-2.5 rounded-lg text-[11px] text-amber-200 space-y-1';
      titulo.innerText = '⚠️ ATENÇÃO: Transferência detectada';
      texto.innerHTML = 'Ao salvar, a mudança ficará <strong>aguardando aprovação</strong> na Fila. O local atual será mantido até a decisão.';
    }

    document.getElementById('btn-salvar').addEventListener('click', async () => {
      if (!itemAtualSelecionado) return notificarMensagem("Selecione um patrimônio válido antes de salvar.", 'aviso');
      if (itemAtualSelecionado.statusTransferencia === 'pendente'
        || itemAtualSelecionado.sugestaoDestinoStatus === 'pendente') {
        return notificarMensagem("Este patrimônio já está aguardando aprovação. Conclua a movimentação na Fila antes de registrar outra leitura.", 'aviso');
      }
      const locAtual = document.getElementById('select-localizacao').value;
      if (!locAtual) return notificarMensagem("Selecione a localização atual do item.", 'aviso');

      const obs = document.getElementById('input-observacao').value.trim();
      const dataHora = new Date().toLocaleString('pt-BR');
      const btnSalvar = document.getElementById('btn-salvar');
      btnSalvar.disabled = true;
      try {
        const {
          dadosAtualizacao,
          houveMudanca: ehTransferencia,
          perfilValidador
        } = prepararAtualizacaoPatrimonio({
          item: itemAtualSelecionado,
          localizacaoDestino: locAtual,
          usuario: usuarioLogado,
          observacao: obs,
          metodoLocalizacao: metodoLocalizacaoSelecionado,
          dataHora
        });

        const docRef = doc(db, "patrimonios", itemAtualSelecionado.plaqueta);
        await updateDoc(docRef, dadosAtualizacao);
        const itemAtualizado = { ...itemAtualSelecionado, ...dadosAtualizacao };
        cachePatrimonios.set(itemAtualizado.plaqueta, itemAtualizado);
        const indiceRelacao = bancoPatrimonio.findIndex(item => item.plaqueta === itemAtualizado.plaqueta);
        if (indiceRelacao >= 0) bancoPatrimonio[indiceRelacao] = itemAtualizado;
        invalidarCacheRelacao();
        const mensagemSucesso = ehTransferencia
          ? "⚠️ Mudança de localização enviada para aprovação."
          : (perfilValidador ? "✅ Patrimônio atualizado com sucesso." : "✅ Conferência registrada com sucesso.");
        notificarMensagem(mensagemSucesso, ehTransferencia ? 'aviso' : 'sucesso');
        limparFormularioLeitura();
        try {
          await controladorCamera.retomarAposSalvar();
        } catch (erroCamera) {
          console.warn('Leitura salva, mas a câmera não pôde ser retomada:', erroCamera);
          notificarMensagem('Leitura salva. Ligue a câmera novamente para continuar.', 'info');
        }
      } catch (erro) {
        console.error('Erro ao registrar leitura:', erro);
        if (erro?.code === 'permission-denied') {
          try {
            const atual = await getDocFromServer(doc(db, 'patrimonios', itemAtualSelecionado.plaqueta));
            if (atual.exists()) {
              itemAtualSelecionado = normalizarPatrimonio(atual);
              cachearPatrimonios([itemAtualSelecionado]);
              exibirDetalhes(itemAtualSelecionado);
            }
          } catch (erroConsulta) {
            console.error('Erro ao consultar o patrimônio após a falha:', erroConsulta);
          }
        }
        notificarMensagem(erro?.code === 'permission-denied'
          ? 'Leitura não autorizada. Verifique se a divisão de origem ou destino está encerrada, se há transferência pendente e se as regras atualizadas foram publicadas.'
          : (erro?.message || 'Não foi possível registrar a leitura.'), 'erro');
      } finally {
        if (itemAtualSelecionado?.statusTransferencia !== 'pendente'
          && itemAtualSelecionado?.sugestaoDestinoStatus !== 'pendente') btnSalvar.disabled = false;
      }
    });

    function encerrarOuvinteTransferencias() {
      unsubscribeTransferencias.forEach(cancelar => cancelar());
      unsubscribeTransferencias = [];
      filaTransferenciasFisicas = [];
      filaSugestoesDestino = [];
    }

    function consolidarFilaAprovacao() {
      bancoTransferencias = [
        ...filaTransferenciasFisicas.map(item => ({ ...item, tipoSolicitacaoFila: 'transferencia' })),
        ...filaSugestoesDestino.map(item => ({ ...item, tipoSolicitacaoFila: 'sugestao_destino' }))
      ];
      cachearPatrimonios(bancoTransferencias);
      renderizarFilaTransferencias();
      aplicarBadgeTransferencias(bancoTransferencias.length);
    }

    function iniciarOuvinteTransferencias() {
      encerrarOuvinteTransferencias();
      const tratarErro = erro => {
        console.error("Erro no listener de transferências:", erro);
        document.getElementById('container-transferencias').innerHTML = `<div class="bg-red-950/40 p-4 rounded-xl border border-red-500/30 text-center text-xs text-red-300 md:col-span-2">Não foi possível acompanhar a fila em tempo real.</div>`;
      };
      const consultaTransferencias = query(collection(db, "patrimonios"), where("statusTransferencia", "==", "pendente"));
      const consultaSugestoes = query(collection(db, "patrimonios"), where("sugestaoDestinoStatus", "==", "pendente"));
      unsubscribeTransferencias.push(
        onSnapshot(consultaTransferencias, snapshot => {
          filaTransferenciasFisicas = snapshot.docs.map(normalizarPatrimonio);
          consolidarFilaAprovacao();
        }, tratarErro),
        onSnapshot(consultaSugestoes, snapshot => {
          filaSugestoesDestino = snapshot.docs.map(normalizarPatrimonio);
          consolidarFilaAprovacao();
        }, tratarErro)
      );
    }

    function aplicarBadgeTransferencias(quantidade) {
      const badgeFila = document.getElementById('badge-fila-count');
      if (quantidade > 0 && usuarioLogado?.perfil !== 'conferente') {
        badgeFila.innerText = quantidade;
        badgeFila.classList.remove('hidden');
      } else {
        badgeFila.classList.add('hidden');
      }
    }

    function renderizarFilaTransferencias() {
      const container = document.getElementById('container-transferencias');
      const contador = document.getElementById('transf-contador');
      if (!container) return;

      const pendentes = bancoTransferencias;
      contador.innerText = `${pendentes.length} ${pendentes.length === 1 ? 'pendente' : 'pendentes'}`;

      if (pendentes.length === 0) {
        container.innerHTML = `<div class="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center text-xs text-slate-400 md:col-span-2">✨ Nenhuma movimentação pendente no momento.</div>`;
        return;
      }

      const grupos = pendentes.reduce((acumulador, item) => {
        const divisao = item.tipoSolicitacaoFila === 'sugestao_destino'
          ? item.sugestaoDestinoDivisao
          : item.divisaoDestinoSugerida;
        const grupo = divisao || 'Divisão não informada';
        if (!acumulador.has(grupo)) acumulador.set(grupo, []);
        acumulador.get(grupo).push(item);
        return acumulador;
      }, new Map());

      container.innerHTML = [...grupos.entries()]
        .sort(([divisaoA], [divisaoB]) => divisaoA.localeCompare(divisaoB, 'pt-BR'))
        .map(([divisao, itens], indice) => `
          <details class="transfer-group" ${indice === 0 ? 'open' : ''}>
            <summary class="transfer-group-summary">
              <span>
                <strong>${divisao}</strong>
                <small>${itens.length} ${itens.length === 1 ? 'item' : 'itens'}</small>
              </span>
              <span class="transfer-group-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div class="transfer-grid">
              ${itens
                .sort((itemA, itemB) => String(itemA.plaqueta).localeCompare(String(itemB.plaqueta), 'pt-BR', { numeric: true }))
                .map(item => `
                  <article class="transfer-card">
                    <span class="transfer-type ${item.tipoSolicitacaoFila === 'sugestao_destino' ? 'suggestion' : 'physical'}">
                      ${item.tipoSolicitacaoFila === 'sugestao_destino' ? 'Sugestão de destino' : 'Transferência após leitura'}
                    </span>
                    <button type="button" class="transfer-card-link" onclick="abrirModalItemPorPlaqueta('${item.plaqueta}')">
                      <span>Plaqueta ${item.plaqueta}</span>
                      <span class="transfer-status">Aguardando</span>
                    </button>
                    <p class="transfer-description">${item.descricao || 'Descrição não informada'}</p>
                    <dl class="transfer-route">
                      <div>
                        <dt>Origem</dt>
                        <dd>${item.localizacaoAtual || item.divisaoOrigem || item.divisao || 'Não informada'}</dd>
                      </div>
                      <div>
                        <dt>Destino</dt>
                        <dd>${item.tipoSolicitacaoFila === 'sugestao_destino' ? item.sugestaoDestinoDivisao : item.divisaoDestinoSugerida || 'Não informado'}</dd>
                      </div>
                    </dl>
                    <div class="transfer-note">
                      <strong>💬 ${item.tipoSolicitacaoFila === 'sugestao_destino' ? 'Informação da sugestão' : 'Observação da conferência'}</strong>
                      <p>${escaparHtml(item.tipoSolicitacaoFila === 'sugestao_destino'
                        ? `Destino sugerido por: ${item.sugestaoDestinoPor?.nome || 'Não informado'}${item.sugestaoDestinoObservacao ? ` — ${item.sugestaoDestinoObservacao}` : ''}`
                        : (item.observacaoAtual || 'Nenhuma observação informada.'))}</p>
                    </div>
                    <div class="transfer-actions">
                      <button type="button" onclick="${item.tipoSolicitacaoFila === 'sugestao_destino' ? 'aprovarSugestaoDestino' : 'aprovarTransferencia'}('${item.plaqueta}')" class="transfer-approve">Aprovar</button>
                      <button type="button" onclick="${item.tipoSolicitacaoFila === 'sugestao_destino' ? 'rejeitarSugestaoDestino' : 'rejeitarTransferencia'}('${item.plaqueta}')" class="transfer-reject">Rejeitar</button>
                    </div>
                  </article>
                `).join('')}
            </div>
          </details>
        `).join('');
    }

    async function obterTransferenciaPendente(plaqueta) {
      const snapshot = await getDocFromServer(doc(db, "patrimonios", plaqueta));
      if (!snapshot.exists()) throw new Error("Patrimônio não encontrado.");
      return normalizarPatrimonio(snapshot);
    }

    function atualizarCachesAposResolucao(itemAtualizado) {
      cachePatrimonios.set(itemAtualizado.plaqueta, itemAtualizado);
      const indiceRelacao = bancoPatrimonio.findIndex(item => item.plaqueta === itemAtualizado.plaqueta);
      if (indiceRelacao >= 0) bancoPatrimonio[indiceRelacao] = itemAtualizado;
      bancoTransferencias = bancoTransferencias.filter(item => item.plaqueta !== itemAtualizado.plaqueta);
      renderizarFilaTransferencias();
      aplicarBadgeTransferencias(bancoTransferencias.length);
      invalidarCacheRelacao();
    }

    async function resolverTransferencia(plaqueta, decisao) {
      if (usuarioLogado.perfil === 'conferente') return notificarMensagem("Acesso negado para esta operação.", 'erro');
      try {
        const item = await obterTransferenciaPendente(plaqueta);
        const destino = item.divisaoDestinoSugerida || 'destino não informado';
        const verbo = decisao === 'aprovar' ? 'aprovar' : 'rejeitar';
        const confirmado = await confirmarAcao({
          titulo: `${decisao === 'aprovar' ? 'Aprovar' : 'Rejeitar'} transferência`,
          mensagem: `Deseja ${verbo} a transferência do patrimônio ${plaqueta} para ${destino}?`,
          confirmarTexto: decisao === 'aprovar' ? 'Aprovar' : 'Rejeitar',
          perigosa: decisao !== 'aprovar'
        });
        if (!confirmado) return;

        const { dadosAtualizacao } = prepararResolucaoTransferencia({
          item,
          usuario: usuarioLogado,
          decisao,
          dataHora: new Date().toLocaleString('pt-BR')
        });
        await updateDoc(doc(db, "patrimonios", plaqueta), dadosAtualizacao);
        atualizarCachesAposResolucao({ ...item, ...dadosAtualizacao });
        notificarMensagem(decisao === 'aprovar' ? "Transferência aprovada com sucesso." : "Transferência rejeitada; localização anterior mantida.", 'sucesso');
      } catch (erro) {
        console.error("Erro ao resolver transferência:", erro);
        notificarMensagem(erro?.code === 'permission-denied'
          ? 'A divisão de origem ou destino está bloqueada, ou as regras atualizadas ainda não foram publicadas.'
          : (erro.message || "Não foi possível resolver a transferência."), 'erro');
      }
    }

    window.aprovarTransferencia = plaqueta => resolverTransferencia(plaqueta, 'aprovar');
    window.rejeitarTransferencia = plaqueta => resolverTransferencia(plaqueta, 'rejeitar');

    async function resolverSugestaoDestino(plaqueta, decisao) {
      if (usuarioLogado.perfil === 'conferente') return notificarMensagem('Acesso negado para esta operação.', 'erro');
      try {
        const item = await obterTransferenciaPendente(plaqueta);
        const destino = item.sugestaoDestinoDivisao || 'destino não informado';
        const aprovando = decisao === 'aprovar';
        const confirmado = await confirmarAcao({
          titulo: `${aprovando ? 'Aprovar' : 'Rejeitar'} sugestão de destino`,
          mensagem: aprovando
            ? `Vincular o patrimônio ${plaqueta} a ${destino}? Ele continuará pendente até ser fisicamente conferido nessa divisão.`
            : `Rejeitar a sugestão de ${destino} para o patrimônio ${plaqueta}? A localização anterior será mantida.`,
          confirmarTexto: aprovando ? 'Aprovar sugestão' : 'Rejeitar sugestão',
          perigosa: !aprovando
        });
        if (!confirmado) return;
        const dadosAtualizacao = prepararResolucaoSugestaoDestino({
          item,
          usuario: usuarioLogado,
          decisao,
          dataHora: new Date().toLocaleString('pt-BR')
        });
        await updateDoc(doc(db, 'patrimonios', plaqueta), dadosAtualizacao);
        atualizarCachesAposResolucao({ ...item, ...dadosAtualizacao });
        notificarMensagem(aprovando
          ? `Destino atualizado para ${destino}. O item permanece pendente de conferência física.`
          : 'Sugestão rejeitada; localização anterior mantida.', 'sucesso');
      } catch (erro) {
        console.error('Erro ao resolver sugestão de destino:', erro);
        notificarMensagem(erro?.code === 'permission-denied'
          ? 'A sugestão não pôde ser analisada. Verifique o estado das divisões e as regras publicadas.'
          : (erro.message || 'Não foi possível analisar a sugestão.'), 'erro');
      }
    }

    window.aprovarSugestaoDestino = plaqueta => resolverSugestaoDestino(plaqueta, 'aprovar');
    window.rejeitarSugestaoDestino = plaqueta => resolverSugestaoDestino(plaqueta, 'rejeitar');

    window.abrirModalItemPorPlaqueta = async function(plaqueta) {
      let item = bancoPatrimonio.find(patrimonio => patrimonio.plaqueta === plaqueta)
        || cachePatrimonios.get(plaqueta);
      if (!item) {
        const snapshot = await getDoc(doc(db, "patrimonios", plaqueta));
        if (!snapshot.exists()) return;
        item = normalizarPatrimonio(snapshot);
        cachearPatrimonios([item]);
      }

      const conteudo = document.getElementById('modal-item-conteudo');
      const divisaoAnterior = item.divisaoOrigem || item.divisao;
      const localAtual = item.localizacaoAtual || divisaoAnterior;
      const sugestaoPendente = item.statusTransferencia === 'pendente'
        ? item.divisaoDestinoSugerida
        : '';
      const ehAdminOuGestor = usuarioLogado && usuarioLogado.perfil !== 'conferente';
      const statusModal = item.statusTransferencia === 'pendente'
        ? { classe: 'bg-amber-900 text-amber-300', texto: '⏳ AGUARDANDO TRANSF.' }
        : item.statusTransferencia === 'rejeitado'
          ? { classe: 'bg-red-950 text-red-300', texto: '↩️ TRANSF. NEGADA' }
          : item.localizado
            ? { classe: 'bg-emerald-900 text-emerald-300', texto: '🟢 LOCALIZADO' }
            : { classe: 'bg-slate-700 text-slate-300', texto: '🔴 PENDENTE' };

      conteudo.innerHTML = `
        <div class="space-y-2.5">
          <div class="flex justify-between items-center">
            <span class="font-bold text-blue-400 text-sm">Plaqueta: ${item.plaqueta}</span>
            <span class="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${statusModal.classe}">
              ${statusModal.texto}
            </span>
          </div>
          <div><strong class="text-slate-400">Descrição:</strong> <span class="text-slate-200">${item.descricao}</span></div>
          <div><strong class="text-slate-400">🏷️ Divisão Anterior:</strong> <span class="text-amber-400 font-semibold">${divisaoAnterior}</span></div>
          <div><strong class="text-slate-400">📍 Local Atual:</strong> <span class="text-emerald-400 font-semibold">${localAtual}</span></div>
          ${sugestaoPendente ? `<div><strong class="text-slate-400">➡️ Local Sugerido:</strong> <span class="text-amber-300 font-semibold">${sugestaoPendente}</span></div>` : ''}
          ${item.conferidoPor ? `<div><strong class="text-slate-400">👤 Conferido por:</strong> <span class="text-slate-300">${item.conferidoPor}</span></div>` : ''}
          ${item.observacaoAtual ? `<div><strong class="text-slate-400">💬 Observação:</strong> <span class="text-slate-300">${item.observacaoAtual}</span></div>` : ''}
          
          ${ehAdminOuGestor && item.localizado ? `
            <div class="pt-2 border-t border-slate-700">
              <button onclick="reverterItemIndividual('${item.plaqueta}')" class="w-full bg-amber-950/60 hover:bg-amber-900 text-amber-300 font-bold py-2 rounded text-xs border border-amber-500/30 transition-colors">
                🔄 Retornar Item para Status Pendente
              </button>
            </div>
          ` : ''}

          <div class="pt-2 border-t border-slate-700 space-y-1.5">
            <strong class="text-blue-400 block">📜 Linha do Tempo (Histórico de Movimentações):</strong>
            <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              ${item.historico && item.historico.length > 0 ? [...item.historico].reverse().map(h => `
                <div class="p-2 rounded bg-slate-950/60 border border-slate-800 space-y-0.5">
                  <div class="flex justify-between font-bold text-blue-300">
                    <span>📍 ${escaparHtml(h.local)}</span>
                    <span class="text-slate-400 text-[10px]">${escaparHtml(h.data)}</span>
                  </div>
                  ${h.acao ? `<div class="text-[10px] text-slate-500">Ação: ${escaparHtml(h.acao.replaceAll('_', ' '))}</div>` : ''}
                  <div class="text-slate-400 text-[10px]">Por: ${escaparHtml(h.responsavel || 'Não registrado')}${detalheMetodoHistorico(h)}${h.obs ? ` · Obs: ${escaparHtml(h.obs)}` : ''}</div>
                </div>
              `).join('') : '<div class="text-slate-400 text-xs italic">Nenhum registro histórico adicional.</div>'}
            </div>
          </div>
        </div>
      `;
      abrirModalHistorico('modal-detalhes-item', 'detalhes-item');
    }

    document.getElementById('btn-fechar-modal-item').addEventListener('click', () => {
      fecharModalHistorico('modal-detalhes-item', 'detalhes-item');
    });

    function criarConsultaRelacao(cursor = null, paraContagem = false, { divisoesLote = null, tamanhoPagina = TAMANHO_PAGINA_RELACAO, consultaDaFonte = false } = {}) {
      const patrimoniosRef = collection(db, "patrimonios");
      const termo = limparPlaqueta(document.getElementById('filtro-busca').value);
      const statusFiltro = document.getElementById('filtro-status').value;
      const divisaoFiltro = escopoVisualizacao;
      const filtros = [];
      let relacaoFragmentada = false;
      let divisoesDoConferente = [];

      if (termo.length > 0 && termo.length < 3) return { invalida: true };

      if (divisaoFiltro !== 'todas') {
        if (usuarioLogado.perfil === 'conferente' && !usuarioTemAcessoDivisao(divisaoFiltro)) {
          throw new Error("Divisão fora da alçada do usuário.");
        }
        if (!paraContagem && !consultaDaFonte) return { multiconsulta: true, grupos: [null] };
        filtros.push(or(
          where("divisaoOrigem", "==", divisaoFiltro),
          where("divisao", "==", divisaoFiltro),
          where("localizacaoAtual", "==", divisaoFiltro),
          and(where("statusTransferencia", "==", "pendente"), where("divisaoDestinoSugerida", "==", divisaoFiltro))
        ));
      } else if (usuarioLogado.perfil === 'conferente') {
        const divisoes = divisoesLote || [...new Set(usuarioLogado.divisoesAtribuidas || [])];
        if (divisoes.length === 0) return { vazia: true };
        if (!paraContagem && !consultaDaFonte) {
          return { multiconsulta: true, grupos: dividirEmLotes(divisoes) };
        }
        relacaoFragmentada = divisoes.length > 7;
        divisoesDoConferente = divisoes;
        const origensEAtuais = [
          where("divisaoOrigem", "in", divisoes),
          where("divisao", "in", divisoes),
          where("localizacaoAtual", "in", divisoes)
        ];
        if (!relacaoFragmentada) {
          origensEAtuais.push(and(
            where("statusTransferencia", "==", "pendente"),
            where("divisaoDestinoSugerida", "in", divisoes)
          ));
        }
        filtros.push(or(...origensEAtuais));
      }

      if (statusFiltro === 'localizados') filtros.push(where("localizado", "==", true));
      if (statusFiltro === 'pendentes') filtros.push(where("localizado", "==", false));
      if (statusFiltro === 'aguardando') filtros.push(where("statusTransferencia", "==", "pendente"));

      const restricoes = [];
      if (filtros.length === 1) restricoes.push(filtros[0]);
      if (filtros.length > 1) restricoes.push(and(...filtros));
      restricoes.push(orderBy(documentId()));

      if (cursor) restricoes.push(startAfter(cursor));
      else if (termo) restricoes.push(startAt(termo));
      if (termo) restricoes.push(endAt(`${termo}\uf8ff`));
      if (!paraContagem) restricoes.push(limit(tamanhoPagina));

      return { consulta: query(patrimoniosRef, ...restricoes), termo, relacaoFragmentada, divisoesDoConferente };
    }

    function obterFiltrosRelacao() {
      return {
        termo: limparPlaqueta(document.getElementById('filtro-busca').value),
        status: document.getElementById('filtro-status').value,
        divisao: escopoVisualizacao
      };
    }

    function consultaBaseRelacaoAtiva() {
      const filtros = obterFiltrosRelacao();
      return !filtros.termo && filtros.status === 'todos' && filtros.divisao === 'todas';
    }

    function itemCorrespondeAosFiltros(item, filtros) {
      const divisoesItem = divisoesVisiveisPatrimonio(item);
      const correspondeTermo = !filtros.termo || String(item.plaqueta).startsWith(filtros.termo);
      const correspondeStatus = correspondeSituacaoPatrimonio(item, filtros.status);
      const correspondeDivisao = filtros.divisao === 'todas' || divisoesItem.includes(filtros.divisao);
      return correspondeTermo && correspondeStatus && correspondeDivisao;
    }

    function aplicarFiltrosNaBaseCompleta() {
      if (!relacaoBaseCompleta) return false;
      const filtros = obterFiltrosRelacao();
      bancoPatrimonio = relacaoBaseCompleta.filter(item => itemCorrespondeAosFiltros(item, filtros));
      itensFiltradosCache = [...bancoPatrimonio];
      cursorRelacao = null;
      totalRelacao = bancoPatrimonio.length;
      relacaoTemMais = false;
      relacaoCarregada = true;
      relacaoUsandoBaseCompleta = true;
      renderizarRelaçãoBD();
      return true;
    }

    function atualizarPaginacaoRelacao() {
      const info = document.getElementById('relacao-paginacao-info');
      const botao = document.getElementById('btn-carregar-mais');
      if (info) {
        info.innerText = relacaoUsandoBaseCompleta
          ? `Filtro local: ${bancoPatrimonio.length} item(ns) • base completa com ${relacaoBaseCompleta.length}`
          : lotesRelacao
            ? `${bancoPatrimonio.length} item(ns) carregado(s)${relacaoTemMais ? ' • mais disponíveis' : ' • consulta concluída'}`
          : ['localizados', 'pendentes'].includes(document.getElementById('filtro-status').value)
            ? `${itensFiltradosCache.length} exibido(s) • ${bancoPatrimonio.length} de ${totalRelacao} consultado(s)`
            : `${bancoPatrimonio.length} de ${totalRelacao} item(ns) carregado(s)`;
      }
      if (botao) {
        botao.classList.toggle('hidden', !relacaoTemMais);
        botao.disabled = relacaoCarregando;
        botao.innerText = relacaoCarregando ? 'Carregando…' : `Carregar mais ${TAMANHO_PAGINA_RELACAO}`;
      }
    }

    async function carregarRelacaoPatrimonial({ reiniciar = false, carregarMais = false, forcarServidor = false } = {}) {
      if (relacaoCarregando) return;
      const escopoDaConsulta = escopoVisualizacao;
      const revisaoDaConsulta = revisaoEscopo;
      if (!escopoDaConsulta) {
        document.getElementById('container-accordions').innerHTML = '<div class="app-card">Escolha uma divisão em foco para consultar a Relação.</div>';
        document.getElementById('relacao-paginacao-info').textContent = 'Aguardando escolha de divisão';
        document.getElementById('btn-carregar-mais').classList.add('hidden');
        return;
      }
      if (reiniciar && !forcarServidor && aplicarFiltrosNaBaseCompleta()) return;
      if (relacaoCarregada && !reiniciar && !carregarMais) {
        renderizarRelaçãoBD();
        return;
      }
      if (carregarMais && !relacaoTemMais) return;

      const container = document.getElementById('container-accordions');
      if (reiniciar || !relacaoCarregada) {
        relacaoUsandoBaseCompleta = false;
        lotesRelacao = null;
        bancoPatrimonio = [];
        itensFiltradosCache = [];
        cursorRelacao = null;
        totalRelacao = 0;
        relacaoTemMais = true;
        container.innerHTML = `<div class="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center text-xs text-slate-400">Carregando primeira página…</div>`;
      }

      const configuracao = criarConsultaRelacao(carregarMais ? cursorRelacao : null, false);
      if (configuracao.invalida) {
        container.innerHTML = `<div class="bg-slate-800 p-5 rounded-xl border border-slate-700 text-center text-xs text-slate-400">Digite ao menos três números para pesquisar uma plaqueta.</div>`;
        totalRelacao = 0;
        relacaoTemMais = false;
        atualizarPaginacaoRelacao();
        return;
      }
      if (configuracao.vazia) {
        bancoPatrimonio = [];
        totalRelacao = 0;
        relacaoTemMais = false;
        relacaoCarregada = true;
        renderizarRelaçãoBD();
        return;
      }
      if (configuracao.multiconsulta) {
        relacaoCarregando = true;
        try {
          if (!lotesRelacao) {
            lotesRelacao = configuracao.grupos.map(divisoes => ({ divisoes, cursor: null, buffer: [], esgotada: false }));
          }
          const tamanhoLote = Math.ceil(TAMANHO_PAGINA_RELACAO / lotesRelacao.length);
          const { pagina, temMais } = await carregarPaginaIntercalada({
            fontes: lotesRelacao,
            tamanhoPagina: TAMANHO_PAGINA_RELACAO,
            carregarLote: async fonte => {
              if (revisaoDaConsulta !== revisaoEscopo) throw new Error('Escopo alterado durante a consulta.');
              const consulta = criarConsultaRelacao(fonte.cursor, false,
                { divisoesLote: fonte.divisoes, tamanhoPagina: tamanhoLote, consultaDaFonte: true });
              const snapshot = await getDocs(consulta.consulta);
              return {
                itens: snapshot.docs,
                cursor: snapshot.docs.at(-1) || fonte.cursor,
                esgotada: snapshot.size < tamanhoLote
              };
            },
            incluirItem: docSnap => {
              const item = normalizarPatrimonio(docSnap);
              return itemCorrespondeAosFiltros(item, obterFiltrosRelacao())
                && (usuarioLogado.perfil !== 'conferente'
                  || patrimonioVisivelParaDivisoes(item, usuarioLogado.divisoesAtribuidas || []));
            }
          });
          if (revisaoDaConsulta !== revisaoEscopo) return;
          const novosItens = pagina.map(normalizarPatrimonio);
          bancoPatrimonio.push(...novosItens);
          cachearPatrimonios(novosItens);
          adicionarDivisoesAoCatalogo(novosItens);
          relacaoTemMais = temMais;
          relacaoCarregada = true;
          if (!temMais && consultaBaseRelacaoAtiva()) {
            relacaoBaseCompleta = [...bancoPatrimonio];
            relacaoUsandoBaseCompleta = true;
          }
          renderizarRelaçãoBD();
        } catch (erro) {
          if (revisaoDaConsulta !== revisaoEscopo) return;
          console.error('Erro na consulta paginada por divisões:', erro);
          lotesRelacao = null;
          relacaoTemMais = false;
          relacaoCarregada = false;
          container.innerHTML = `<div class="bg-red-950/40 p-5 rounded-xl border border-red-500/30 text-center text-xs text-red-300">Não foi possível carregar esta página. Verifique as regras e os índices do Firestore.</div>`;
        } finally {
          relacaoCarregando = false;
          if (revisaoDaConsulta !== revisaoEscopo && abaAtual === 'lista') {
            void carregarRelacaoPatrimonial({ reiniciar: true });
          } else atualizarPaginacaoRelacao();
        }
        return;
      }

      relacaoCarregando = true;
      atualizarPaginacaoRelacao();
      try {
        if (reiniciar || !relacaoCarregada) {
          const configuracaoContagem = criarConsultaRelacao(null, true);
          const contagemSnap = await getCountFromServer(configuracaoContagem.consulta);
          if (revisaoDaConsulta !== revisaoEscopo) return;
          totalRelacao = contagemSnap.data().count;
          if (configuracao.relacaoFragmentada && ['todos', 'aguardando'].includes(document.getElementById('filtro-status').value)) {
            const divisoes = configuracao.divisoesDoConferente;
            const pendenciasDestino = await getDocs(query(collection(db, 'patrimonios'),
              where('statusTransferencia', '==', 'pendente'),
              where('divisaoDestinoSugerida', 'in', divisoes)
            ));
            if (revisaoDaConsulta !== revisaoEscopo) return;
            const filtros = obterFiltrosRelacao();
            const extras = pendenciasDestino.docs.map(normalizarPatrimonio).filter(item =>
              ![item.divisaoOrigem, item.divisao, item.localizacaoAtual].some(divisao => divisoes.includes(divisao))
                && itemCorrespondeAosFiltros(item, filtros)
            );
            bancoPatrimonio = extras;
            totalRelacao += extras.length;
            cachearPatrimonios(extras);
          }
        }

        const snapshot = await getDocs(configuracao.consulta);
        if (revisaoDaConsulta !== revisaoEscopo) return;
        const novosItens = snapshot.docs.map(normalizarPatrimonio);
        const porPlaqueta = new Map(bancoPatrimonio.map(item => [item.plaqueta, item]));
        novosItens.forEach(item => porPlaqueta.set(item.plaqueta, item));
        bancoPatrimonio = [...porPlaqueta.values()];
        cachearPatrimonios(novosItens);
        adicionarDivisoesAoCatalogo(novosItens);

        cursorRelacao = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : cursorRelacao;
        relacaoTemMais = snapshot.size === TAMANHO_PAGINA_RELACAO && bancoPatrimonio.length < totalRelacao;
        relacaoCarregada = true;
        if (!relacaoTemMais && consultaBaseRelacaoAtiva()) {
          relacaoBaseCompleta = [...bancoPatrimonio];
          relacaoUsandoBaseCompleta = true;
        }
        renderizarRelaçãoBD();
      } catch (erro) {
        if (revisaoDaConsulta !== revisaoEscopo) return;
        console.error("Erro na consulta paginada da Relação:", erro);
        relacaoTemMais = false;
        container.innerHTML = `<div class="bg-red-950/40 p-5 rounded-xl border border-red-500/30 text-center text-xs text-red-300">Não foi possível carregar a consulta. Verifique as regras e os índices do Firestore.</div>`;
      } finally {
        relacaoCarregando = false;
        if (revisaoDaConsulta !== revisaoEscopo && abaAtual === 'lista') {
          void carregarRelacaoPatrimonial({ reiniciar: true });
        } else atualizarPaginacaoRelacao();
      }
    }

    function renderizarRelaçãoBD() {
      const container = document.getElementById('container-accordions');
      if (!container || !usuarioLogado) return;

      const termo = limparPlaqueta(document.getElementById('filtro-busca').value);
      const statusFiltro = document.getElementById('filtro-status').value;
      const divisaoFiltro = escopoVisualizacao;
      const minhasDivs = usuarioLogado.divisoesAtribuidas || [];

      const itensPermitidos = bancoPatrimonio.filter(i => {
        if (usuarioLogado.perfil === 'conferente' && !patrimonioVisivelParaDivisoes(i, minhasDivs)) return false;
        return true;
      });

      const gruposTotal = {};
      itensPermitidos.forEach(i => {
        const divAtual = divisaoFiltro !== 'todas'
          ? divisaoFiltro : (i.localizacaoAtual || i.divisaoOrigem || i.divisao);
        if (!gruposTotal[divAtual]) gruposTotal[divAtual] = [];
        gruposTotal[divAtual].push(i);
      });

      const itensFiltrados = itensPermitidos.filter(i => {
        const matchTermo = !termo || i.plaqueta.startsWith(termo);
        const matchStatus = correspondeSituacaoPatrimonio(i, statusFiltro);
        const matchDivisao = divisaoFiltro === 'todas'
          || divisoesVisiveisPatrimonio(i).includes(divisaoFiltro);
        return matchTermo && matchStatus && matchDivisao;
      });

      itensFiltradosCache = itensFiltrados;

      const gruposFiltrados = {};
      itensFiltrados.forEach(i => {
        const divAtual = divisaoFiltro !== 'todas'
          ? divisaoFiltro : (i.localizacaoAtual || i.divisaoOrigem || i.divisao);
        if (!gruposFiltrados[divAtual]) gruposFiltrados[divAtual] = [];
        gruposFiltrados[divAtual].push(i);
      });

      container.innerHTML = '';
      
      Object.keys(gruposTotal).sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach((divNome, idx) => {
        const todosDaDiv = gruposTotal[divNome];
        const visiveisDaDiv = gruposFiltrados[divNome] || [];
        
        if (visiveisDaDiv.length === 0 && (termo || statusFiltro !== 'todos' || divisaoFiltro !== 'todas')) return;

        const locCount = todosDaDiv.filter(i => situacaoPatrimonio(i) === 'localizados').length;
        const totalCount = todosDaDiv.length;

        const accordion = document.createElement('div');
        accordion.className = "bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-md";
        accordion.innerHTML = `
          <button onclick="document.getElementById('acc-${idx}').classList.toggle('collapsed')" class="w-full flex justify-between items-center p-3.5 text-left font-bold text-xs md:text-sm bg-slate-800 border-b border-slate-700/50 hover:bg-slate-750 transition-colors">
            <span class="text-blue-400 font-semibold">📁 ${divNome} (${totalCount} carregados)</span>
            <span class="text-xs ${locCount === totalCount ? 'text-emerald-400' : 'text-amber-400'}">${locCount}/${totalCount} nesta página</span>
          </button>
          <div id="acc-${idx}" class="accordion-content p-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/50">
            ${visiveisDaDiv.map(item => `
              <div onclick="abrirModalItemPorPlaqueta('${item.plaqueta}')" class="patrimonio-card patrimonio-card--${situacaoPatrimonio(item)} bg-slate-800/90 p-3 rounded-lg border text-xs space-y-1.5 cursor-pointer transition-colors shadow-sm">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-white text-sm">Plaqueta: ${item.plaqueta}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${situacaoPatrimonio(item) === 'aguardando' ? 'bg-amber-900 text-amber-300' : situacaoPatrimonio(item) === 'localizados' ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-700 text-slate-400'}">
                    ${situacaoPatrimonio(item) === 'aguardando' ? '⏳ AGUARDANDO APROVAÇÃO' : situacaoPatrimonio(item) === 'localizados' ? '🟢 LOCALIZADO' : '🔴 PENDENTE'}
                  </span>
                </div>
                <p class="text-slate-300 text-xs">${item.descricao}</p>
                <div class="mt-1.5 pt-1.5 border-t border-slate-700/50 text-[11px] space-y-0.5 text-slate-400">
                  <div>🏷️ Divisão Anterior: ${item.divisaoOrigem || item.divisao}</div>
                  <div>📍 Local Atual: <span class="text-emerald-400 font-bold">${item.localizacaoAtual || item.divisaoOrigem || item.divisao}</span></div>
                  ${situacaoPatrimonio(item) === 'aguardando' ? `<div>➡️ Local sugerido: <span class="text-amber-300 font-bold">${item.divisaoDestinoSugerida}</span></div>` : ''}
                  ${item.sugestaoDestinoStatus === 'pendente' ? `<div>📍 Destino indicado: <span class="text-amber-300 font-bold">${escaparHtml(item.sugestaoDestinoDivisao)}</span> · aguardando análise, sem conferência física</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;
        container.appendChild(accordion);
      });

      if (container.children.length === 0) {
        container.innerHTML = `<div class="bg-slate-800 p-5 rounded-xl border border-slate-700 text-center text-xs text-slate-400">${relacaoTemMais ? 'Nenhum item correspondente nesta página. Use Carregar mais para continuar.' : 'Nenhum patrimônio encontrado com os filtros atuais.'}</div>`;
      }
      atualizarPaginacaoRelacao();
    }

    const filtroBuscaRelacao = document.getElementById('filtro-busca');
    const btnLimparFiltroRelacao = document.getElementById('btn-limpar-filtro-relacao');
    filtroBuscaRelacao.addEventListener('input', () => {
      clearTimeout(timerFiltroRelacao);
      relacaoCarregada = false;
      btnLimparFiltroRelacao?.classList.toggle('hidden', !filtroBuscaRelacao.value);
      const termo = limparPlaqueta(filtroBuscaRelacao.value);
      if (!relacaoBaseCompleta && termo.length > 0 && termo.length < 3) {
        relacaoTemMais = false;
        document.getElementById('relacao-paginacao-info').innerText = 'Digite ao menos três números para pesquisar';
        return;
      }
      timerFiltroRelacao = setTimeout(() => carregarRelacaoPatrimonial({ reiniciar: true }), 400);
    });
    btnLimparFiltroRelacao?.addEventListener('click', () => {
      clearTimeout(timerFiltroRelacao);
      filtroBuscaRelacao.value = '';
      btnLimparFiltroRelacao.classList.add('hidden');
      carregarRelacaoPatrimonial({ reiniciar: true });
      filtroBuscaRelacao.focus();
    });
    document.getElementById('filtro-status').addEventListener('change', () => carregarRelacaoPatrimonial({ reiniciar: true }));
    document.getElementById('btn-expandir-divisoes')?.addEventListener('click', () => {
      document.querySelectorAll('#container-accordions .accordion-content').forEach(elemento => elemento.classList.remove('collapsed'));
    });
    document.getElementById('btn-recolher-divisoes')?.addEventListener('click', () => {
      document.querySelectorAll('#container-accordions .accordion-content').forEach(elemento => elemento.classList.add('collapsed'));
    });
    document.getElementById('btn-atualizar-relacao')?.addEventListener('click', () => {
      invalidarCacheRelacao({ preservarInventarios: true });
      carregarRelacaoPatrimonial({ reiniciar: true, forcarServidor: true });
    });
    document.getElementById('btn-carregar-mais')?.addEventListener('click', () => carregarRelacaoPatrimonial({ carregarMais: true }));

    document.getElementById('btn-exportar-csv').addEventListener('click', () => exportarCSV(bancoPatrimonio, 'relatorio_geral'));
    document.getElementById('btn-exportar-divergencias').addEventListener('click', () => exportarCSV(bancoPatrimonio.filter(i => situacaoPatrimonio(i) !== 'localizados'), 'relatorio_pendentes'));
    document.getElementById('btn-exportar-filtrados').addEventListener('click', () => exportarCSV(itensFiltradosCache, 'relatorio_filtrado'));

    function exportarCSV(dados, nomeArquivo) {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return notificarMensagem("Acesso negado para esta operação.", 'erro');
      if (dados.length === 0) return notificarMensagem("Não há registros disponíveis para exportação com os filtros atuais.", 'aviso');
      let csv = 'Plaqueta;Divisao Anterior;Local Atual;Status;Conferido Por;Descricao;Data Ultima Atualizacao\n';
      dados.forEach(i => {
        csv += `"${i.plaqueta}";"${i.divisaoOrigem || i.divisao}";"${i.localizacaoAtual || i.divisaoOrigem || i.divisao}";"${situacaoPatrimonio(i) === 'aguardando' ? 'AGUARDANDO APROVAÇÃO' : situacaoPatrimonio(i) === 'localizados' ? 'LOCALIZADO' : 'PENDENTE'}";"${i.conferidoPor || ''}";"${i.descricao.replace(/"/g, '""')}";"${i.dataLocalizacao || ''}"\n`;
      });
      const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `${nomeArquivo}_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    function ocultarSugestoesPlaqueta() {
      clearTimeout(timerAutocomplete);
      suggestionsBox.innerHTML = '';
      suggestionsBox.classList.add('hidden');
    }
