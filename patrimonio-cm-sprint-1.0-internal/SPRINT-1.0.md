# Sprint 1.0 — experiência visual e navegação responsiva

## Versão

- Aplicação: `v1.10.0`
- Sprint: `1.0`

## Objetivo

Consolidar uma interface mobile-first mais agradável e previsível, ampliar o aproveitamento da tela no desktop e padronizar navegação, feedback e ações sem alterar as regras de negócio ou as regras publicadas do Firestore.

## Entregas

- Novo shell inspirado em painéis administrativos:
  - sidebar fixa e recolhível no desktop;
  - menu lateral acionado por hambúrguer e sobreposição no mobile;
  - indicação visual da página ativa;
  - barra superior compacta com título, breadcrumbs, usuário e ação de saída;
  - fechamento por `Esc`, clique externo ou escolha de uma página.
- Identidade consolidada como `CM APP`, mantendo `Patrimônio` como módulo atual.
- Avatar circular com iniciais no menu, barra superior e Painel. Foto real e preferências continuam previstas para a Sprint 1.1.
- Painel reorganizado em cartões de indicadores acionáveis, progresso do inventário, resumo do perfil e orientações.
- Remoção completa do painel e do código de métricas locais do Firebase. O Console do Firebase permanece como fonte oficial.
- Mensagens não bloqueantes em toasts acessíveis, com variações de sucesso, aviso, erro e informação.
- Confirmações destrutivas em modal próprio, substituindo `alert()` e `confirm()` do navegador.
- Botão `X` para limpar:
  - plaqueta na tela de Leitura;
  - pesquisa de usuários;
  - pesquisa por plaqueta na Relação.
- Fila agrupada alfabeticamente pela divisão de destino com `<details>` e `<summary>`.
- Itens da Fila ordenados por plaqueta dentro de cada divisão.
- `Gestão de Ciclo e Inventário` inicia expandida.
- Ordenação alfabética das divisões na Relação preservada com comparação em português.
- Acessibilidade adicional:
  - link para pular ao conteúdo;
  - regiões de navegação nomeadas;
  - `aria-current` na página ativa;
  - estados expandidos no menu e no perfil;
  - respeito a movimento reduzido nas novas transições.

## Comportamento responsivo

- Abaixo de 1024 px, a sidebar funciona como gaveta e não ocupa largura permanente.
- A partir de 1024 px, a sidebar permanece visível e pode ser recolhida; a preferência fica armazenada no navegador.
- Indicadores reorganizam-se em duas colunas no mobile e quatro no desktop.
- Cartões da Fila usam uma coluna em telas menores e duas dentro do agrupamento em telas amplas.
- Conteúdo principal usa largura máxima para evitar linhas excessivamente longas em monitores grandes.

## Decisões preservadas

- A paginação da Relação continua em 50 documentos.
- Não existe botão `Carregar tudo`.
- Depois que todas as páginas são carregadas, filtros usam a base completa mantida na sessão.
- `Atualizar dados da relação` permanece disponível também para Conferentes.
- Gestores e Administradores validam mudanças de localização diretamente.
- Conferentes continuam enviando divergências para a Fila.
- O fluxo de câmera e OCR aprovado na Sprint 0.9 foi preservado.
- Notificações desta sprint são internas ao app; push notifications dependem da futura etapa de PWA.

## Firestore

Não há mudanças nas coleções, consultas de negócio, índices nem regras. O arquivo `firestore.rules` é byte a byte igual ao da Sprint 0.9. Se as regras seguras anteriores já estiverem publicadas, não é necessário republicá-las.

## Testes automatizados

Executar na pasta pública:

```bash
node --test tests/*.test.mjs
```

A suíte cobre 21 verificações, incluindo:

- regras determinísticas de câmera e OCR;
- IDs estáticos consultados pelos módulos;
- versão visível;
- presença do shell, breadcrumbs, perfil e feedback;
- presença dos três botões de limpeza;
- ausência de `alert()`, `confirm()` e métricas locais;
- agrupamento semântico da Fila e ordenação em português.

## Checklist manual

1. Entrar como Conferente em celular e desktop.
2. Abrir e fechar o menu; confirmar que apenas Painel, Leitura e Relação estão disponíveis.
3. Recolher a sidebar no desktop, recarregar a página e confirmar a persistência.
4. Navegar entre as telas e conferir título, breadcrumb e item ativo.
5. Testar os três botões `X`, verificando restauração da lista ou formulário correspondente.
6. Confirmar que o botão `Atualizar dados da relação` continua disponível ao Conferente.
7. Entrar como Gestor ou Administrador e validar Administração e Fila.
8. Confirmar que Gestão de Ciclo inicia expandida.
9. Criar pendências em divisões diferentes e conferir agrupamento alfabético recolhível.
10. Aprovar e rejeitar uma transferência usando o novo diálogo.
11. Executar ações de sucesso e erro e conferir toasts sem bloqueio da interface.
12. Confirmar que o painel de métricas do Firebase não existe mais.
13. Repetir o fluxo de câmera, OCR, recorte e rolagem aprovado na Sprint 0.9.

## Próximas sprints

- Sprint 1.1: perfil, foto, alteração da própria senha e redefinição de senha pelo Administrador.
- Sprint 1.2: PWA instalável em modo `standalone`.
- Sprint 1.3: segurança e operações administrativas em backend confiável.
- Sprint 1.4: observabilidade baseada em fontes oficiais.
- Sprint 2.0: consolidação final da refatoração.

## Arquivos públicos

- `index.html`
- `app.js`
- `app.css`
- `assets/favicon.svg`
- `js/config/firebase.js`
- `js/controllers/camera.controller.js`
- `js/core/camera.js`
- `js/core/movimentacao.js`
- `js/services/divisoes.service.js`
- `js/ui/feedback.js`
- `js/ui/navigation.js`
- `tests/camera.test.mjs`
- `tests/estrutura.test.mjs`

## Arquivos internos

- `firestore.rules`
- `FIRESTORE-SETUP.md`
- `DECISOES-DE-PROJETO.md`
- `SPRINT-1.0.md`

Os arquivos internos não integram o pacote destinado ao repositório público.
