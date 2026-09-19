# Patrimônio CM — Sprint 0.2

## Objetivo

Eliminar os listeners globais iniciados no login e aproximar o consumo do Firestore dos dados realmente utilizados em cada tela.

## Alterações implementadas

- Login carrega somente o documento do usuário autenticado.
- Dashboard de Admin e Gestor usa três agregações `count()` do Firestore.
- Dashboard de Conferente também usa agregações filtradas pelas divisões atribuídas quando possui até dez divisões.
- Scanner consulta a plaqueta diretamente pelo ID do documento.
- Autocomplete inicia após três dígitos, usa debounce de 400 ms, limita a cinco resultados e mantém cache durante a sessão.
- Relação patrimonial é carregada somente ao abrir a aba.
- Botão `Atualizar dados da relação` permite recarregar a tela deliberadamente.
- Administração carrega usuários somente ao abrir a aba.
- Gestor consulta somente conferentes, além de usar o próprio perfil já carregado.
- Fila mantém um listener apenas para patrimônios com `statusTransferencia == "pendente"`.
- O listener da fila é cancelado ao sair da aba.
- Reversões setoriais consultam apenas os documentos relacionados à divisão selecionada.
- Reinício geral lê a coleção somente após confirmação explícita do usuário.
- Gravações em lote foram divididas em blocos de até 450 documentos.
- O Dashboard mostra uma estimativa do consumo da sessão.
- `window.obterMetricasFirestore()` disponibiliza o detalhamento das leituras no console do navegador.

## Orçamento esperado

### Admin ou Gestor — login e Dashboard

- 1 leitura do perfil.
- 3 consultas agregadas.
- Nenhuma leitura da coleção completa de patrimônios.
- Nenhum listener global.

### Conferente — login e Dashboard

- 1 leitura do perfil.
- 3 consultas agregadas filtradas pelas divisões atribuídas.
- Se o perfil possuir mais de dez divisões, o sistema usa uma consulta documental segmentada como fallback.

### Consulta de plaqueta

- 1 leitura na primeira consulta.
- 0 leituras adicionais para a mesma plaqueta enquanto estiver no cache da sessão.

### Autocomplete

- Somente após três dígitos.
- Máximo de cinco documentos por consulta.
- Prefixos repetidos são atendidos pelo cache da sessão.

### Fila de transferências

- Lê somente patrimônios pendentes.
- Permanece em tempo real somente enquanto a aba estiver aberta.

### Relação patrimonial

- Nenhuma leitura enquanto a aba não for aberta.
- A versão atual ainda carrega os itens permitidos de uma vez ao abrir a tela.
- Paginação por cursor será a evolução recomendada para a próxima sprint.

## Como executar

Mantenha estes arquivos na mesma pasta:

- `index.html`
- `app.css`
- `app.js`

Sirva a pasta por HTTP. Exemplo:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Testes manuais

1. Entrar com Admin, Gestor e Conferente.
2. Conferir os quatro indicadores do Dashboard.
3. Abrir o console e executar `obterMetricasFirestore()`.
4. Consultar uma plaqueta duas vezes e verificar que a segunda usa o cache.
5. Digitar três ou mais números e validar o autocomplete.
6. Abrir e fechar a Fila, validando que as transferências continuam atualizando enquanto a aba está aberta.
7. Abrir Administração e validar cadastro, edição e desativação de acesso.
8. Abrir Relação, aplicar filtros e usar o botão de atualização.
9. Registrar uma conferência e validar Dashboard, Fila e Relação.
10. Testar reversão individual, por divisão e geral em ambiente de homologação.

## Fora do escopo desta sprint

- Novo modelo de ciclos de inventário.
- Coleção própria de transferências.
- Histórico imutável de auditoria.
- Custom Claims e novas Security Rules.
- Paginação da Relação.
- Substituição de `innerHTML`, `alert()` e `confirm()`.
