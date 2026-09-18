    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
    import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    let html5QrcodeScanner = null;
    let cameraAtiva = false;
    let itemAtualSelecionado = null;
    let modoBootstrapAdmin = false;
    let nivelZoomAtual = 1;
    let itensFiltradosCache = [];

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
        const snap = await getDocs(collection(db, "usuarios"));
        const bootstrapBox = document.getElementById('bootstrap-box');
        if (snap.empty) { bootstrapBox.classList.remove('hidden'); }
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
        if (!userDoc.exists()) {
          await signOut(auth);
          return;
        }
        usuarioLogado = { uid: user.uid, email: user.email, ...userDoc.data() };
        
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-app').classList.remove('hidden');
        atualizarCabecalhoUsuario();
        iniciarOuvintes();
        atualizarCarrossel();
      } else {
        if (cameraAtiva && html5QrcodeScanner) {
          html5QrcodeScanner.stop().catch(() => {});
          cameraAtiva = false;
        }
        usuarioLogado = null;
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

    function iniciarOuvintes() {
      onSnapshot(collection(db, "patrimonios"), (snapshot) => {
        bancoPatrimonio = [];
        snapshot.forEach(docSnap => bancoPatrimonio.push({ id: docSnap.id, ...docSnap.data() }));
        popularSelectsDivisao();
        atualizarDashboard();
        renderizarRelaçãoBD();
        renderizarFilaTransferencias();
      });

      onSnapshot(collection(db, "usuarios"), (snapshot) => {
        bancoUsuarios = [];
        snapshot.forEach(docSnap => bancoUsuarios.push({ uid: docSnap.id, ...docSnap.data() }));
        renderizarListaUsuarios();
      });
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

      if (bancoPatrimonio.length > 0) {
        const divSet = [...new Set(bancoPatrimonio.map(i => i.divisaoOrigem || i.divisao))].sort();

        if (selectLocalizacao.options.length <= 1) {
          divSet.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d; opt.innerText = d;
            selectLocalizacao.appendChild(opt);
          });
        }

        if (selectFiltro.options.length <= 1) {
          divSet.forEach(d => {
            if (usuarioTemAcessoDivisao(d)) {
              const opt = document.createElement('option');
              opt.value = d; opt.innerText = d;
              selectFiltro.appendChild(opt);
            }
          });
        }

        if (selectReversao && selectReversao.options.length <= 1) {
          divSet.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d; opt.innerText = d;
            selectReversao.appendChild(opt);
          });
        }

        const htmlCheckboxes = divSet.map(d => `
          <label class="flex items-center gap-2 cursor-pointer text-slate-300">
            <input type="checkbox" name="divisao-check" value="${d}" class="rounded bg-slate-800 border-slate-700">
            <span>${d}</span>
          </label>
        `).join('');

        if (checkContainer && checkContainer.children.length === 0) checkContainer.innerHTML = htmlCheckboxes;
        if (editCheckContainer && editCheckContainer.children.length === 0) editCheckContainer.innerHTML = divSet.map(d => `
          <label class="flex items-center gap-2 cursor-pointer text-slate-300">
            <input type="checkbox" name="edit-divisao-check" value="${d}" class="rounded bg-slate-800 border-slate-700">
            <span>${d}</span>
          </label>
        `).join('');
      }
    }

    ['dashboard', 'scanner', 'transferencias', 'usuarios', 'lista'].forEach(aba => {
      const btn = document.getElementById(`tab-btn-${aba}`);
      if (btn) btn.addEventListener('click', () => alternarAba(aba));
    });

    function alternarAba(abaAtiva) {
      if (usuarioLogado && usuarioLogado.perfil === 'conferente') {
        if (abaAtiva === 'transferencias' || abaAtiva === 'usuarios') {
          return;
        }
      }

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
    }

    function atualizarDashboard() {
      if (!usuarioLogado) return;
      const minhasDivs = usuarioLogado.divisoesAtribuidas || [];

      const itensFiltrados = bancoPatrimonio.filter(i => {
        if (usuarioLogado.perfil === 'admin' || usuarioLogado.perfil === 'gestor') return true;
        const origem = i.divisaoOrigem || i.divisao;
        const atual = i.localizacaoAtual || origem;
        return minhasDivs.includes(origem) || minhasDivs.includes(atual);
      });

      const total = itensFiltrados.length;
      const localizados = itensFiltrados.filter(i => i.localizado && i.statusTransferencia !== 'pendente').length;
      const pendentes = itensFiltrados.filter(i => !i.localizado).length;
      const aguardando = bancoPatrimonio.filter(i => i.statusTransferencia === 'pendente').length;

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

    document.getElementById('btn-reverter-divisao').addEventListener('click', async () => {
      if (!usuarioLogado || usuarioLogado.perfil === 'conferente') return alert("Acesso negado.");
      const divAlvo = document.getElementById('select-divisao-reversao').value;
      if (!divAlvo) return alert("Selecione uma divisão para reverter.");

      if (!confirm(`Deseja realmente retornar todos os itens da divisão '${divAlvo}' para o status PENDENTE? O progresso de conferência deste setor será zerado.`)) return;

      const itensAfetados = bancoPatrimonio.filter(i => (i.divisaoOrigem || i.divisao) === divAlvo || i.localizacaoAtual === divAlvo);
      if (itensAfetados.length === 0) return alert("Nenhum item encontrado nesta divisão.");

      try {
        const batch = writeBatch(db);
        itensAfetados.forEach(item => {
          const ref = doc(db, "patrimonios", item.plaqueta);
          batch.update(ref, {
            localizado: false,
            statusTransferencia: "concluido",
            conferidoPor: "",
            observacaoAtual: "Status revertido para pendente (Novo Ciclo)",
            dataLocalizacao: ""
          });
        });
        await batch.commit();
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
        const batch = writeBatch(db);
        bancoPatrimonio.forEach(item => {
          const ref = doc(db, "patrimonios", item.plaqueta);
          batch.update(ref, {
            localizado: false,
            statusTransferencia: "concluido",
            conferidoPor: "",
            observacaoAtual: "Inventário reiniciado para novo ciclo",
            dataLocalizacao: ""
          });
        });
        await batch.commit();
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
      if (!valor || bancoPatrimonio.length === 0) { suggestionsBox.classList.add('hidden'); return; }
      const correspondencias = bancoPatrimonio.filter(i => i.plaqueta.includes(valor)).slice(0, 5);
      if (correspondencias.length > 0) {
        suggestionsBox.innerHTML = correspondencias.map(i => `
          <div class="p-2 hover:bg-slate-700 cursor-pointer text-xs border-b border-slate-700/50 flex justify-between" data-plaqueta="${i.plaqueta}">
            <span class="font-bold text-blue-400">${i.plaqueta}</span>
            <span class="text-slate-400 truncate max-w-[180px]">${i.descricao}</span>
          </div>
        `).join('');
        suggestionsBox.classList.remove('hidden');
      } else { suggestionsBox.classList.add('hidden'); }
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
      const itemLocal = bancoPatrimonio.find(i => i.plaqueta === plaquetaCod);
      if (itemLocal) { itemAtualSelecionado = itemLocal; exibirDetalhes(itemLocal); }
      else {
        const docSnap = await getDoc(doc(db, "patrimonios", plaquetaCod));
        if (docSnap.exists()) { itemAtualSelecionado = { id: docSnap.id, ...docSnap.data() }; exibirDetalhes(itemAtualSelecionado); }
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
      alert(ehTransferencia ? "⚠️ Item localizado em setor diferente! Enviado para aprovação do Gestor." : "✅ Conferência registrada com sucesso.");
      inputPlaqueta.value = ''; document.getElementById('select-localizacao').value = '';
      document.getElementById('input-observacao').value = ''; document.getElementById('item-details').classList.add('hidden');
      document.getElementById('alerta-transferencia').classList.add('hidden'); itemAtualSelecionado = null;
    });

    function renderizarFilaTransferencias() {
      const container = document.getElementById('container-transferencias');
      const contador = document.getElementById('transf-contador');
      if (!container) return;

      const pendentes = bancoPatrimonio.filter(i => i.statusTransferencia === 'pendente');
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
      alert("Transferência aprovada com sucesso.");
    }

    window.rejeitarTransferencia = async function(plaqueta) {
      if (usuarioLogado.perfil === 'conferente') return alert("Acesso negado para esta operação.");
      if (!confirm(`Deseja rejeitar esta solicitação de transferência?`)) return;
      const item = bancoPatrimonio.find(i => i.plaqueta === plaqueta);
      await updateDoc(doc(db, "patrimonios", plaqueta), { localizacaoAtual: item.divisaoOrigem, statusTransferencia: "rejeitado" });
      alert("Transferência rejeitada.");
    }

    window.abrirModalItemPorPlaqueta = function(plaqueta) {
      const item = bancoPatrimonio.find(i => i.plaqueta === plaqueta);
      if (!item) return;

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
