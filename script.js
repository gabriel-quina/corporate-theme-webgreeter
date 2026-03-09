const form = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const message = document.getElementById("message");

const hasGreeterApi = typeof window.lightdm !== "undefined";
let waitingForPassword = false;

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function resetPasswordField() {
  passwordInput.value = "";
  passwordInput.focus();
}

if (!hasGreeterApi) {
  setMessage("API do WebGreeter não encontrada. Execute este tema no WebGreeter.", true);
}

window.show_prompt = (text, type) => {
  if (type === "password") {
    waitingForPassword = true;
    setMessage(text || "Digite sua senha para continuar.");
    passwordInput.focus();
    return;
  }

  setMessage(text || "Informe suas credenciais.");
};

window.show_message = (text, type) => {
  setMessage(text || "", type === "error");
};

window.authentication_complete = () => {
  if (!hasGreeterApi) return;

  if (window.lightdm.is_authenticated) {
    setMessage("Login efetuado com sucesso.");
    window.lightdm.start_session_sync();
  } else {
    waitingForPassword = false;
    setMessage("Usuário ou senha inválidos.", true);
    resetPasswordField();
  }
};

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!hasGreeterApi) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    setMessage("Preencha usuário e senha.", true);
    return;
  }

  try {
    if (!waitingForPassword) {
      window.lightdm.cancel_authentication();
      window.lightdm.authenticate(username);
      waitingForPassword = true;
    }

    window.lightdm.respond(password);
    setMessage("Autenticando...");
  } catch (error) {
    waitingForPassword = false;
    setMessage(`Erro ao autenticar: ${error.message}`, true);
  }
});

