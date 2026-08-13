(() => {
  "use strict";

  const host = document.querySelector("mg-fitclub-assistant");
  const root = host?.shadowRoot;
  const widget = root?.querySelector(".mg-assistant");
  if (!widget) return;

  const launcher = widget.querySelector(".mg-assistant__launcher");
  const panel = widget.querySelector(".mg-assistant__panel");
  const closeButton = widget.querySelector(".mg-assistant__close");
  const form = widget.querySelector(".mg-assistant__composer");
  const input = widget.querySelector("#mg-assistant-input");
  const sendButton = form.querySelector("button[type='submit']");
  const messagesElement = widget.querySelector(".mg-assistant__messages");
  const typing = widget.querySelector(".mg-assistant__typing");
  const suggestions = [...widget.querySelectorAll(".mg-assistant__suggestions button")];
  const configuredEndpoint = String(widget.dataset.chatEndpoint || "").trim();
  const endpoint = ["127.0.0.1", "localhost"].includes(location.hostname)
    ? "/site-api/chat"
    : configuredEndpoint;
  const siteKey = String(widget.dataset.siteKey || "").trim();
  const conversationStorageKey = "mg_assistant_conversation_id";
  let conversationId = "";
  let busy = false;
  let longPressTimer = 0;
  let returnFocus = null;

  const createConversationId = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `mg-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  };

  try {
    conversationId = localStorage.getItem(conversationStorageKey) || createConversationId();
    localStorage.setItem(conversationStorageKey, conversationId);
  } catch {
    conversationId = createConversationId();
  }

  const setOpen = open => {
    widget.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    launcher.setAttribute("aria-expanded", String(open));
    launcher.setAttribute("aria-label", open ? "بستن دستیار هوشمند MG" : "باز کردن دستیار هوشمند MG");

    if (open) {
      returnFocus = document.activeElement;
      window.setTimeout(() => input.focus(), 350);
    } else if (returnFocus && document.contains(returnFocus)) {
      returnFocus.focus();
    }
  };

  const resizeInput = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 92)}px`;
  };

  const scrollMessages = () => {
    requestAnimationFrame(() => {
      messagesElement.scrollTop = messagesElement.scrollHeight;
    });
  };

  const addMessage = (text, role, error = false) => {
    const message = document.createElement("p");
    message.className = `mg-assistant__message mg-assistant__message--${role}`;
    if (error) message.classList.add("mg-assistant__message--error");
    message.textContent = text;
    messagesElement.appendChild(message);
    scrollMessages();
  };

  const setBusy = state => {
    busy = state;
    input.disabled = state;
    sendButton.disabled = state;
    typing.hidden = !state;
    widget.classList.toggle("is-thinking", state);
    if (state) scrollMessages();
  };

  const sendMessage = async rawMessage => {
    const message = String(rawMessage || "").trim();
    if (!message || busy) return;

    addMessage(message, "user");
    input.value = "";
    resizeInput();
    setBusy(true);

    try {
      const hasExplicitProtocol = /^[a-z][a-z\d+.-]*:/i.test(endpoint);
      if (!endpoint || (hasExplicitProtocol && !/^https:\/\//i.test(endpoint))) {
        throw new Error("CHAT_ENDPOINT_NOT_CONFIGURED");
      }
      if (!siteKey) {
        throw new Error("SITE_KEY_NOT_CONFIGURED");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message,
          siteKey,
          conversationId
        })
      });

      const data = await response.json().catch(() => ({}));
      const reply = [
        data.reply,
        data.message,
        data.answer,
        data.response,
        data.data?.reply,
        data.data?.message,
        data.data?.answer
      ].find(value => typeof value === "string" && value.trim());

      const returnedConversationId =
        data.conversationId ||
        data.conversation_id ||
        data.data?.conversationId ||
        data.data?.conversation_id;

      if (!response.ok || !reply) {
        throw new Error(data.error || "پاسخی از سرور دریافت نشد.");
      }

      if (typeof returnedConversationId === "string" && returnedConversationId.trim()) {
        conversationId = returnedConversationId.trim();
        try {
          localStorage.setItem(conversationStorageKey, conversationId);
        } catch {}
      }

      addMessage(reply.trim(), "bot");
    } catch (error) {
      const setupMessage = error?.message === "CHAT_ENDPOINT_NOT_CONFIGURED"
        ? "آدرس API گفت‌وگو هنوز در تنظیمات سایت وارد نشده است."
        : "فعلاً ارتباط من با سرویس گفت‌وگو برقرار نیست. لطفاً کمی بعد دوباره تلاش کنید یا با باشگاه تماس بگیرید.";
      addMessage(setupMessage, "bot", true);
      console.warn("MG assistant:", error);
    } finally {
      setBusy(false);
      input.focus();
    }
  };

  launcher.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false));

  launcher.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse") return;
    window.clearTimeout(longPressTimer);
    longPressTimer = window.setTimeout(() => widget.classList.add("is-reacting"), 220);
  });

  const stopLongPress = () => {
    window.clearTimeout(longPressTimer);
    window.setTimeout(() => widget.classList.remove("is-reacting"), 500);
  };

  launcher.addEventListener("pointerup", stopLongPress);
  launcher.addEventListener("pointercancel", stopLongPress);
  launcher.addEventListener("pointerleave", stopLongPress);

  input.addEventListener("input", resizeInput);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage(input.value);
  });

  suggestions.forEach(button => {
    button.addEventListener("click", () => sendMessage(button.textContent));
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && widget.classList.contains("is-open")) {
      event.stopPropagation();
      setOpen(false);
    }
  }, true);

  resizeInput();
  host.dataset.ready = "true";
})();
