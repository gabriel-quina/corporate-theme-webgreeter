const form = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const message = document.getElementById("message");

let pendingUsername = "";
let pendingPassword = "";

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
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
      setMessage("Autenticando...");
    }
  });

  window.lightdm.show_message.connect((text, type) => {
    setMessage(text || "", type === "error");
  });

  window.lightdm.authentication_complete.connect(() => {
    if (window.lightdm.is_authenticated) {
      setMessage("Login efetuado com sucesso.");
      if (typeof window.lightdm.start_session_sync === "function") {
        window.lightdm.start_session_sync();
      } else {
        window.lightdm.start_session(window.lightdm.default_session ?? null);
      }
      return;
    }

    setMessage("Usuário ou senha inválidos.", true);
    resetFormAfterFail();
  });
}

function init() {
  if (!window.lightdm) {
    setMessage("API do WebGreeter não encontrada.", true);
    return;
  }

  setupLightdmSignals();

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    pendingUsername = usernameInput.value.trim();
    pendingPassword = passwordInput.value;

    if (!pendingUsername || !pendingPassword) {
      setMessage("Preencha usuário e senha.", true);
      return;
    }

    setMessage("Iniciando autenticação...");
    window.lightdm.cancel_authentication();
    window.lightdm.authenticate(null);
  });
}

init();
