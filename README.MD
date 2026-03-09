# WebGreeter Theme (Corporate)

Tema básico e funcional para WebGreeter usando **HTML, CSS e JavaScript** com integração da API (`window.lightdm`).

## Estrutura

- `index.html`: interface de login com campos de usuário e senha
- `styles.css`: visual corporativo simples e responsivo
- `script.js`: fluxo de autenticação via API do WebGreeter

## Funcionalidades

- Formulário com dois campos: **usuário** e **senha**
- Chamada de autenticação com `lightdm.authenticate(username)`
- Envio de senha com `lightdm.respond(password)`
- Tratamento de callbacks padrão:
  - `show_prompt`
  - `show_message`
  - `authentication_complete`
- Início de sessão após autenticação: `lightdm.start_session_sync()`

## Observação

Se você abrir esse tema diretamente no navegador comum, verá aviso de API ausente. O funcionamento completo acontece dentro do WebGreeter.
