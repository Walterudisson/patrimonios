    import { signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
    import {
      doc, getDoc, getDocFromServer, setDoc, updateDoc, deleteDoc,
      collection, getDocs, onSnapshot, writeBatch, query, where,
      and, or, orderBy, startAt, startAfter, endAt, limit, documentId,
      getCountFromServer
    } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
    import { auth, db, authSecundario } from "./js/config/firebase.js";
    import { ehPerfilValidador, prepararAtualizacaoPatrimonio, prepararResolucaoTransferencia } from "./js/core/movimentacao.js";
    import { criarControladorCamera } from "./js/controllers/camera.controller.js?v=1.10.1";
    import { listarDivisoesAtivas } from "./js/services/divisoes.service.js";
    import {
      configurarHistoricoFeedback,
      confirmarAcao,
      fecharConfirmacaoAtiva,
      notificarMensagem
    } from "./js/ui/feedback.js?v=1.10.1";
    import {
      ativarPagina,
      atualizarAcessoNavegacao,
      atualizarUsuarioNavegacao,
      fecharCamadasNavegacao,
      fecharNavegacaoMovel,
      inicializarNavegacao
    } from "./js/ui/navigation.js?v=1.10.1";

    let usuarioLogado = null;
    let bancoPatrimonio = [];
    let bancoUsuarios = [];
    let bancoTransferencias = [];
    let itemAtualSelecionado = null;
    let itensFiltradosCache = [];
    let unsubscribeTransferencias = null;
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

    const TAMANHO_PAGINA_RELACAO = 50;

    const cachePatrimonios = new Map();
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
    window.addEventListener('popstate', tratarPopstate);

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
        ['modal-detalhes-item', 'detalhes-item'],
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

    function invalidarCacheRelacao() {
      relacaoBaseCompleta = null;
      relacaoUsandoBaseCompleta = false;
      relacaoCarregada = false;
      cursorRelacao = null;
      totalRelacao = 0;
      relacaoTemMais = true;
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

    function dividirEmLotes(lista, tamanho = 10) {
      const lotes = [];
      for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho));
      return lotes;
    }

    const dicasLista = [
      { titulo: "🔍 Leitura Óptica por OCR", texto: "Se o código estiver ilegível, centralize a numeração impressa e use 'Ler via OCR'. Após dez segundos, o app também oferece OCR, digitação manual ou a opção de continuar tentando." },
      { titulo: "📱 Câmera, foco e iluminação", texto: "Ao ligar a câmera, o app centraliza o visor. Depois de reconhecer a plaqueta, congela a imagem e leva você ao resultado e ao formulário de confirmação." },
      { titulo: "⚠️ Divergências de Setor", texto: "Achou um bem em local diferente? Para Conferentes, a mudança seguirá para aprovação. Gestores e Administradores validam a nova localização diretamente." },
      { titulo: "🔄 Gestão Hierárquica", texto: "Administradores gerenciam todo o sistema. Gestores podem atualizar seus dados e cadastrar ou editar os conferentes sob sua alçada." },
      { titulo: "🔄 Ciclo das Transferências", texto: "Mudanças informadas por Conferentes geram pendência na Fila. Quando registradas por Gestor ou Administrador, são efetivadas imediatamente e mantidas no histórico." },
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
        
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-app').classList.remove('hidden');
        atualizarCabecalhoUsuario();
        atualizarCarrossel();
        await alternarAba('dashboard', { substituirHistorico: true });
      } else {
        encerrarOuvinteTransferencias();
        if (controladorCamera.estaAtiva()) await controladorCamera.desligar({ limparResultado: true });
        usuarioLogado = null;
        bancoPatrimonio = [];
        bancoUsuarios = [];
        bancoTransferencias = [];
        cachePatrimonios.clear();
        cacheSugestoes.clear();
        catalogoDivisoes.clear();
        usuariosCarregados = false;
        invalidarCacheRelacao();
        catalogoDivisoesCarregado = false;
        fecharCamadaSobreposta();
        if (history.state?.cmApp) {
          history.replaceState({ cmAppLogin: true }, '', `${location.pathname}${location.search}`);
        }
        document.getElementById('view-app').classList.add('hidden');
        document.getElementById('view-login').classList.remove('hidden');
      }
    });

    function atualizarCabecalhoUsuario() {
      atualizarUsuarioNavegacao(usuarioLogado);
      atualizarAcessoNavegacao(usuarioLogado.perfil);
      document.getElementById('profile-menu-name').innerText = usuarioLogado.nome;
      
      const btnTransf = document.getElementById('tab-btn-transferencias');
      const btnUsuarios = document.getElementById('tab-btn-usuarios');
      const campoPerfil = document.getElementById('campo-perfil-container');
      const tituloCad = document.getElementById('titulo-cad-usuario');
      const boxExportacao = document.getElementById('container-botoes-exportacao');
      const panelCiclo = document.getElementById('panel-gestao-ciclo');
      const btnSalvar = document.getElementById('btn-salvar');

      if (usuarioLogado.perfil === 'conferente') {
        btnTransf.classList.add('hidden');
        btnUsuarios.classList.add('hidden');
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
          campoPerfil.classList.add('hidden');
          tituloCad.innerText = "👥 Cadastrar Novo Conferente";
        } else if (usuarioLogado.perfil === 'admin') {
          btnTransf.classList.remove('hidden');
          btnUsuarios.classList.remove('hidden');
          campoPerfil.classList.remove('hidden');
          tituloCad.innerText = "👥 Cadastrar Novo Gestor ou Conferente";
        }
      }

    }

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
      if (usuarioLogado?.perfil === 'gestor' && !bancoUsuarios.some(usuario => usuario.uid === usuarioLogado.uid)) {
        bancoUsuarios.unshift({ ...usuarioLogado });
      }
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
          where("localizacaoAtual", "in", lote)
        ));
        const snapshot = await getDocs(consulta);
        snapshot.docs.map(normalizarPatrimonio).forEach(item => resultados.set(item.plaqueta, item));
      }
      const itens = [...resultados.values()];
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
      const selectFiltro = document.getElementById('filtro-divisao');
      const selectReversao = document.getElementById('select-divisao-reversao');
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
      reconstruirSelect(selectFiltro, usuarioTemAcessoDivisao);
      reconstruirSelect(selectReversao);

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

    async function alternarAba(abaAtiva, { registrarHistorico = true, substituirHistorico = false } = {}) {
      if (usuarioLogado && usuarioLogado.perfil === 'conferente') {
        if (abaAtiva === 'transferencias' || abaAtiva === 'usuarios') {
          return;
        }
      }

      if (abaAtiva !== 'transferencias') encerrarOuvinteTransferencias();
      if (registrarHistorico) registrarAbaHistorico(abaAtiva, { substituir: substituirHistorico });
      abaAtual = abaAtiva;
      ativarPagina(abaAtiva);
      fecharNavegacaoMovel();

      if (abaAtiva !== 'scanner' && controladorCamera.estaAtiva()) {
        await controladorCamera.desligar({ retomarAposSalvar: true });
      }

      ['dashboard', 'scanner', 'transferencias', 'usuarios', 'lista'].forEach(aba => {
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
        if (abaAtiva === 'transferencias') iniciarOuvinteTransferencias();
        if (abaAtiva === 'usuarios') {
          await carregarUsuarios();
          await carregarCatalogoDivisoes();
        }
        if (abaAtiva === 'lista') await carregarRelacaoPatrimonial();
      } catch (erro) {
        console.error(`Erro ao carregar a aba ${abaAtiva}:`, erro);
        notificarMensagem("Não foi possível carregar os dados desta tela. Verifique sua conexão e tente novamente.", 'erro');
      }
    }

    function aplicarNumerosDashboard(total, localizados, pendentes, aguardando) {
      document.getElementById('dash-total').innerText = total;
      document.getElementById('dash-localizados').innerText = localizados;
      document.getElementById('dash-pendentes').innerText = pendentes;
      document.getElementById('dash-aguardando').innerText = aguardando;
      const percentual = total > 0 ? Math.round((localizados / total) * 100) : 0;
      document.getElementById('dash-progress-text').innerText = `${percentual}% concluído`;
      document.getElementById('dash-progress-bar').style.width = `${percentual}%`;
      const progresso = document.querySelector('.progress-track');
      progresso?.setAttribute('aria-valuenow', String(percentual));

      const badgeFila = document.getElementById('badge-fila-count');
      if (aguardando > 0 && usuarioLogado.perfil !== 'conferente') {
        badgeFila.innerText = aguardando;
        badgeFila.classList.remove('hidden');
      } else { badgeFila.classList.add('hidden'); }
    }

    document.querySelectorAll('[data-dashboard-target]').forEach(card => {
      card.addEventListener('click', async () => {
        const destino = card.dataset.dashboardTarget;
        if (destino === 'transferencias') {
          if (usuarioLogado?.perfil !== 'conferente') await alternarAba('transferencias');
          return;
        }
        document.getElementById('filtro-status').value = destino === 'todos' ? 'todos' : destino;
        await alternarAba('lista');
      });
    });

    async function carregarDashboard() {
      if (!usuarioLogado) return;
      ['dash-total', 'dash-localizados', 'dash-pendentes', 'dash-aguardando']
        .forEach(id => document.getElementById(id).innerText = '…');

      if (usuarioLogado.perfil === 'admin' || usuarioLogado.perfil === 'gestor') {
        const patrimoniosRef = collection(db, "patrimonios");
        const [totalSnap, localizadosSnap, aguardandoSnap] = await Promise.all([
          getCountFromServer(patrimoniosRef),
          getCountFromServer(query(patrimoniosRef, where("localizado", "==", true))),
          getCountFromServer(query(patrimoniosRef, where("statusTransferencia", "==", "pendente")))
        ]);

        const total = totalSnap.data().count;
        const totalMarcadosLocalizados = localizadosSnap.data().count;
        const aguardando = aguardandoSnap.data().count;
        const localizados = Math.max(0, totalMarcadosLocalizados - aguardando);
        const pendentes = Math.max(0, total - totalMarcadosLocalizados);
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
          const [totalSnap, localizadosSnap, aguardandoSnap] = await Promise.all([
            getCountFromServer(query(patrimoniosRef, filtroAcesso)),
            getCountFromServer(query(patrimoniosRef, and(filtroAcesso, where("localizado", "==", true)))),
            getCountFromServer(query(patrimoniosRef, and(filtroAcesso, where("statusTransferencia", "==", "pendente"))))
          ]);
          const total = totalSnap.data().count;
          const totalMarcadosLocalizados = localizadosSnap.data().count;
          const aguardando = aguardandoSnap.data().count;
          aplicarNumerosDashboard(
            total,
            Math.max(0, totalMarcadosLocalizados - aguardando),
            Math.max(0, total - totalMarcadosLocalizados),
            aguardando
          );
          return;
        } catch (erro) {
          console.warn("Agregação filtrada indisponível; usando fallback documental.", erro);
        }
      }

      const itens = await carregarPatrimoniosPermitidos();
      aplicarNumerosDashboard(
        itens.length,
        itens.filter(item => item.localizado && item.statusTransferencia !== 'pendente').length,
        itens.filter(item => !item.localizado).length,
        itens.filter(item => item.statusTransferencia === 'pendente').length
      );
    }

    async function atualizarItensEmLotes(itens, dadosAtualizacao) {
      for (let inicio = 0; inicio < itens.length; inicio += 450) {
        const batch = writeBatch(db);
        itens.slice(inicio, inicio + 450).forEach(item => {
          batch.update(doc(db, "patrimonios", item.plaqueta), dadosAtualizacao);
        });
        await batch.commit();
      }
    }

    async function buscarItensDaDivisao(divisao) {
      const consulta = query(collection(db, "patrimonios"), or(
        where("divisaoOrigem", "==", divisao),
        where("divisao", "==", divisao),
        where("localizacaoAtual", "==", divisao)
      ));
      const snapshot = await getDocs(consulta);
      return snapshot.docs.map(normalizarPatrimonio);
    }

    document.getElementById('btn-reverter-divisao').addEventListener('click', async () => {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return notificarMensagem("Acesso negado.", 'erro');
      const divAlvo = document.getElementById('select-divisao-reversao').value;
      if (!divAlvo) return notificarMensagem("Selecione uma divisão para reverter.", 'aviso');

      const confirmarReversao = await confirmarAcao({
        titulo: 'Reverter divisão',
        mensagem: `Todos os itens de ${divAlvo} voltarão ao status pendente e o progresso do setor será zerado.`,
        confirmarTexto: 'Reverter divisão',
        perigosa: true
      });
      if (!confirmarReversao) return;

      const itensAfetados = await buscarItensDaDivisao(divAlvo);
      if (itensAfetados.length === 0) return notificarMensagem("Nenhum item encontrado nesta divisão.", 'aviso');

      try {
        await atualizarItensEmLotes(itensAfetados, {
          localizado: false,
          statusTransferencia: "concluido",
          conferidoPor: "",
          observacaoAtual: "Status revertido para pendente (Novo Ciclo)",
          dataLocalizacao: ""
        });
        invalidarCacheRelacao();
        notificarMensagem(`Sucesso! ${itensAfetados.length} itens da divisão ${divAlvo} foram retornados para pendentes.`, 'sucesso');
        document.getElementById('select-divisao-reversao').value = "";
      } catch (e) {
        notificarMensagem("Erro ao executar reversão setorial.", 'erro');
      }
    });

    document.getElementById('btn-reverter-geral').addEventListener('click', async () => {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return notificarMensagem("Acesso negado.", 'erro');
      const confirmarReinicio = await confirmarAcao({
        titulo: 'Reiniciar inventário geral',
        mensagem: 'Todos os patrimônios retornarão ao status pendente. Use esta ação somente ao iniciar um novo ciclo completo.',
        confirmarTexto: 'Reiniciar inventário',
        perigosa: true
      });
      if (!confirmarReinicio) return;

      try {
        const snapshot = await getDocs(collection(db, "patrimonios"));
        const itens = snapshot.docs.map(normalizarPatrimonio);
        await atualizarItensEmLotes(itens, {
          localizado: false,
          statusTransferencia: "concluido",
          conferidoPor: "",
          observacaoAtual: "Inventário reiniciado para novo ciclo",
          dataLocalizacao: ""
        });
        invalidarCacheRelacao();
        notificarMensagem("Inventário geral reiniciado com sucesso! Todos os itens estão pendentes.", 'sucesso');
      } catch (e) {
        notificarMensagem("Erro ao reiniciar inventário geral.", 'erro');
      }
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
        notificarMensagem("Erro ao reverter item.", 'erro');
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
      if (usuarioLogado.perfil === 'conferente') return notificarMensagem("Acesso negado para esta operação.", 'erro');

      const nome = document.getElementById('cad-nome').value.trim();
      const email = document.getElementById('cad-email').value.trim();
      const senha = document.getElementById('cad-senha').value;
      let perfil = usuarioLogado.perfil === 'gestor' ? 'conferente' : document.getElementById('cad-perfil').value;
      const checkboxes = document.querySelectorAll('input[name="divisao-check"]:checked');
      const divisoes = perfil === 'conferente' ? Array.from(checkboxes).map(cb => cb.value) : [];

      try {
        const cred = await createUserWithEmailAndPassword(authSecundario, email, senha);
        await setDoc(doc(db, "usuarios", cred.user.uid), { nome, email, perfil, divisoesAtribuidas: divisoes });
        await signOut(authSecundario);

        notificarMensagem(`Colaborador ${nome} cadastrado com sucesso.`, 'sucesso');
        document.getElementById('form-cad-usuario').reset();
        document.querySelectorAll('input[name="divisao-check"]').forEach(cb => cb.checked = false);
        await fecharModalCriacaoUsuario();
        await carregarUsuarios(true);
      } catch (err) {
        let msg = "Não foi possível concluir o cadastro.";
        let tipo = 'erro';
        if (err.code === 'auth/email-already-in-use') {
          msg = "Este e-mail já está cadastrado no sistema.";
          tipo = 'aviso';
        } else if (err.code === 'auth/weak-password') {
          msg = "A senha deve conter pelo menos 6 caracteres.";
          tipo = 'aviso';
        }
        notificarMensagem(msg, tipo);
      }
    });

    function renderizarListaUsuarios() {
      const container = document.getElementById('lista-usuarios-container');
      const termoBusca = (document.getElementById('filtro-busca-usuarios')?.value || "").toLowerCase().trim();
      if (!container || !usuarioLogado) return;

      const usuariosFiltradosPorPermissao = bancoUsuarios.filter(u => {
        if (usuarioLogado.perfil === 'admin') return true;
        if (usuarioLogado.perfil === 'gestor') {
          return u.uid === usuarioLogado.uid || u.perfil === 'conferente';
        }
        return false;
      });

      const usuariosFinais = usuariosFiltradosPorPermissao.filter(u => {
        const nomeMatch = (u.nome || "").toLowerCase().includes(termoBusca);
        const emailMatch = (u.email || "").toLowerCase().includes(termoBusca);
        return nomeMatch || emailMatch;
      });

      if (usuariosFinais.length === 0) {
        container.innerHTML = `<div class="text-xs text-slate-400 text-center py-4 bg-slate-900 rounded-lg border border-slate-700/60">Nenhum usuário encontrado.</div>`;
        return;
      }

      const grupos = {
        admin: usuariosFinais.filter(u => u.perfil === 'admin').sort((a, b) => a.nome.localeCompare(b.nome)),
        gestor: usuariosFinais.filter(u => u.perfil === 'gestor').sort((a, b) => a.nome.localeCompare(b.nome)),
        conferente: usuariosFinais.filter(u => u.perfil === 'conferente').sort((a, b) => a.nome.localeCompare(b.nome))
      };

      const titulosGrupos = {
        admin: "🛡️ Administradores",
        gestor: "⭐ Gestores",
        conferente: "👤 Conferentes"
      };

      let htmlConsolidado = "";

      ['admin', 'gestor', 'conferente'].forEach((tipo, idx) => {
        const listaGrupo = grupos[tipo];
        if (listaGrupo.length > 0) {
          htmlConsolidado += `
            <div class="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
              <button onclick="document.getElementById('acc-user-${idx}').classList.toggle('collapsed')" class="w-full flex justify-between items-center p-3 text-left font-bold text-xs bg-slate-800 border-b border-slate-700/50">
                <span class="text-blue-400 font-semibold">${titulosGrupos[tipo]} (${listaGrupo.length})</span>
                <span class="text-[10px] text-slate-400">▼ Expandir/Recolher</span>
              </button>
              <div id="acc-user-${idx}" class="accordion-content p-2 space-y-2 bg-slate-900/50">
          `;

          listaGrupo.forEach(u => {
            const ehProprio = u.uid === usuarioLogado.uid;
            const podeExcluir = !ehProprio && (
              (usuarioLogado.perfil === 'admin' && u.perfil !== 'admin') ||
              (usuarioLogado.perfil === 'gestor' && u.perfil === 'conferente')
            );

            htmlConsolidado += `
              <div class="bg-slate-800 p-3 rounded-lg border border-slate-700/60 space-y-2 text-xs">
                <div class="space-y-0.5">
                  <div class="font-bold text-white">${u.nome} ${ehProprio ? '(Você)' : ''}</div>
                  <div class="text-[10px] text-slate-400">${u.email}</div>
                  <div class="text-[10px] text-emerald-400">${u.perfil === 'conferente'
                    ? `Setores: ${(u.divisaoAtribuidas || u.divisoesAtribuidas || []).join(', ') || 'Nenhum'}`
                    : 'Abrangência: acesso global'}</div>
                </div>
                <div class="flex gap-2 pt-1 border-t border-slate-700">
                  <button onclick="abrirModalEdicao('${u.uid}')" class="flex-1 bg-slate-700 hover:bg-blue-600 text-slate-200 hover:text-white py-1.5 rounded text-[11px] font-bold transition-colors text-center">
                    ✏️ Editar
                  </button>
                  ${podeExcluir ? `
                    <button onclick="excluirUsuario('${u.uid}', '${u.nome}')" class="bg-red-950/60 hover:bg-red-900 text-red-300 py-1.5 px-3 rounded text-[11px] font-bold transition-colors text-center border border-red-500/30">
                      🗑️ Excluir
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          });

          htmlConsolidado += `</div></div>`;
        }
      });

      container.innerHTML = htmlConsolidado;
    }

    const filtroBuscaUsuarios = document.getElementById('filtro-busca-usuarios');
    const btnLimparBuscaUsuarios = document.getElementById('btn-limpar-busca-usuarios');
    filtroBuscaUsuarios?.addEventListener('input', () => {
      btnLimparBuscaUsuarios?.classList.toggle('hidden', !filtroBuscaUsuarios.value);
      renderizarListaUsuarios();
    });
    btnLimparBuscaUsuarios?.addEventListener('click', () => {
      filtroBuscaUsuarios.value = '';
      btnLimparBuscaUsuarios.classList.add('hidden');
      renderizarListaUsuarios();
      filtroBuscaUsuarios.focus();
    });

    window.excluirUsuario = async function(uid, nome) {
      const userAlvo = bancoUsuarios.find(u => u.uid === uid);
      if (!userAlvo) return;

      if (usuarioLogado.perfil === 'gestor' && userAlvo.perfil !== 'conferente') {
        return notificarMensagem("Operação não permitida: Gestores só podem remover usuários com perfil conferente.", 'erro');
      }

      const confirmarExclusao = await confirmarAcao({
        titulo: 'Remover acesso',
        mensagem: `O acesso de ${nome} será removido. Esta ação não pode ser desfeita.`,
        confirmarTexto: 'Remover usuário',
        perigosa: true
      });
      if (!confirmarExclusao) return;

      try {
        await deleteDoc(doc(db, "usuarios", uid));
        notificarMensagem("Usuário removido com sucesso.", 'sucesso');
        await carregarUsuarios(true);
      } catch (err) {
        notificarMensagem("Erro ao remover o usuário. Tente novamente.", 'erro');
      }
    }

    window.abrirModalEdicao = function(uid) {
      const user = bancoUsuarios.find(u => u.uid === uid);
      if (!user) return;

      if (usuarioLogado.perfil === 'gestor') {
        if (user.uid !== usuarioLogado.uid && user.perfil !== 'conferente') {
          return notificarMensagem("Acesso restrito: Gestores não possuem permissão para editar outros gestores ou administradores.", 'erro');
        }
      }

      document.getElementById('edit-uid').value = user.uid;
      document.getElementById('edit-nome').value = user.nome || '';
      document.getElementById('edit-email').value = user.email || '';
      
      const perfilSelect = document.getElementById('edit-perfil');
      const campoPerfilEdit = document.getElementById('edit-campo-perfil-container');
      const campoDivisoesEdit = document.getElementById('edit-divisoes-container');
      
      if (usuarioLogado.perfil === 'gestor') {
        campoPerfilEdit.classList.add('hidden');
      } else {
        campoPerfilEdit.classList.remove('hidden');
        perfilSelect.value = user.perfil || 'conferente';
      }

      const atribuidas = user.divisaoAtribuidas || user.divisoesAtribuidas || [];
      document.querySelectorAll('input[name="edit-divisao-check"]').forEach(cb => {
        cb.checked = atribuidas.includes(cb.value);
      });

      const gestorEditandoProprioPerfil = usuarioLogado.perfil === 'gestor' && user.uid === usuarioLogado.uid;
      campoDivisoesEdit.classList.toggle('hidden', gestorEditandoProprioPerfil || user.perfil !== 'conferente');

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

      if (usuarioLogado.perfil === 'gestor') {
        if (targetUser.uid !== usuarioLogado.uid && targetUser.perfil !== 'conferente') {
          return notificarMensagem("Operação negada pelas diretrizes de hierarquia.", 'erro');
        }
      }

      let perfilNovo = targetUser.perfil;
      if (usuarioLogado.perfil === 'admin') {
        perfilNovo = document.getElementById('edit-perfil').value;
      }

      const checkboxes = document.querySelectorAll('input[name="edit-divisao-check"]:checked');
      const divisoes = perfilNovo === 'conferente' ? Array.from(checkboxes).map(cb => cb.value) : [];

      try {
        const gestorEditandoProprioPerfil = usuarioLogado.perfil === 'gestor' && targetUser.uid === usuarioLogado.uid;
        const dadosAtualizacao = gestorEditandoProprioPerfil
          ? { nome }
          : { nome, perfil: perfilNovo, divisoesAtribuidas: divisoes };
        await updateDoc(doc(db, "usuarios", uid), dadosAtualizacao);
        notificarMensagem("Dados atualizados com sucesso.", 'sucesso');
        await fecharModalHistorico('modal-edicao-usuario', 'edicao-usuario');
        await carregarUsuarios(true);
      } catch (err) {
        notificarMensagem("Não foi possível salvar as alterações.", 'erro');
      }
    });

    async function preencherEConsultarPlaqueta(codigoLido) {
      const codLimpo = limparPlaqueta(codigoLido);
      if (!codLimpo) return false;
      document.getElementById('input-plaqueta').value = codLimpo;
      document.getElementById('btn-limpar-plaqueta')?.classList.remove('hidden');
      return buscarEExibirItem(codLimpo);
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
      inputPlaqueta.value = '';
      btnLimparPlaqueta?.classList.add('hidden');
      suggestionsBox.classList.add('hidden');
      document.getElementById('select-localizacao').value = '';
      document.getElementById('input-observacao').value = '';
      document.getElementById('item-details').classList.add('hidden');
      document.getElementById('alerta-transferencia').classList.add('hidden');
      ocultarPatrimonioNaoEncontrado();
      itemAtualSelecionado = null;
    }

    inputPlaqueta.addEventListener('input', (e) => {
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
                    where("localizacaoAtual", "in", lote)
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
      if (item) { preencherEConsultarPlaqueta(item.getAttribute('data-plaqueta')); suggestionsBox.classList.add('hidden'); }
    });

    document.getElementById('btn-buscar').addEventListener('click', () => buscarEExibirItem(limparPlaqueta(inputPlaqueta.value)));
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
      buscarEExibirItem(limparPlaqueta(inputPlaqueta.value));
    });

    async function buscarEExibirItem(plaquetaCod) {
      if (!plaquetaCod) return false;
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
      const pendenteBloqueado = usuarioLogado?.perfil === 'conferente'
        && item.statusTransferencia === 'pendente';
      btnSalvar.disabled = pendenteBloqueado;
      btnSalvar.classList.toggle('opacity-50', pendenteBloqueado);
      btnSalvar.classList.toggle('cursor-not-allowed', pendenteBloqueado);
      btnSalvar.innerText = pendenteBloqueado
        ? '⏳ Aguardando aprovação'
        : (ehPerfilValidador(usuarioLogado?.perfil) ? '✅ Atualizar Patrimônio' : '✅ Registrar Conferência');
      if (item.statusTransferencia === 'pendente') {
        badgeStatus.innerText = "⏳ AGUARDANDO TRANSF.";
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
              <span>📍 ${h.local}</span>
              <span class="text-slate-400">${h.data}</span>
            </div>
            <div class="text-slate-400">Por: ${h.responsavel} ${h.obs ? `| Obs: ${h.obs}` : ''}</div>
          </div>
        `).join('');
        document.getElementById('det-historico-box').classList.remove('hidden');
      } else { document.getElementById('det-historico-box').classList.add('hidden'); }

      const selectLoc = document.getElementById('select-localizacao');
      selectLoc.value = item.localizacaoAtual || divisaoOriginal;
      verificarAlertaTransferencia(item.localizacaoAtual || divisaoOriginal, selectLoc.value);
    }

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

      const perfilValidador = ehPerfilValidador(usuarioLogado?.perfil);
      alerta.className = perfilValidador
        ? 'bg-blue-950/60 border border-blue-500/40 p-2.5 rounded-lg text-[11px] text-blue-200 space-y-1'
        : 'bg-amber-950/60 border border-amber-500/40 p-2.5 rounded-lg text-[11px] text-amber-200 space-y-1';
      titulo.innerText = perfilValidador
        ? '✅ Alteração validada pelo perfil'
        : '⚠️ ATENÇÃO: Transferência detectada';
      texto.innerHTML = perfilValidador
        ? 'Ao salvar, a localização será <strong>atualizada imediatamente</strong> e registrada no histórico.'
        : 'Ao salvar, a mudança ficará <strong>aguardando aprovação</strong> de um Gestor ou Administrador.';
    }

    document.getElementById('btn-salvar').addEventListener('click', async () => {
      if (!itemAtualSelecionado) return notificarMensagem("Selecione um patrimônio válido antes de salvar.", 'aviso');
      if (usuarioLogado?.perfil === 'conferente' && itemAtualSelecionado.statusTransferencia === 'pendente') {
        return notificarMensagem("Este patrimônio já está aguardando aprovação. Somente um Gestor ou Administrador pode concluir a movimentação.", 'aviso');
      }
      const locAtual = document.getElementById('select-localizacao').value;
      if (!locAtual) return notificarMensagem("Selecione a localização atual do item.", 'aviso');

      const obs = document.getElementById('input-observacao').value.trim();
      const dataHora = new Date().toLocaleString('pt-BR');
      const {
        dadosAtualizacao,
        houveMudanca: ehTransferencia,
        perfilValidador
      } = prepararAtualizacaoPatrimonio({
        item: itemAtualSelecionado,
        localizacaoDestino: locAtual,
        usuario: usuarioLogado,
        observacao: obs,
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
        ? (perfilValidador
          ? "✅ Localização atualizada e validada com sucesso."
          : "⚠️ Mudança de localização enviada para aprovação.")
        : (perfilValidador ? "✅ Patrimônio atualizado com sucesso." : "✅ Conferência registrada com sucesso.");
      notificarMensagem(mensagemSucesso, ehTransferencia && !perfilValidador ? 'aviso' : 'sucesso');
      limparFormularioLeitura();
      await controladorCamera.retomarAposSalvar();
    });

    function encerrarOuvinteTransferencias() {
      if (unsubscribeTransferencias) {
        unsubscribeTransferencias();
        unsubscribeTransferencias = null;
      }
    }

    function iniciarOuvinteTransferencias() {
      encerrarOuvinteTransferencias();
      const consulta = query(collection(db, "patrimonios"), where("statusTransferencia", "==", "pendente"));
      unsubscribeTransferencias = onSnapshot(consulta, snapshot => {
        snapshot.docChanges()
          .filter(alteracao => alteracao.type === 'removed')
          .forEach(alteracao => cachePatrimonios.delete(alteracao.doc.id));
        bancoTransferencias = snapshot.docs.map(normalizarPatrimonio);
        cachearPatrimonios(bancoTransferencias);
        renderizarFilaTransferencias();
        aplicarBadgeTransferencias(bancoTransferencias.length);
      }, erro => {
        console.error("Erro no listener de transferências:", erro);
        document.getElementById('container-transferencias').innerHTML = `<div class="bg-red-950/40 p-4 rounded-xl border border-red-500/30 text-center text-xs text-red-300 md:col-span-2">Não foi possível acompanhar a fila em tempo real.</div>`;
      });
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
        container.innerHTML = `<div class="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center text-xs text-slate-400 md:col-span-2">✨ Nenhuma transferência pendente no momento.</div>`;
        return;
      }

      const grupos = pendentes.reduce((acumulador, item) => {
        const divisao = item.divisaoDestinoSugerida || 'Divisão não informada';
        if (!acumulador.has(divisao)) acumulador.set(divisao, []);
        acumulador.get(divisao).push(item);
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
                        <dd>${item.divisaoDestinoSugerida || 'Não informado'}</dd>
                      </div>
                    </dl>
                    ${item.observacaoAtual ? `<p class="transfer-note"><strong>Observação:</strong> ${item.observacaoAtual}</p>` : ''}
                    <div class="transfer-actions">
                      <button type="button" onclick="aprovarTransferencia('${item.plaqueta}')" class="transfer-approve">Aprovar</button>
                      <button type="button" onclick="rejeitarTransferencia('${item.plaqueta}')" class="transfer-reject">Rejeitar</button>
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
        notificarMensagem(erro.message || "Não foi possível resolver a transferência.", 'erro');
      }
    }

    window.aprovarTransferencia = plaqueta => resolverTransferencia(plaqueta, 'aprovar');
    window.rejeitarTransferencia = plaqueta => resolverTransferencia(plaqueta, 'rejeitar');

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
                    <span>📍 ${h.local}</span>
                    <span class="text-slate-400 text-[10px]">${h.data}</span>
                  </div>
                  ${h.acao ? `<div class="text-[10px] text-slate-500">Ação: ${h.acao.replaceAll('_', ' ')}</div>` : ''}
                  <div class="text-slate-400 text-[10px]">Por: ${h.responsavel}${h.obs ? `| Obs: ${h.obs}` : ''}</div>
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

    function criarConsultaRelacao(cursor = null, paraContagem = false) {
      const patrimoniosRef = collection(db, "patrimonios");
      const termo = limparPlaqueta(document.getElementById('filtro-busca').value);
      const statusFiltro = document.getElementById('filtro-status').value;
      const divisaoFiltro = document.getElementById('filtro-divisao').value;
      const filtros = [];

      if (termo.length > 0 && termo.length < 3) return { invalida: true };

      if (divisaoFiltro !== 'todas') {
        if (usuarioLogado.perfil === 'conferente' && !usuarioTemAcessoDivisao(divisaoFiltro)) {
          throw new Error("Divisão fora da alçada do usuário.");
        }
        filtros.push(or(
          where("divisaoOrigem", "==", divisaoFiltro),
          where("divisao", "==", divisaoFiltro),
          where("localizacaoAtual", "==", divisaoFiltro)
        ));
      } else if (usuarioLogado.perfil === 'conferente') {
        const divisoes = [...new Set(usuarioLogado.divisoesAtribuidas || [])];
        if (divisoes.length === 0) return { vazia: true };
        if (divisoes.length > 10) return { fallback: true };
        filtros.push(or(
          where("divisaoOrigem", "in", divisoes),
          where("divisao", "in", divisoes),
          where("localizacaoAtual", "in", divisoes)
        ));
      }

      if (statusFiltro === 'localizados') filtros.push(where("localizado", "==", true));
      if (statusFiltro === 'pendentes') filtros.push(where("localizado", "==", false));

      const restricoes = [];
      if (filtros.length === 1) restricoes.push(filtros[0]);
      if (filtros.length > 1) restricoes.push(and(...filtros));
      restricoes.push(orderBy(documentId()));

      if (cursor) restricoes.push(startAfter(cursor));
      else if (termo) restricoes.push(startAt(termo));
      if (termo) restricoes.push(endAt(`${termo}\uf8ff`));
      if (!paraContagem) restricoes.push(limit(TAMANHO_PAGINA_RELACAO));

      return { consulta: query(patrimoniosRef, ...restricoes), termo };
    }

    function obterFiltrosRelacao() {
      return {
        termo: limparPlaqueta(document.getElementById('filtro-busca').value),
        status: document.getElementById('filtro-status').value,
        divisao: document.getElementById('filtro-divisao').value
      };
    }

    function consultaBaseRelacaoAtiva() {
      const filtros = obterFiltrosRelacao();
      return !filtros.termo && filtros.status === 'todos' && filtros.divisao === 'todas';
    }

    function itemCorrespondeAosFiltros(item, filtros) {
      const divisoesItem = [item.divisaoOrigem, item.divisao, item.localizacaoAtual].filter(Boolean);
      const correspondeTermo = !filtros.termo || String(item.plaqueta).startsWith(filtros.termo);
      const correspondeStatus = filtros.status === 'todos'
        || (filtros.status === 'localizados' ? item.localizado : !item.localizado);
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
          : `${bancoPatrimonio.length} de ${totalRelacao} item(ns) carregado(s)`;
      }
      if (botao) {
        botao.classList.toggle('hidden', !relacaoTemMais || bancoPatrimonio.length === 0);
        botao.disabled = relacaoCarregando;
        botao.innerText = relacaoCarregando ? 'Carregando…' : `Carregar mais ${TAMANHO_PAGINA_RELACAO}`;
      }
    }

    async function carregarRelacaoPatrimonial({ reiniciar = false, carregarMais = false, forcarServidor = false } = {}) {
      if (relacaoCarregando) return;
      if (reiniciar && !forcarServidor && aplicarFiltrosNaBaseCompleta()) return;
      if (relacaoCarregada && !reiniciar && !carregarMais) {
        renderizarRelaçãoBD();
        return;
      }
      if (carregarMais && !relacaoTemMais) return;

      const container = document.getElementById('container-accordions');
      if (reiniciar || !relacaoCarregada) {
        relacaoUsandoBaseCompleta = false;
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
      if (configuracao.fallback) {
        bancoPatrimonio = await carregarPatrimoniosPermitidos();
        totalRelacao = bancoPatrimonio.length;
        relacaoTemMais = false;
        relacaoCarregada = true;
        if (consultaBaseRelacaoAtiva()) {
          relacaoBaseCompleta = [...bancoPatrimonio];
          relacaoUsandoBaseCompleta = true;
        }
        renderizarRelaçãoBD();
        return;
      }

      relacaoCarregando = true;
      atualizarPaginacaoRelacao();
      try {
        if (reiniciar || !relacaoCarregada) {
          const configuracaoContagem = criarConsultaRelacao(null, true);
          const contagemSnap = await getCountFromServer(configuracaoContagem.consulta);
          totalRelacao = contagemSnap.data().count;
        }

        const snapshot = await getDocs(configuracao.consulta);
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
        console.error("Erro na consulta paginada da Relação:", erro);
        relacaoTemMais = false;
        container.innerHTML = `<div class="bg-red-950/40 p-5 rounded-xl border border-red-500/30 text-center text-xs text-red-300">Não foi possível carregar a consulta. Verifique as regras e os índices do Firestore.</div>`;
      } finally {
        relacaoCarregando = false;
        atualizarPaginacaoRelacao();
      }
    }

    function renderizarRelaçãoBD() {
      const container = document.getElementById('container-accordions');
      if (!container || !usuarioLogado) return;

      const termo = limparPlaqueta(document.getElementById('filtro-busca').value);
      const statusFiltro = document.getElementById('filtro-status').value;
      const divisaoFiltro = document.getElementById('filtro-divisao').value;
      const minhasDivs = usuarioLogado.divisoesAtribuidas || [];

      const itensPermitidos = bancoPatrimonio.filter(i => {
        const origem = i.divisaoOrigem || i.divisao;
        const atual = i.localizacaoAtual || origem;
        if (usuarioLogado.perfil === 'conferente' && !minhasDivs.includes(origem) && !minhasDivs.includes(atual)) return false;
        return true;
      });

      const gruposTotal = {};
      itensPermitidos.forEach(i => {
        const divAtual = i.localizacaoAtual || i.divisaoOrigem || i.divisao;
        if (!gruposTotal[divAtual]) gruposTotal[divAtual] = [];
        gruposTotal[divAtual].push(i);
      });

      const itensFiltrados = itensPermitidos.filter(i => {
        const atual = i.localizacaoAtual || i.divisaoOrigem || i.divisao;
        const matchTermo = !termo || i.plaqueta.startsWith(termo);
        const matchStatus = statusFiltro === 'todos' || (statusFiltro === 'localizados' ? i.localizado : !i.localizado);
        const matchDivisao = divisaoFiltro === 'todas'
          || [i.divisaoOrigem, i.divisao, i.localizacaoAtual].filter(Boolean).includes(divisaoFiltro);
        return matchTermo && matchStatus && matchDivisao;
      });

      itensFiltradosCache = itensFiltrados;

      const gruposFiltrados = {};
      itensFiltrados.forEach(i => {
        const divAtual = i.localizacaoAtual || i.divisaoOrigem || i.divisao;
        if (!gruposFiltrados[divAtual]) gruposFiltrados[divAtual] = [];
        gruposFiltrados[divAtual].push(i);
      });

      container.innerHTML = '';
      
      Object.keys(gruposTotal).sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach((divNome, idx) => {
        const todosDaDiv = gruposTotal[divNome];
        const visiveisDaDiv = gruposFiltrados[divNome] || [];
        
        if (visiveisDaDiv.length === 0 && (termo || statusFiltro !== 'todos' || divisaoFiltro !== 'todas')) return;

        const locCount = todosDaDiv.filter(i => i.localizado).length;
        const totalCount = todosDaDiv.length;

        const accordion = document.createElement('div');
        accordion.className = "bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-md";
        accordion.innerHTML = `
          <button onclick="document.getElementById('acc-${idx}').classList.toggle('collapsed')" class="w-full flex justify-between items-center p-3.5 text-left font-bold text-xs md:text-sm bg-slate-800 border-b border-slate-700/50 hover:bg-slate-750 transition-colors">
            <span class="text-blue-400 font-semibold">📁 ${divNome} (${totalCount} carregados)</span>
            <span class="text-xs ${locCount === totalCount ? 'text-emerald-400' : 'text-amber-400'}">${locCount}/${totalCount} nesta página</span>
          </button>
          <div id="acc-${idx}" class="accordion-content collapsed p-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/50">
            ${visiveisDaDiv.map(item => `
              <div onclick="abrirModalItemPorPlaqueta('${item.plaqueta}')" class="bg-slate-800/90 p-3 rounded-lg border border-slate-700 text-xs space-y-1.5 cursor-pointer hover:border-blue-500/60 transition-colors shadow-sm">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-white text-sm">Plaqueta: ${item.plaqueta}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${item.localizado ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-700 text-slate-400'}">
                    ${item.localizado ? '🟢 LOCALIZADO' : '🔴 PENDENTE'}
                  </span>
                </div>
                <p class="text-slate-300 text-xs">${item.descricao}</p>
                <div class="mt-1.5 pt-1.5 border-t border-slate-700/50 text-[11px] space-y-0.5 text-slate-400">
                  <div>🏷️ Divisão Anterior: ${item.divisaoOrigem || item.divisao}</div>
                  <div>📍 Local Atual: <span class="text-emerald-400 font-bold">${item.localizacaoAtual || item.divisaoOrigem || item.divisao}</span></div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        container.appendChild(accordion);
      });

      if (container.children.length === 0) {
        container.innerHTML = `<div class="bg-slate-800 p-5 rounded-xl border border-slate-700 text-center text-xs text-slate-400">Nenhum patrimônio encontrado com os filtros atuais.</div>`;
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
    document.getElementById('filtro-divisao').addEventListener('change', () => carregarRelacaoPatrimonial({ reiniciar: true }));
    document.getElementById('btn-atualizar-relacao')?.addEventListener('click', () => {
      invalidarCacheRelacao();
      carregarRelacaoPatrimonial({ reiniciar: true, forcarServidor: true });
    });
    document.getElementById('btn-carregar-mais')?.addEventListener('click', () => carregarRelacaoPatrimonial({ carregarMais: true }));

    document.getElementById('btn-exportar-csv').addEventListener('click', () => exportarCSV(bancoPatrimonio, 'relatorio_geral'));
    document.getElementById('btn-exportar-divergencias').addEventListener('click', () => exportarCSV(bancoPatrimonio.filter(i => !i.localizado), 'relatorio_pendentes'));
    document.getElementById('btn-exportar-filtrados').addEventListener('click', () => exportarCSV(itensFiltradosCache, 'relatorio_filtrado'));

    function exportarCSV(dados, nomeArquivo) {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return notificarMensagem("Acesso negado para esta operação.", 'erro');
      if (dados.length === 0) return notificarMensagem("Não há registros disponíveis para exportação com os filtros atuais.", 'aviso');
      let csv = 'Plaqueta;Divisao Anterior;Local Atual;Status;Conferido Por;Descricao;Data Ultima Atualizacao\n';
      dados.forEach(i => {
        csv += `"${i.plaqueta}";"${i.divisaoOrigem || i.divisao}";"${i.localizacaoAtual || i.divisao}";"${i.localizado ? 'LOCALIZADO' : 'PENDENTE'}";"${i.conferidoPor || ''}";"${i.descricao.replace(/"/g, '""')}";"${i.dataLocalizacao || ''}"\n`;
      });
      const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `${nomeArquivo}_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
