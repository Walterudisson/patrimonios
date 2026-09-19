    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
    import {
      getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
      collection, getDocs, onSnapshot, writeBatch, query, where,
      and, or, orderBy, startAt, endAt, limit, documentId, getCountFromServer
    } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

    const firebaseConfig = {
      apiKey: "AIzaSyCVMSES7nwZkZZdQpemDZIb8ypd40bUtvs",
      authDomain: "patrimonioscm.firebaseapp.com",
      projectId: "patrimonioscm",
      storageBucket: "patrimonioscm.firebasestorage.app",
      messagingSenderId: "707665651049",
      appId: "1:707665651049:web:42cb423f3c0911fe5709f8"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    const appSecundario = initializeApp(firebaseConfig, "AppSecundarioCriacao");
    const authSecundario = getAuth(appSecundario);

    let usuarioLogado = null;
    let bancoPatrimonio = [];
    let bancoUsuarios = [];
    let bancoTransferencias = [];
    let html5QrcodeScanner = null;
    let cameraAtiva = false;
    let itemAtualSelecionado = null;
    let modoBootstrapAdmin = false;
    let nivelZoomAtual = 1;
    let itensFiltradosCache = [];
    let unsubscribeTransferencias = null;
    let abaAtual = 'dashboard';
    let usuariosCarregados = false;
    let relacaoCarregada = false;
    let timerAutocomplete = null;
    let primeiraCargaTransferencias = true;

    const cachePatrimonios = new Map();
    const cacheSugestoes = new Map();
    const catalogoDivisoes = new Set();
    const metricasFirestore = {
      documentosLidos: 0,
      leiturasAgregadasEstimadas: 0,
      operacoes: {}
    };

    function registrarLeituras(operacao, documentos = 0, agregadasEstimadas = 0) {
      metricasFirestore.documentosLidos += documentos;
      metricasFirestore.leiturasAgregadasEstimadas += agregadasEstimadas;
      const atual = metricasFirestore.operacoes[operacao] || { documentos: 0, agregadasEstimadas: 0 };
      atual.documentos += documentos;
      atual.agregadasEstimadas += agregadasEstimadas;
      metricasFirestore.operacoes[operacao] = atual;
      atualizarPainelMetricas();
    }

    function estimarLeiturasAgregacao(...contagens) {
      return contagens.reduce((total, quantidade) => total + Math.max(1, Math.ceil(quantidade / 1000)), 0);
    }

    function atualizarPainelMetricas() {
      const el = document.getElementById('firestore-metrics');
      if (!el) return;
      el.innerText = `Sessão: ${metricasFirestore.documentosLidos} documentos + ~${metricasFirestore.leiturasAgregadasEstimadas} leituras de agregação`;
    }

    window.obterMetricasFirestore = () => JSON.parse(JSON.stringify(metricasFirestore));

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
      { titulo: "🔍 Leitura Óptica por OCR", texto: "Se a etiqueta estiver danificada ou o código de barras ilegível, posicione os números impressos no visor e clique em 'Ler via OCR' para reconhecer o texto automaticamente." },
      { titulo: "📱 Ângulos Difíceis e Brilho", texto: "Aproxime a câmera e evite reflexos excessivos sobre a película metálica para garantir uma leitura rápida e precisa do patrimônio." },
      { titulo: "⚠️ Divergências de Setor", texto: "Achou um bem de outra divisão ou setor? Conduza a conferência normalmente. O sistema abrirá um alerta para aprovação do Gestor responsável." },
      { titulo: "🔄 Gestão Hierárquica", texto: "Administradores gerenciam todo o sistema. Gestores podem atualizar seus dados e cadastrar ou editar os conferentes sob sua alçada." },
      { titulo: "🔄 Ciclo das Transferências", texto: "Moveu um item de setor? Alterações para divisões diferentes geram uma pendência automática que aguarda a aprovação do Gestor na Fila de Transferências." },
      { titulo: "🔍 Busca Rápida por Digitação", texto: "Na aba 'Leitura', comece a digitar os números da plaqueta para ver sugestões instantâneas e agilizar o preenchimento sem precisar usar a câmera." },
      { titulo: "📋 Acompanhamento por Setor (Relação)", texto: "Utilize a aba 'Relação' para acompanhar o progresso do inventário. Os blocos mostram o total de itens e quantos já foram conferidos em cada divisão." },
      { titulo: "🔎 Uso de Zoom Dinâmico", texto: "Em etiquetas distantes ou pequenas, utilize os botões de atalho (1x, 2x, 4x) ou faça o movimento de pinça na tela para aproximar o foco da câmera." }
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

    async function verificarSeExisteAdmin() {
      try {
        const snap = await getCountFromServer(collection(db, "usuarios"));
        const quantidade = snap.data().count;
        registrarLeituras('bootstrap_usuarios', 0, estimarLeiturasAgregacao(quantidade));
        const bootstrapBox = document.getElementById('bootstrap-box');
        if (quantidade === 0) { bootstrapBox.classList.remove('hidden'); }
        else { bootstrapBox.classList.add('hidden'); }
      } catch (e) { console.log("Aguardando conexão."); }
    }
    verificarSeExisteAdmin();

    document.getElementById('btn-toggle-bootstrap').addEventListener('click', () => {
      modoBootstrapAdmin = !modoBootstrapAdmin;
      const sub = document.getElementById('login-subtitulo');
      const btn = document.getElementById('btn-submit-login');
      const nomeCont = document.getElementById('campo-nome-container');

      if (modoBootstrapAdmin) {
        sub.innerText = "⚡ CONFIGURAÇÃO DO PRIMEIRO ADMINISTRADOR";
        btn.innerText = "⚡ Criar Admin Inicial e Entrar";
        nomeCont.classList.remove('hidden');
        document.getElementById('btn-toggle-bootstrap').innerText = "Voltar para Login Normal";
      } else {
        sub.innerText = "Entre com sua credencial institucional";
        btn.innerText = "🔐 Entrar no Sistema";
        nomeCont.classList.add('hidden');
        document.getElementById('btn-toggle-bootstrap').innerText = "⚡ Nenhum usuário cadastrado? Clique para criar o Administrador inicial";
      }
    });

    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const loginErro = document.getElementById('login-erro');
      loginErro.classList.add('hidden');
      const email = document.getElementById('login-email').value.trim();
      const senha = document.getElementById('login-senha').value;

      try {
        if (modoBootstrapAdmin) {
          const nome = document.getElementById('login-nome').value.trim();
          if (!nome) return alert("Por favor, preencha o nome completo do administrador.");
          const cred = await createUserWithEmailAndPassword(auth, email, senha);
          await setDoc(doc(db, "usuarios", cred.user.uid), { nome, email, perfil: 'admin', divisoesAtribuidas: [] });
          alert("Administrador inicial criado com sucesso!");
        } else {
          const cred = await signInWithEmailAndPassword(auth, email, senha);
          const userDoc = await getDoc(doc(db, "usuarios", cred.user.uid));
          if (!userDoc.exists()) {
            await signOut(auth);
            throw new Error("Acesso negado: Esta conta foi desativada ou removida do sistema.");
          }
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

    document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        registrarLeituras('perfil_usuario', 1);
        if (!userDoc.exists()) {
          await signOut(auth);
          return;
        }
        usuarioLogado = { uid: user.uid, email: user.email, ...userDoc.data() };
        
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-app').classList.remove('hidden');
        atualizarCabecalhoUsuario();
        atualizarCarrossel();
        await alternarAba('dashboard');
      } else {
        encerrarOuvinteTransferencias();
        if (cameraAtiva && html5QrcodeScanner) {
          html5QrcodeScanner.stop().catch(() => {});
          cameraAtiva = false;
        }
        usuarioLogado = null;
        bancoPatrimonio = [];
        bancoUsuarios = [];
        bancoTransferencias = [];
        cachePatrimonios.clear();
        cacheSugestoes.clear();
        catalogoDivisoes.clear();
        usuariosCarregados = false;
        relacaoCarregada = false;
        document.getElementById('view-app').classList.add('hidden');
        document.getElementById('view-login').classList.remove('hidden');
        verificarSeExisteAdmin();
      }
    });

    function atualizarCabecalhoUsuario() {
      document.getElementById('user-info-badge').innerText = `${usuarioLogado.nome} (${usuarioLogado.perfil.toUpperCase()})`;
      document.getElementById('dash-nome').innerText = usuarioLogado.nome;
      document.getElementById('dash-perfil').innerText = `Perfil: ${usuarioLogado.perfil.toUpperCase()}`;
      document.getElementById('dash-divisoes').innerText = usuarioLogado.perfil === 'admin' ? 'Todas (Admin)' : (usuarioLogado.divisoesAtribuidas || []).join(', ') || 'Nenhuma';
      
      const btnTransf = document.getElementById('tab-btn-transferencias');
      const btnUsuarios = document.getElementById('tab-btn-usuarios');
      const campoPerfil = document.getElementById('campo-perfil-container');
      const tituloCad = document.getElementById('titulo-cad-usuario');
      const boxExportacao = document.getElementById('container-botoes-exportacao');
      const panelCiclo = document.getElementById('panel-gestao-ciclo');

      if (usuarioLogado.perfil === 'conferente') {
        btnTransf.classList.add('hidden');
        btnUsuarios.classList.add('hidden');
        if (boxExportacao) boxExportacao.classList.add('hidden');
        if (panelCiclo) panelCiclo.classList.add('hidden');
      } else {
        if (boxExportacao) boxExportacao.classList.remove('hidden');
        if (panelCiclo) panelCiclo.classList.remove('hidden');
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

    async function carregarUsuarios(forcar = false, operacao = 'usuarios_sob_demanda') {
      if (usuariosCarregados && !forcar) {
        renderizarListaUsuarios();
        return bancoUsuarios;
      }

      const consultaUsuarios = usuarioLogado?.perfil === 'gestor'
        ? query(collection(db, "usuarios"), where("perfil", "==", "conferente"))
        : collection(db, "usuarios");
      const snapshot = await getDocs(consultaUsuarios);
      registrarLeituras(operacao, snapshot.size);
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

    async function carregarCatalogoDivisoes() {
      (usuarioLogado?.divisoesAtribuidas || []).forEach(divisao => catalogoDivisoes.add(divisao));
      if (usuarioLogado && usuarioLogado.perfil !== 'conferente' && !usuariosCarregados) {
        await carregarUsuarios(false, 'catalogo_divisoes_por_usuarios');
      } else {
        popularSelectsDivisao();
      }
    }

    async function carregarPatrimoniosPermitidos(operacao) {
      if (!usuarioLogado) return [];
      if (usuarioLogado.perfil === 'admin' || usuarioLogado.perfil === 'gestor') {
        const snapshot = await getDocs(collection(db, "patrimonios"));
        registrarLeituras(operacao, snapshot.size);
        const itens = snapshot.docs.map(normalizarPatrimonio);
        cachearPatrimonios(itens);
        adicionarDivisoesAoCatalogo(itens);
        return itens;
      }

      const divisoes = [...new Set(usuarioLogado.divisoesAtribuidas || [])];
      if (divisoes.length === 0) return [];

      const resultados = new Map();
      let leituras = 0;
      for (const lote of dividirEmLotes(divisoes)) {
        const consulta = query(collection(db, "patrimonios"), or(
          where("divisaoOrigem", "in", lote),
          where("divisao", "in", lote),
          where("localizacaoAtual", "in", lote)
        ));
        const snapshot = await getDocs(consulta);
        leituras += snapshot.size;
        snapshot.docs.map(normalizarPatrimonio).forEach(item => resultados.set(item.plaqueta, item));
      }

      registrarLeituras(operacao, leituras);
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
      const divSet = [...catalogoDivisoes].filter(Boolean).sort((a, b) => a.localeCompare(b));
      if (divSet.length === 0) return;

      const adicionarOpcoesAusentes = (select, filtro = () => true) => {
        if (!select) return;
        const existentes = new Set([...select.options].map(option => option.value));
        divSet.filter(filtro).forEach(divisao => {
          if (existentes.has(divisao)) return;
          const option = document.createElement('option');
          option.value = divisao;
          option.innerText = divisao;
          select.appendChild(option);
        });
      };

      adicionarOpcoesAusentes(selectLocalizacao);
      adicionarOpcoesAusentes(selectFiltro, usuarioTemAcessoDivisao);
      adicionarOpcoesAusentes(selectReversao);

      const marcadasCadastro = new Set([...document.querySelectorAll('input[name="divisao-check"]:checked')].map(cb => cb.value));
      const marcadasEdicao = new Set([...document.querySelectorAll('input[name="edit-divisao-check"]:checked')].map(cb => cb.value));
      const renderizarCheckboxes = (nome, marcadas) => divSet.map(divisao => `
        <label class="flex items-center gap-2 cursor-pointer text-slate-300">
          <input type="checkbox" name="${nome}" value="${divisao}" ${marcadas.has(divisao) ? 'checked' : ''} class="rounded bg-slate-800 border-slate-700">
          <span>${divisao}</span>
        </label>
      `).join('');

      if (checkContainer) checkContainer.innerHTML = renderizarCheckboxes('divisao-check', marcadasCadastro);
      if (editCheckContainer) editCheckContainer.innerHTML = renderizarCheckboxes('edit-divisao-check', marcadasEdicao);
    }

    ['dashboard', 'scanner', 'transferencias', 'usuarios', 'lista'].forEach(aba => {
      const btn = document.getElementById(`tab-btn-${aba}`);
      if (btn) btn.addEventListener('click', () => alternarAba(aba));
    });

    async function alternarAba(abaAtiva) {
      if (usuarioLogado && usuarioLogado.perfil === 'conferente') {
        if (abaAtiva === 'transferencias' || abaAtiva === 'usuarios') {
          return;
        }
      }

      if (abaAtiva !== 'transferencias') encerrarOuvinteTransferencias();
      abaAtual = abaAtiva;

      if (abaAtiva !== 'scanner' && cameraAtiva && html5QrcodeScanner) {
        html5QrcodeScanner.stop().catch(() => {});
        cameraAtiva = false;
        document.getElementById('btn-toggle-cam').innerText = "Ligar Câmera";
        document.getElementById('btn-capturar-frame').classList.add('hidden');
        document.getElementById('camera-controls-bar').classList.add('hidden');
      }

      ['dashboard', 'scanner', 'transferencias', 'usuarios', 'lista'].forEach(aba => {
        const sec = document.getElementById(`sec-${aba}`);
        const btn = document.getElementById(`tab-btn-${aba}`);
        if (sec) sec.classList.toggle('hidden', aba !== abaAtiva);
        if (btn) {
          btn.className = aba === abaAtiva ? "flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold bg-blue-600 text-white transition-all whitespace-nowrap text-center" : "flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold text-slate-400 hover:text-white transition-all whitespace-nowrap text-center";
        }
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
        if (abaAtiva === 'usuarios') await carregarUsuarios();
        if (abaAtiva === 'lista') await carregarRelacaoPatrimonial();
      } catch (erro) {
        console.error(`Erro ao carregar a aba ${abaAtiva}:`, erro);
        alert("Não foi possível carregar os dados desta tela. Verifique sua conexão e tente novamente.");
      }
    }

    function aplicarNumerosDashboard(total, localizados, pendentes, aguardando) {
      document.getElementById('dash-total').innerText = total;
      document.getElementById('dash-localizados').innerText = localizados;
      document.getElementById('dash-pendentes').innerText = pendentes;
      document.getElementById('dash-aguardando').innerText = aguardando;

      const badgeFila = document.getElementById('badge-fila-count');
      if (aguardando > 0 && usuarioLogado.perfil !== 'conferente') {
        badgeFila.innerText = aguardando;
        badgeFila.classList.remove('hidden');
      } else { badgeFila.classList.add('hidden'); }
    }

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
        registrarLeituras('dashboard_agregacoes', 0, estimarLeiturasAgregacao(total, totalMarcadosLocalizados, aguardando));
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
          registrarLeituras('dashboard_conferente_agregacoes', 0, estimarLeiturasAgregacao(total, totalMarcadosLocalizados, aguardando));
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

      const itens = await carregarPatrimoniosPermitidos('dashboard_conferente_fallback');
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

    async function buscarItensDaDivisao(divisao, operacao) {
      const consulta = query(collection(db, "patrimonios"), or(
        where("divisaoOrigem", "==", divisao),
        where("divisao", "==", divisao),
        where("localizacaoAtual", "==", divisao)
      ));
      const snapshot = await getDocs(consulta);
      registrarLeituras(operacao, snapshot.size);
      return snapshot.docs.map(normalizarPatrimonio);
    }

    document.getElementById('btn-reverter-divisao').addEventListener('click', async () => {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return alert("Acesso negado.");
      const divAlvo = document.getElementById('select-divisao-reversao').value;
      if (!divAlvo) return alert("Selecione uma divisão para reverter.");

      if (!confirm(`Deseja realmente retornar todos os itens da divisão '${divAlvo}' para o status PENDENTE? O progresso de conferência deste setor será zerado.`)) return;

      const itensAfetados = await buscarItensDaDivisao(divAlvo, 'reversao_divisao');
      if (itensAfetados.length === 0) return alert("Nenhum item encontrado nesta divisão.");

      try {
        await atualizarItensEmLotes(itensAfetados, {
          localizado: false,
          statusTransferencia: "concluido",
          conferidoPor: "",
          observacaoAtual: "Status revertido para pendente (Novo Ciclo)",
          dataLocalizacao: ""
        });
        relacaoCarregada = false;
        alert(`Sucesso! ${itensAfetados.length} itens da divisão ${divAlvo} foram retornados para pendentes.`);
        document.getElementById('select-divisao-reversao').value = "";
      } catch (e) {
        alert("Erro ao executar reversão setorial.");
      }
    });

    document.getElementById('btn-reverter-geral').addEventListener('click', async () => {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return alert("Acesso negado.");
      if (!confirm("⚠️ ATENÇÃO: Deseja realmente reiniciar o inventário geral? TODOS OS ITENS do sistema retornarão para o status PENDENTE. Esta ação preparará o sistema para um novo ciclo completo.")) return;

      try {
        const snapshot = await getDocs(collection(db, "patrimonios"));
        registrarLeituras('reversao_geral', snapshot.size);
        const itens = snapshot.docs.map(normalizarPatrimonio);
        await atualizarItensEmLotes(itens, {
          localizado: false,
          statusTransferencia: "concluido",
          conferidoPor: "",
          observacaoAtual: "Inventário reiniciado para novo ciclo",
          dataLocalizacao: ""
        });
        relacaoCarregada = false;
        alert("Inventário geral reiniciado com sucesso! Todos os itens estão pendentes.");
      } catch (e) {
        alert("Erro ao reiniciar inventário geral.");
      }
    });

    window.reverterItemIndividual = async function(plaqueta) {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return alert("Acesso negado.");
      if (!confirm(`Deseja retornar o item ${plaqueta} para o status PENDENTE?`)) return;

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
        relacaoCarregada = false;
        alert("Item retornado para pendente com sucesso.");
        document.getElementById('modal-detalhes-item').classList.add('hidden');
      } catch (e) {
        alert("Erro ao reverter item.");
      }
    };

    window.abrirModalCriacaoUsuario = function() {
      document.getElementById('modal-criacao-usuario').classList.remove('hidden');
    }

    window.fecharModalCriacaoUsuario = function() {
      document.getElementById('modal-criacao-usuario').classList.add('hidden');
    }

    document.getElementById('form-cad-usuario').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (usuarioLogado.perfil === 'conferente') return alert("Acesso negado para esta operação.");

      const nome = document.getElementById('cad-nome').value.trim();
      const email = document.getElementById('cad-email').value.trim();
      const senha = document.getElementById('cad-senha').value;
      let perfil = usuarioLogado.perfil === 'gestor' ? 'conferente' : document.getElementById('cad-perfil').value;
      const checkboxes = document.querySelectorAll('input[name="divisao-check"]:checked');
      const divisoes = Array.from(checkboxes).map(cb => cb.value);

      try {
        const cred = await createUserWithEmailAndPassword(authSecundario, email, senha);
        await setDoc(doc(db, "usuarios", cred.user.uid), { nome, email, perfil, divisoesAtribuidas: divisoes });
        await signOut(authSecundario);

        alert(`Colaborador ${nome} cadastrado com sucesso.`);
        document.getElementById('form-cad-usuario').reset();
        document.querySelectorAll('input[name="divisao-check"]').forEach(cb => cb.checked = false);
        fecharModalCriacaoUsuario();
        await carregarUsuarios(true);
      } catch (err) {
        let msg = "Não foi possível concluir o cadastro.";
        if (err.code === 'auth/email-already-in-use') msg = "Este e-mail já está cadastrado no sistema.";
        else if (err.code === 'auth/weak-password') msg = "A senha deve conter pelo menos 6 caracteres.";
        alert(msg);
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
            const podeExcluir = !ehProprio && (usuarioLogado.perfil === 'admin' || (usuarioLogado.perfil === 'gestor' && u.perfil === 'conferente'));

            htmlConsolidado += `
              <div class="bg-slate-800 p-3 rounded-lg border border-slate-700/60 space-y-2 text-xs">
                <div class="space-y-0.5">
                  <div class="font-bold text-white">${u.nome} ${ehProprio ? '(Você)' : ''}</div>
                  <div class="text-[10px] text-slate-400">${u.email}</div>
                  <div class="text-[10px] text-emerald-400">Setores: ${(u.divisaoAtribuidas || u.divisoesAtribuidas || []).join(', ') || 'Nenhum'}</div>
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

    document.getElementById('filtro-busca-usuarios')?.addEventListener('input', renderizarListaUsuarios);

    window.excluirUsuario = async function(uid, nome) {
      const userAlvo = bancoUsuarios.find(u => u.uid === uid);
      if (!userAlvo) return;

      if (usuarioLogado.perfil === 'gestor' && userAlvo.perfil !== 'conferente') {
        return alert("Operação não permitida: Gestores só podem remover usuários com perfil conferente.");
      }

      if (!confirm(`Deseja realmente remover o acesso de ${nome}? Esta ação é irreversível.`)) return;

      try {
        await deleteDoc(doc(db, "usuarios", uid));
        alert("Usuário removido com sucesso.");
        await carregarUsuarios(true);
      } catch (err) {
        alert("Erro ao remover o usuário. Tente novamente.");
      }
    }

    window.abrirModalEdicao = function(uid) {
      const user = bancoUsuarios.find(u => u.uid === uid);
      if (!user) return;

      if (usuarioLogado.perfil === 'gestor') {
        if (user.uid !== usuarioLogado.uid && user.perfil !== 'conferente') {
          return alert("Acesso restrito: Gestores não possuem permissão para editar outros gestores ou administradores.");
        }
      }

      document.getElementById('edit-uid').value = user.uid;
      document.getElementById('edit-nome').value = user.nome || '';
      document.getElementById('edit-email').value = user.email || '';
      
      const perfilSelect = document.getElementById('edit-perfil');
      const campoPerfilEdit = document.getElementById('edit-campo-perfil-container');
      
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

      document.getElementById('modal-edicao-usuario').classList.remove('hidden');
    }

    document.getElementById('btn-fechar-modal').addEventListener('click', () => {
      document.getElementById('modal-edicao-usuario').classList.add('hidden');
    });

    document.getElementById('form-editar-usuario').addEventListener('submit', async (e) => {
      e.preventDefault();
      const uid = document.getElementById('edit-uid').value;
      const nome = document.getElementById('edit-nome').value.trim();
      const targetUser = bancoUsuarios.find(u => u.uid === uid);

      if (!targetUser) return;

      if (usuarioLogado.perfil === 'gestor') {
        if (targetUser.uid !== usuarioLogado.uid && targetUser.perfil !== 'conferente') {
          return alert("Operação negada pelas diretrizes de hierarquia.");
        }
      }

      let perfilNovo = targetUser.perfil;
      if (usuarioLogado.perfil === 'admin') {
        perfilNovo = document.getElementById('edit-perfil').value;
      }

      const checkboxes = document.querySelectorAll('input[name="edit-divisao-check"]:checked');
      const divisoes = Array.from(checkboxes).map(cb => cb.value);

      try {
        await updateDoc(doc(db, "usuarios", uid), {
          nome, perfil: perfilNovo, divisoesAtribuidas: divisoes
        });
        alert("Dados atualizados com sucesso.");
        document.getElementById('modal-edicao-usuario').classList.add('hidden');
        await carregarUsuarios(true);
      } catch (err) {
        alert("Não foi possível salvar as alterações.");
      }
    });

    window.definirZoom = function(fator) {
      nivelZoomAtual = fator;
      document.documentElement.style.setProperty('--camera-zoom', nivelZoomAtual);
    }

    let distanciaInicialPinça = 0;
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2 && cameraAtiva) {
        distanciaInicialPinça = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && cameraAtiva && distanciaInicialPinça > 0) {
        const distanciaAtual = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = distanciaAtual - distanciaInicialPinça;
        if (Math.abs(diff) > 30) {
          if (diff > 0 && nivelZoomAtual < 4) nivelZoomAtual += 0.5;
          else if (diff < 0 && nivelZoomAtual > 1) nivelZoomAtual -= 0.5;
          definirZoom(nivelZoomAtual);
          distanciaInicialPinça = distanciaAtual;
        }
      }
    });

    function preencherEConsultarPlaqueta(codigoLido) {
      const codLimpo = limparPlaqueta(codigoLido);
      if (!codLimpo) return;
      document.getElementById('input-plaqueta').value = codLimpo;
      if (navigator.vibrate) navigator.vibrate(100);
      buscarEExibirItem(codLimpo);
    }

    const inputPlaqueta = document.getElementById('input-plaqueta');
    const suggestionsBox = document.getElementById('suggestions-box');

    inputPlaqueta.addEventListener('input', (e) => {
      const valor = limparPlaqueta(e.target.value);
      clearTimeout(timerAutocomplete);
      if (valor.length < 3) {
        suggestionsBox.classList.add('hidden');
        return;
      }

      timerAutocomplete = setTimeout(async () => {
        try {
          let correspondencias = cacheSugestoes.get(valor);
          if (!correspondencias) {
            const consulta = query(
              collection(db, "patrimonios"),
              orderBy(documentId()),
              startAt(valor),
              endAt(`${valor}\uf8ff`),
              limit(5)
            );
            const snapshot = await getDocs(consulta);
            registrarLeituras('autocomplete', snapshot.size);
            correspondencias = snapshot.docs.map(normalizarPatrimonio);
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

    document.getElementById('btn-toggle-cam').addEventListener('click', async () => {
      const btnCam = document.getElementById('btn-toggle-cam');
      
      if (cameraAtiva) {
        if (html5QrcodeScanner) {
          try { await html5QrcodeScanner.stop(); } catch(e) {}
        }
        cameraAtiva = false;
        document.getElementById('reader').innerText = "Câmera pausada";
        btnCam.innerText = "Ligar Câmera";
        document.getElementById('btn-capturar-frame').classList.add('hidden');
        document.getElementById('camera-controls-bar').classList.add('hidden');
      } else {
        btnCam.innerText = "Iniciando...";
        
        if (!html5QrcodeScanner) {
          html5QrcodeScanner = new Html5Qrcode("reader");
        }

        const config = {
          fps: 15,
          qrbox: { width: 300, height: 150 },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.QR_CODE
          ]
        };

        try {
          await html5QrcodeScanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => { preencherEConsultarPlaqueta(decodedText); },
            (errorMessage) => {}
          );
          
          cameraAtiva = true;
          btnCam.innerText = "Desligar Câmera";
          document.getElementById('btn-capturar-frame').classList.remove('hidden');
          document.getElementById('camera-controls-bar').classList.remove('hidden');
        } catch (err1) {
          try {
            await html5QrcodeScanner.start(
              { facingMode: "user" },
              config,
              (decodedText) => { preencherEConsultarPlaqueta(decodedText); },
              (err) => {}
            );
            cameraAtiva = true;
            btnCam.innerText = "Desligar Câmera";
            document.getElementById('btn-capturar-frame').classList.remove('hidden');
            document.getElementById('camera-controls-bar').classList.remove('hidden');
          } catch (err2) {
            alert("Não foi possível acessar a câmera do dispositivo. Verifique as permissões do navegador.");
            btnCam.innerText = "Ligar Câmera";
          }
        }
      }
    });

    document.getElementById('btn-capturar-frame').addEventListener('click', async () => {
      if (!cameraAtiva || !html5QrcodeScanner) return;
      
      const ocrStatus = document.getElementById('ocr-status');
      ocrStatus.classList.remove('hidden');

      try {
        const videoElement = document.querySelector('#reader video');
        if (!videoElement) {
          ocrStatus.classList.add('hidden');
          return alert("Feed de vídeo indisponível no momento.");
        }

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        const result = await Tesseract.recognize(canvas, 'por+eng', {
          logger: m => {}
        });

        ocrStatus.classList.add('hidden');
        const textoExtraido = result.data.text;
        const numeroLimpo = limparPlaqueta(textoExtraido);

        if (numeroLimpo.length >= 5) {
          preencherEConsultarPlaqueta(numeroLimpo);
          alert(`OCR identificou a plaqueta: ${numeroLimpo}`);
        } else {
          alert("Nenhuma numeração clara foi reconhecida. Tente aproximar a câmera.");
        }
      } catch (e) {
        ocrStatus.classList.add('hidden');
        alert("Erro durante o processamento da imagem por OCR.");
      }
    });

    document.getElementById('btn-buscar').addEventListener('click', () => buscarEExibirItem(limparPlaqueta(inputPlaqueta.value)));

    async function buscarEExibirItem(plaquetaCod) {
      if (!plaquetaCod) return;
      const itemLocal = cachePatrimonios.get(plaquetaCod);
      if (itemLocal) { itemAtualSelecionado = itemLocal; exibirDetalhes(itemLocal); }
      else {
        const docSnap = await getDoc(doc(db, "patrimonios", plaquetaCod));
        registrarLeituras('consulta_plaqueta', 1);
        if (docSnap.exists()) {
          itemAtualSelecionado = normalizarPatrimonio(docSnap);
          cachearPatrimonios([itemAtualSelecionado]);
          adicionarDivisoesAoCatalogo([itemAtualSelecionado]);
          exibirDetalhes(itemAtualSelecionado);
        }
        else { document.getElementById('item-details').classList.add('hidden'); alert(`Patrimônio com a plaqueta ${plaquetaCod} não foi encontrado.`); }
      }
    }

    function exibirDetalhes(item) {
      document.getElementById('item-details').classList.remove('hidden');
      document.getElementById('det-plaqueta').innerText = `Plaqueta: ${item.plaqueta}`;
      document.getElementById('det-descricao').innerText = item.descricao;
      const divisaoOriginal = item.divisaoOrigem || item.divisao;
      document.getElementById('det-divisao').innerText = divisaoOriginal;

      const badgeStatus = document.getElementById('det-status');
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
      verificarAlertaTransferencia(divisaoOriginal, selectLoc.value);
    }

    document.getElementById('select-localizacao').addEventListener('change', (e) => {
      if (!itemAtualSelecionado) return;
      verificarAlertaTransferencia(itemAtualSelecionado.divisaoOrigem || itemAtualSelecionado.divisao, e.target.value);
    });

    function verificarAlertaTransferencia(origem, destino) {
      const alerta = document.getElementById('alerta-transferencia');
      if (origem && destino && origem !== destino) alerta.classList.remove('hidden');
      else alerta.classList.add('hidden');
    }

    document.getElementById('btn-salvar').addEventListener('click', async () => {
      if (!itemAtualSelecionado) return alert("Selecione um patrimônio válido antes de salvar.");
      const locAtual = document.getElementById('select-localizacao').value;
      if (!locAtual) return alert("Selecione a localização atual do item.");

      const divisaoOriginal = itemAtualSelecionado.divisaoOrigem || itemAtualSelecionado.divisao;
      const obs = document.getElementById('input-observacao').value.trim();
      const dataHora = new Date().toLocaleString('pt-BR');
      const ehTransferencia = divisaoOriginal !== locAtual;

      const historicoAtual = itemAtualSelecionado.historico || [];
      historicoAtual.push({ local: locAtual, data: dataHora, responsavel: `${usuarioLogado.nome} (${usuarioLogado.email})`, obs: obs });

      const docRef = doc(db, "patrimonios", itemAtualSelecionado.plaqueta);
      let dadosAtualizacao = {
        localizado: true, divisaoOrigem: divisaoOriginal, observacaoAtual: obs,
        dataLocalizacao: dataHora, conferidoPor: usuarioLogado.email, historico: historicoAtual
      };

      if (ehTransferencia) {
        dadosAtualizacao.statusTransferencia = "pendente";
        dadosAtualizacao.divisaoDestinoSugerida = locAtual;
      } else {
        dadosAtualizacao.localizacaoAtual = locAtual;
        dadosAtualizacao.statusTransferencia = "concluido";
      }

      await updateDoc(docRef, dadosAtualizacao);
      const itemAtualizado = { ...itemAtualSelecionado, ...dadosAtualizacao };
      cachePatrimonios.set(itemAtualizado.plaqueta, itemAtualizado);
      const indiceRelacao = bancoPatrimonio.findIndex(item => item.plaqueta === itemAtualizado.plaqueta);
      if (indiceRelacao >= 0) bancoPatrimonio[indiceRelacao] = itemAtualizado;
      relacaoCarregada = false;
      alert(ehTransferencia ? "⚠️ Item localizado em setor diferente! Enviado para aprovação do Gestor." : "✅ Conferência registrada com sucesso.");
      inputPlaqueta.value = ''; document.getElementById('select-localizacao').value = '';
      document.getElementById('input-observacao').value = ''; document.getElementById('item-details').classList.add('hidden');
      document.getElementById('alerta-transferencia').classList.add('hidden'); itemAtualSelecionado = null;
    });

    function encerrarOuvinteTransferencias() {
      if (unsubscribeTransferencias) {
        unsubscribeTransferencias();
        unsubscribeTransferencias = null;
      }
    }

    function iniciarOuvinteTransferencias() {
      encerrarOuvinteTransferencias();
      primeiraCargaTransferencias = true;
      const consulta = query(collection(db, "patrimonios"), where("statusTransferencia", "==", "pendente"));
      unsubscribeTransferencias = onSnapshot(consulta, snapshot => {
        const leituras = primeiraCargaTransferencias ? snapshot.size : snapshot.docChanges().length;
        registrarLeituras('fila_transferencias_realtime', leituras);
        primeiraCargaTransferencias = false;
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
      contador.innerText = `${pendentes.length} pendentes`;

      if (pendentes.length === 0) {
        container.innerHTML = `<div class="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center text-xs text-slate-400 md:col-span-2">✨ Nenhuma transferência pendente no momento.</div>`;
        return;
      }

      container.innerHTML = pendentes.map(item => `
        <div class="bg-slate-800 p-4 rounded-xl border border-amber-500/30 text-xs space-y-2.5 shadow-md">
          <div class="flex justify-between items-center cursor-pointer" onclick="abrirModalItemPorPlaqueta('${item.plaqueta}')">
            <span class="font-bold text-blue-400 text-sm hover:underline">Plaqueta: ${item.plaqueta} 🔍</span>
            <span class="bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded text-[10px] font-bold">AGUARDANDO</span>
          </div>
          <p class="text-slate-200 text-xs cursor-pointer" onclick="abrirModalItemPorPlaqueta('${item.plaqueta}')">${item.descricao}</p>
          <div class="text-[11px] space-y-1 bg-slate-900 p-2.5 rounded border border-slate-700">
            <div>🏷️ Divisão Anterior: ${item.divisaoOrigem}</div>
            <div>📍 Novo Local: <span class="text-emerald-400 font-bold">${item.divisaoDestinoSugerida}</span></div>
            ${item.observacaoAtual ? `<div class="pt-1 border-t border-slate-800 text-slate-300">💬 <strong class="text-slate-400">Observação:</strong> ${item.observacaoAtual}</div>` : ''}
          </div>
          <div class="flex gap-2 pt-1">
            <button onclick="aprovarTransferencia('${item.plaqueta}', '${item.divisaoDestinoSugerida}')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded text-xs transition-colors">✅ Aprovar</button>
            <button onclick="rejeitarTransferencia('${item.plaqueta}')" class="bg-red-900/60 hover:bg-red-800 text-red-200 font-bold px-4 py-2 rounded text-xs transition-colors">❌ Rejeitar</button>
          </div>
        </div>
      `).join('');
    }

    window.aprovarTransferencia = async function(plaqueta, novaDivisao) {
      if (usuarioLogado.perfil === 'conferente') return alert("Acesso negado para esta operação.");
      if (!confirm(`Deseja aprovar a transferência do patrimônio ${plaqueta} para ${novaDivisao}?`)) return;
      await updateDoc(doc(db, "patrimonios", plaqueta), { localizacaoAtual: novaDivisao, statusTransferencia: "aprovado" });
      relacaoCarregada = false;
      alert("Transferência aprovada com sucesso.");
    }

    window.rejeitarTransferencia = async function(plaqueta) {
      if (usuarioLogado.perfil === 'conferente') return alert("Acesso negado para esta operação.");
      if (!confirm(`Deseja rejeitar esta solicitação de transferência?`)) return;
      let item = cachePatrimonios.get(plaqueta);
      if (!item) {
        const snapshot = await getDoc(doc(db, "patrimonios", plaqueta));
        registrarLeituras('rejeitar_transferencia', 1);
        if (!snapshot.exists()) return alert("Patrimônio não encontrado.");
        item = normalizarPatrimonio(snapshot);
      }
      await updateDoc(doc(db, "patrimonios", plaqueta), { localizacaoAtual: item.divisaoOrigem, statusTransferencia: "rejeitado" });
      relacaoCarregada = false;
      alert("Transferência rejeitada.");
    }

    window.abrirModalItemPorPlaqueta = async function(plaqueta) {
      let item = cachePatrimonios.get(plaqueta);
      if (!item) {
        const snapshot = await getDoc(doc(db, "patrimonios", plaqueta));
        registrarLeituras('detalhe_patrimonio', 1);
        if (!snapshot.exists()) return;
        item = normalizarPatrimonio(snapshot);
        cachearPatrimonios([item]);
      }

      const modal = document.getElementById('modal-detalhes-item');
      const conteudo = document.getElementById('modal-item-conteudo');
      const divisaoAnterior = item.divisaoOrigem || item.divisao;
      const ehAdminOuGestor = usuarioLogado && usuarioLogado.perfil !== 'conferente';

      conteudo.innerHTML = `
        <div class="space-y-2.5">
          <div class="flex justify-between items-center">
            <span class="font-bold text-blue-400 text-sm">Plaqueta: ${item.plaqueta}</span>
            <span class="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${item.statusTransferencia === 'pendente' ? 'bg-amber-900 text-amber-300' : (item.localizado ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-700 text-slate-300')}">
              ${item.statusTransferencia === 'pendente' ? '⏳ AGUARDANDO TRANSF.' : (item.localizado ? '🟢 LOCALIZADO' : '🔴 PENDENTE')}
            </span>
          </div>
          <div><strong class="text-slate-400">Descrição:</strong> <span class="text-slate-200">${item.descricao}</span></div>
          <div><strong class="text-slate-400">🏷️ Divisão Anterior:</strong> <span class="text-amber-400 font-semibold">${divisaoAnterior}</span></div>
          <div><strong class="text-slate-400">📍 Local Atual / Sugerido:</strong> <span class="text-emerald-400 font-semibold">${item.divisaoDestinoSugerida || item.localizacaoAtual || divisaoAnterior}</span></div>
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
                  <div class="text-slate-400 text-[10px]">Por: ${h.responsavel}${h.obs ? `| Obs: ${h.obs}` : ''}</div>
                </div>
              `).join('') : '<div class="text-slate-400 text-xs italic">Nenhum registro histórico adicional.</div>'}
            </div>
          </div>
        </div>
      `;
      modal.classList.remove('hidden');
    }

    document.getElementById('btn-fechar-modal-item').addEventListener('click', () => {
      document.getElementById('modal-detalhes-item').classList.add('hidden');
    });

    async function carregarRelacaoPatrimonial(forcar = false) {
      if (relacaoCarregada && !forcar) {
        renderizarRelaçãoBD();
        return;
      }

      const container = document.getElementById('container-accordions');
      container.innerHTML = `<div class="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center text-xs text-slate-400">Carregando relação patrimonial sob demanda…</div>`;
      bancoPatrimonio = await carregarPatrimoniosPermitidos('relacao_patrimonial');
      relacaoCarregada = true;
      renderizarRelaçãoBD();
    }

    function renderizarRelaçãoBD() {
      const container = document.getElementById('container-accordions');
      if (!container || !usuarioLogado) return;

      const termo = document.getElementById('filtro-busca').value.toLowerCase();
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
        const matchTermo = i.plaqueta.includes(termo) || i.descricao.toLowerCase().includes(termo);
        const matchStatus = statusFiltro === 'todos' || (statusFiltro === 'localizados' ? i.localizado : !i.localizado);
        const matchDivisao = divisaoFiltro === 'todas' || atual === divisaoFiltro;
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
      
      Object.keys(gruposTotal).sort().forEach((divNome, idx) => {
        const todosDaDiv = gruposTotal[divNome];
        const visiveisDaDiv = gruposFiltrados[divNome] || [];
        
        if (visiveisDaDiv.length === 0 && (termo || statusFiltro !== 'todos' || divisaoFiltro !== 'todas')) return;

        const locCount = todosDaDiv.filter(i => i.localizado).length;
        const totalCount = todosDaDiv.length;

        const accordion = document.createElement('div');
        accordion.className = "bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-md";
        accordion.innerHTML = `
          <button onclick="document.getElementById('acc-${idx}').classList.toggle('collapsed')" class="w-full flex justify-between items-center p-3.5 text-left font-bold text-xs md:text-sm bg-slate-800 border-b border-slate-700/50 hover:bg-slate-750 transition-colors">
            <span class="text-blue-400 font-semibold">📁 ${divNome} (${totalCount})</span>
            <span class="text-xs ${locCount === totalCount ? 'text-emerald-400' : 'text-amber-400'}">${locCount}/${totalCount} Localizados</span>
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
    }

    document.getElementById('filtro-busca').addEventListener('input', renderizarRelaçãoBD);
    document.getElementById('filtro-status').addEventListener('change', renderizarRelaçãoBD);
    document.getElementById('filtro-divisao').addEventListener('change', renderizarRelaçãoBD);
    document.getElementById('btn-atualizar-relacao')?.addEventListener('click', () => carregarRelacaoPatrimonial(true));

    document.getElementById('btn-exportar-csv').addEventListener('click', () => exportarCSV(bancoPatrimonio, 'relatorio_geral'));
    document.getElementById('btn-exportar-divergencias').addEventListener('click', () => exportarCSV(bancoPatrimonio.filter(i => !i.localizado), 'relatorio_pendentes'));
    document.getElementById('btn-exportar-filtrados').addEventListener('click', () => exportarCSV(itensFiltradosCache, 'relatorio_filtrado'));

    function exportarCSV(dados, nomeArquivo) {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return alert("Acesso negado para esta operação.");
      if (dados.length === 0) return alert("Não há registros disponíveis para exportação com os filtros atuais.");
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
