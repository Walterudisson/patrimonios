# CM APP — decisões e próximos passos

## Identidade do produto

- O nome genérico da aplicação no navegador passa a ser `CM APP`.
- `Patrimônio` continua sendo o módulo atual e pode conservar sua identificação dentro da interface.
- O favicon foi iniciado nesta sprint. Manifesto, ícones instaláveis e service worker ficam para uma etapa futura de PWA.
- Quando o PWA for implementado, usar modo instalado `standalone` para ocultar a interface de navegação do navegador e aproximar a experiência visual de um aplicativo. Em uma aba comum, a barra continua sob controle do navegador.

## Perfil do usuário e credenciais

- Adicionar foto de perfil circular ao lado do nome no Painel, junto do perfil e da abrangência/divisões de atuação.
- Permitir que cada usuário autenticado altere a própria senha, com reautenticação quando exigida pelo Firebase.
- Adicionar, exclusivamente para o Administrador, uma ação na lista de usuários para enviar ao e-mail cadastrado o fluxo de redefinição de senha.
- Na mesma etapa, configurar e revisar no Firebase o modelo do e-mail de redefinição, nome do remetente, domínio/link de ação, identidade visual e textos em português.
- Não armazenar senhas no documento `usuarios`; credenciais e redefinições continuam sob responsabilidade do Firebase Authentication.

## Catálogo de divisões

- A divisão temporária `CM/DIVISÃOdeTESTE` foi removida manualmente do Firestore.
- `divisoes` permanece como catálogo somente de leitura no app.
- Um CRUD completo só deverá ser retomado junto de regras para criação, renomeação, desativação, auditoria e tratamento de vínculos existentes.

## Papéis e divisões

- Administrador e Gestor têm abrangência global no módulo de patrimônio.
- `divisoesAtribuidas` tem significado somente para Conferentes.
- Gestor pode editar apenas o próprio nome; não pode alterar o próprio perfil ou divisões.
- A normalização dos Gestores antigos foi concluída pelo Administrador; os registros agora usam `divisoesAtribuidas: []`.

## Relação e leituras

- A paginação de 50 documentos permanece como comportamento padrão.
- Depois de o usuário carregar todas as páginas, a base completa é preservada na sessão e os filtros passam a ser locais.
- Não será criado botão “Carregar tudo”. A paginação permanece como mecanismo oficial de controle de leituras, tráfego e memória.
- A partir da Sprint 0.6, `Atualizar dados da relação` fica separado das exportações e disponível também para Conferentes. Exportações permanecem restritas a Administrador e Gestor.

## Validação de movimentações

- Uma mudança de localização registrada por Administrador ou Gestor é efetivada imediatamente, sem gerar pendência na Fila, pois esses perfis exercem a validação patrimonial.
- O Conferente continua gerando pendência quando informa localização diferente da divisão de origem/responsabilidade.
- A atualização gerencial deve preservar a divisão histórica de origem, atualizar apenas a localização/responsabilidade atual e acrescentar o registro correspondente ao histórico.
- A detecção de mudança compara o destino informado com `localizacaoAtual` quando ela existir; `divisaoOrigem` permanece como referência histórica.
- Ao rejeitar uma transferência, manter `localizacaoAtual`, limpar `divisaoDestinoSugerida` e registrar a decisão no histórico.
- Ao aprovar, promover o destino sugerido para `localizacaoAtual`, limpar a sugestão e registrar a decisão no histórico.
- O modal apresenta “Local sugerido” somente enquanto a transferência estiver pendente; nos demais estados, apresenta separadamente o local efetivo.

## Câmera e leitura

- A Sprint 0.8 implementa inicialização controlada, seleção e memorização da câmera, preferência pela câmera traseira, foco contínuo, zoom físico quando suportado e aproximação visual como alternativa.
- Lanterna, foco e zoom são exibidos conforme as capacidades informadas pelo dispositivo; a ausência de um recurso não bloqueia a leitura.
- A leitura bem-sucedida pausa o scanner para evitar duplicidades e oferece ação explícita para ler outra plaqueta.
- A câmera é liberada ao trocar de aba, sair da conta ou colocar o app em segundo plano, com retomada ao voltar quando apropriado.
- Mudanças de orientação reinicializam o enquadramento do scanner.
- O OCR usa o recorte central em escala de cinza e com contraste ampliado, mostra progresso e procura candidatos numéricos plausíveis.
- Manter digitação manual e OCR como alternativas quando a leitura óptica não for suficiente.
- Na Sprint 0.9, a rolagem até o visor acontece somente quando o usuário solicita `Ligar Câmera`; reinicializações técnicas não deslocam a tela.
- Após código de barras ou OCR reconhecer uma plaqueta, o scanner pausa, preserva um recorte estático ampliado da região central e rola até o painel de resultado posicionado imediatamente antes do formulário.
- O recorte mantém pouca imagem além da região anteriormente delimitada pela moldura azul. Não há número ou caixa desenhados sobre a imagem, pois a plaqueta já aparece no cabeçalho do resultado.
- O aviso laranja de câmera pausada permanece disponível para pausas manuais e processamento, mas é ocultado após o reconhecimento porque o painel de resultado já comunica esse estado.
- Depois de dez segundos sem resultado, o app oferece `Usar OCR`, `Digitar plaqueta` e `Continuar tentando`. A simples exibição dessa ajuda não interrompe o scanner.
- Ao escolher digitação manual, o scanner pausa para evitar que uma leitura automática substitua o que está sendo digitado; a retomada continua disponível.
- A orquestração de câmera, OCR, ciclo de vida, ajuda e apresentação do resultado reside em `js/controllers/camera.controller.js`; regras determinísticas permanecem em `js/core/camera.js`.
- A suíte pública em `tests/` pode ser executada com `node --test tests/*.test.mjs` e cobre regras da câmera, estrutura da integração e presença dos controles no HTML.

## Layout responsivo

- A Sprint 1.0 adota um shell mobile-first inspirado em painéis administrativos, sem incorporar o AdminLTE como dependência.
- No mobile, a navegação funciona como gaveta lateral acionada por hambúrguer; no desktop, a sidebar permanece visível, pode ser recolhida e memoriza essa preferência localmente.
- A barra superior concentra título, breadcrumbs e acesso ao perfil; a navegação exibe somente as opções autorizadas e identifica a tela ativa.
- O avatar usa iniciais como alternativa temporária. Foto real, preferências e credenciais ficam para a Sprint 1.1.
- O conteúdo principal possui largura máxima e grades responsivas para aproveitar o desktop sem prejudicar a leitura.
- `GESTÃO DE CICLO E INVENTÁRIO` inicia expandida.
- A Fila agrupa pendências por divisão em ordem alfabética usando `<details>` e `<summary>`; as plaquetas também são ordenadas dentro de cada grupo.
- Leitura, usuários e Relação possuem botão `X` para limpar a pesquisa e restaurar o estado correspondente.
- Continuar revisando a experiência em dispositivos reais durante as próximas sprints, mantendo mobile-first e suporte completo ao desktop.

## Feedback e notificações

- As caixas nativas `alert()` e `confirm()` foram substituídas na Sprint 1.0 por toasts e diálogos internos, com estados acessíveis e linguagem mais clara.
- Toasts são usados para resultados, avisos e erros que não exigem decisão imediata.
- Ações destrutivas ou sensíveis usam diálogo de confirmação com ação principal explícita.
- Esses avisos existem enquanto o app está aberto e não são push notifications do sistema operacional.
- Push notifications, permissões, service worker e comportamento em segundo plano serão avaliados junto da Sprint 1.2 de PWA.

## Métricas do Firestore

- O painel e o rastreamento local de métricas foram removidos na Sprint 1.0.
- O Console/relatório de faturamento do Firebase é a fonte oficial de leituras, gravações e custos.
- Uma futura etapa de observabilidade deve consumir fontes confiáveis e não recriar estimativas locais de sessão como se fossem equivalentes ao faturamento.

## Cronograma preservado

- Sprint 1.1: perfil, foto, alteração da própria senha e redefinição de senha pelo Administrador, incluindo personalização dos e-mails do Firebase.
- Sprint 1.2: PWA instalável em modo `standalone`, manifesto, ícones e avaliação de push notifications.
- Sprint 1.3: operações administrativas sensíveis em backend confiável.
- Sprint 1.4: observabilidade com fontes oficiais.
- Sprint 2.0: consolidação final da refatoração.

## Repositório e publicação

- O pacote público não inclui regras, decisões, notas de sprint ou instruções operacionais.
- Esses documentos permanecem como documentação interna, fora do pacote de deploy.
- A segurança não depende de ocultar a configuração web do Firebase ou as regras; depende de regras publicadas corretamente, autenticação e negação por padrão.
