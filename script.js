const form = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const message = document.getElementById("message");

let pendingUsername = "";
let pendingPassword = "";

function appendMessage(text, isError = false) {
  if (!text) {
    return;
  }

  const line = document.createElement("p");
  line.className = "message-line";

  if (isError) {
    line.classList.add("error");
  }

  line.textContent = text;
  message.append(line);
  message.scrollTop = message.scrollHeight;
}

function resetFormAfterFail() {
  passwordInput.value = "";
  passwordInput.focus();
  window.lightdm?.cancel_authentication();
}

function setupLightdmSignals() {
  window.lightdm.show_prompt.connect((_prompt, type) => {
    // 0 = username, 1 = password
    if (type === 0) {
      window.lightdm.respond(pendingUsername);
      return;
    }

    if (type === 1) {
      window.lightdm.respond(pendingPassword);
      appendMessage("Autenticando...");
    }
  });

  window.lightdm.show_message.connect((text, type) => {
    appendMessage(text || "", type === "error");
  });

  window.lightdm.authentication_complete.connect(() => {
    if (window.lightdm.is_authenticated) {
      appendMessage("Login efetuado com sucesso.");
      if (typeof window.lightdm.start_session_sync === "function") {
        window.lightdm.start_session_sync();
      } else {
        window.lightdm.start_session(window.lightdm.default_session ?? null);
      }
      return;
    }

    appendMessage("Usuário ou senha inválidos.", true);
    resetFormAfterFail();
  });
}

function init() {
  if (!window.lightdm) {
    appendMessage("API do WebGreeter não encontrada.", true);
    return;
  }

  setupLightdmSignals();

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    pendingUsername = usernameInput.value.trim();
    pendingPassword = passwordInput.value;

    if (!pendingUsername || !pendingPassword) {
      appendMessage("Preencha usuário e senha.", true);
      return;
    }

    appendMessage("Iniciando autenticação...");
    window.lightdm.cancel_authentication();
    window.lightdm.authenticate(null);
  });
}

init();
