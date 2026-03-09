const form = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const submitButton = form.querySelector('button[type="submit"]');
const message = document.getElementById("message");

let pendingUsername = "";
let pendingPassword = "";
let pendingPasswordPrompt = null;
let isPasswordChangeFlow = false;

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

function setSubmitButtonIdleMode() {
  submitButton.textContent = "Login";
}

function setSubmitButtonPromptMode() {
  submitButton.textContent = "Enviar";
}

function resetAuthenticationState() {
  pendingPasswordPrompt = null;
  isPasswordChangeFlow = false;
  setSubmitButtonIdleMode();
}

function resetFormAfterFail() {
  passwordInput.value = "";
  passwordInput.focus();
  resetAuthenticationState();
  window.lightdm?.cancel_authentication();
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .trim();
}

function isPasswordChangePrompt(prompt) {
  const normalizedPrompt = normalize(prompt);

  return (
    normalizedPrompt.includes("current password") ||
    normalizedPrompt.includes("new password") ||
    normalizedPrompt.includes("retype") ||
    normalizedPrompt.includes("nova senha") ||
    normalizedPrompt.includes("senha atual") ||
    normalizedPrompt.includes("repita")
  );
}

function mapPamMessage(text, type) {
  const normalizedText = normalize(text);

  if (normalizedText.includes("password expired")) {
    isPasswordChangeFlow = true;
    return {
      text: "Sua senha expirou. Informe a senha solicitada para definir uma nova.",
      isError: true,
    };
  }

  if (normalizedText.includes("bad password")) {
    isPasswordChangeFlow = true;
    return {
      text: "A nova senha foi recusada pela política de segurança. Escolha outra senha.",
      isError: true,
    };
  }

  return {
    text: text || "",
    isError: type === "error",
  };
}

function setupLightdmSignals() {
  window.lightdm.show_prompt.connect((prompt, type) => {
    // 0 = username, 1 = password
    if (type === 0) {
      window.lightdm.respond(pendingUsername);
      return;
    }

    if (type === 1) {
      if (isPasswordChangePrompt(prompt)) {
        isPasswordChangeFlow = true;
        pendingPasswordPrompt = prompt;
        setSubmitButtonPromptMode();
        appendMessage(`PAM solicitou: ${prompt}`);
        appendMessage("Digite a senha solicitada e clique em Enviar.");
        passwordInput.value = "";
        passwordInput.focus();
        return;
      }

      window.lightdm.respond(pendingPassword);
      appendMessage("Autenticando...");
    }
  });

  window.lightdm.show_message.connect((text, type) => {
    const mapped = mapPamMessage(text, type);
    appendMessage(mapped.text, mapped.isError);
  });

  window.lightdm.authentication_complete.connect(() => {
    if (window.lightdm.is_authenticated) {
      appendMessage("Login efetuado com sucesso.");
      resetAuthenticationState();
      if (typeof window.lightdm.start_session_sync === "function") {
        window.lightdm.start_session_sync();
      } else {
        window.lightdm.start_session(window.lightdm.default_session ?? null);
      }
      return;
    }

    if (isPasswordChangeFlow) {
      appendMessage("Falha na troca de senha ou autenticação. Revise as mensagens do PAM acima.", true);
    } else {
      appendMessage("Usuário ou senha inválidos.", true);
    }

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

    if (pendingPasswordPrompt) {
      const promptResponse = passwordInput.value;

      if (!promptResponse) {
        appendMessage("Informe a senha solicitada pelo PAM antes de enviar.", true);
        return;
      }

      appendMessage(`Respondendo solicitação do PAM: ${pendingPasswordPrompt}`);
      window.lightdm.respond(promptResponse);
      passwordInput.value = "";
      pendingPasswordPrompt = null;
      setSubmitButtonIdleMode();
      return;
    }

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
