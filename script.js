const DEBUG_AUTH_LOG = false;
const SUCCESS_REDIRECT_DELAY_MS = 2000;

const form = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const passwordLabel = document.getElementById("password-label");
const submitButton = document.getElementById("submit-button");
const cancelButton = document.getElementById("cancel-button");
const message = document.getElementById("message");
const debugLog = document.getElementById("debug-log");
const passwordChangePanel = document.getElementById("password-change-panel");

let pendingUsername = "";
let pendingPassword = "";
let pendingPasswordPrompt = null;
let isPasswordChangeFlow = false;
let currentPasswordStep = null;

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .trim();
}

function setMessage(text, isError = false) {
  message.textContent = text || "";
  message.classList.toggle("error", isError);
}

function appendDebugMessage(text, isError = false) {
  if (!DEBUG_AUTH_LOG || !text) {
    return;
  }

  const line = document.createElement("p");
  line.className = "message-line";

  if (isError) {
    line.classList.add("error");
  }

  line.textContent = text;
  debugLog.append(line);
  debugLog.scrollTop = debugLog.scrollHeight;
}

function getPromptStep(prompt) {
  const normalizedPrompt = normalize(prompt);

  if (normalizedPrompt.includes("current password") || normalizedPrompt.includes("senha atual")) {
    return "current";
  }

  if (normalizedPrompt.includes("retype") || normalizedPrompt.includes("repita")) {
    return "retype";
  }

  if (normalizedPrompt.includes("new password") || normalizedPrompt.includes("nova senha")) {
    return "new";
  }

  return null;
}

function updateStepVisual() {
  const steps = document.querySelectorAll("#password-change-steps li");
  const order = ["current", "new", "retype"];

  steps.forEach((stepNode) => {
    const step = stepNode.dataset.step;
    stepNode.classList.remove("active", "done");

    if (!currentPasswordStep) {
      return;
    }

    const currentIndex = order.indexOf(currentPasswordStep);
    const stepIndex = order.indexOf(step);

    if (stepIndex < currentIndex) {
      stepNode.classList.add("done");
    } else if (stepIndex === currentIndex) {
      stepNode.classList.add("active");
    }
  });
}

function enterPasswordChangeFlow() {
  isPasswordChangeFlow = true;
  usernameInput.disabled = true;
  passwordChangePanel.classList.remove("hidden");
  cancelButton.classList.remove("hidden");
  submitButton.textContent = "Enviar";
}

function resetAuthenticationState() {
  pendingPasswordPrompt = null;
  isPasswordChangeFlow = false;
  currentPasswordStep = null;

  usernameInput.disabled = false;
  passwordLabel.textContent = "Senha";
  submitButton.textContent = "Login";
  passwordChangePanel.classList.add("hidden");
  cancelButton.classList.add("hidden");
  updateStepVisual();
}

function resetFormAfterFail() {
  passwordInput.value = "";
  passwordInput.focus();
  resetAuthenticationState();
  window.lightdm?.cancel_authentication();
}

function setInstructionForStep(step) {
  if (step === "current") {
    passwordLabel.textContent = "Senha atual";
    setMessage("Passo 1 de 3: digite sua senha ATUAL e clique em Enviar.");
    return;
  }

  if (step === "new") {
    passwordLabel.textContent = "Nova senha";
    setMessage("Passo 2 de 3: digite uma NOVA senha e clique em Enviar.");
    return;
  }

  if (step === "retype") {
    passwordLabel.textContent = "Confirmar nova senha";
    setMessage("Passo 3 de 3: redigite a NOVA senha para confirmar.");
    return;
  }

  passwordLabel.textContent = "Senha";
  setMessage("Digite a senha solicitada e clique em Enviar.");
}

function mapPamMessage(text, type) {
  const normalizedText = normalize(text);

  if (normalizedText.includes("password expired")) {
    enterPasswordChangeFlow();
    return {
      text: "Sua senha expirou e precisa ser alterada agora.",
      isError: true,
    };
  }

  if (normalizedText.includes("bad password")) {
    return {
      text: "A nova senha não atende os requisitos mínimos. Tente outra senha.",
      isError: true,
    };
  }

  if (normalizedText.includes("passwords do not match")) {
    return {
      text: "As senhas não coincidem. Redigite a nova senha corretamente.",
      isError: true,
    };
  }

  if (normalizedText.includes("old password not accepted")) {
    return {
      text: "A senha atual informada está incorreta. Tente novamente.",
      isError: true,
    };
  }

  if (normalizedText.includes("password change failed")) {
    return {
      text: "Não foi possível concluir a troca de senha. Revise os dados e tente novamente.",
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
    appendDebugMessage(`show_prompt [${type}]: ${prompt}`);

    if (type === 0) {
      window.lightdm.respond(pendingUsername);
      return;
    }

    if (type !== 1) {
      return;
    }

    const step = getPromptStep(prompt);

    if (step) {
      enterPasswordChangeFlow();
      pendingPasswordPrompt = prompt;
      currentPasswordStep = step;
      updateStepVisual();
      setInstructionForStep(step);
      passwordInput.value = "";
      passwordInput.focus();
      return;
    }

    window.lightdm.respond(pendingPassword);
    setMessage("Autenticando...");
  });

  window.lightdm.show_message.connect((text, type) => {
    const mapped = mapPamMessage(text, type);
    appendDebugMessage(`show_message [${type}]: ${text}`, mapped.isError);

    if (mapped.text) {
      setMessage(mapped.text, mapped.isError);
    }
  });

  window.lightdm.authentication_complete.connect(() => {
    appendDebugMessage(`authentication_complete: ${window.lightdm.is_authenticated ? "success" : "fail"}`);

    if (window.lightdm.is_authenticated) {
      setMessage("Autenticação concluída. Entrando na sessão...");
      resetAuthenticationState();

      window.setTimeout(() => {
        if (typeof window.lightdm.start_session_sync === "function") {
          window.lightdm.start_session_sync();
        } else {
          window.lightdm.start_session(window.lightdm.default_session ?? null);
        }
      }, SUCCESS_REDIRECT_DELAY_MS);
      return;
    }

    if (isPasswordChangeFlow) {
      setMessage("Falha na troca de senha. Revise as informações e tente novamente.", true);
    } else {
      setMessage("Usuário ou senha inválidos.", true);
    }

    resetFormAfterFail();
  });
}

function init() {
  if (!window.lightdm) {
    setMessage("API do WebGreeter não encontrada.", true);
    return;
  }

  if (DEBUG_AUTH_LOG) {
    debugLog.classList.remove("hidden");
    appendDebugMessage("DEBUG_AUTH_LOG ativo");
  }

  setupLightdmSignals();

  cancelButton.addEventListener("click", () => {
    appendDebugMessage("Fluxo de troca cancelado pelo usuário");
    setMessage("Troca de senha cancelada. Inicie o login novamente.", true);
    window.lightdm.cancel_authentication();
    resetFormAfterFail();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (pendingPasswordPrompt) {
      const promptResponse = passwordInput.value;

      if (!promptResponse) {
        setMessage("Preencha o campo de senha para continuar o passo atual.", true);
        return;
      }

      appendDebugMessage(`respond prompt: ${pendingPasswordPrompt}`);
      window.lightdm.respond(promptResponse);
      passwordInput.value = "";
      pendingPasswordPrompt = null;
      setMessage("Resposta enviada. Aguarde a próxima etapa...");
      return;
    }

    pendingUsername = usernameInput.value.trim();
    pendingPassword = passwordInput.value;

    if (!pendingUsername || !pendingPassword) {
      setMessage("Preencha usuário e senha.", true);
      return;
    }

    setMessage("Autenticando...");
    window.lightdm.cancel_authentication();
    window.lightdm.authenticate(null);
  });
}

init();
