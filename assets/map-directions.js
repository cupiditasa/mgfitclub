const dialog = document.querySelector("[data-map-directions-dialog]");
const openButton = document.querySelector("[data-map-directions-open]");
const closeButton = dialog?.querySelector("[data-map-directions-close]");
const googleMapsLink = dialog?.querySelector("[data-map-directions-google]");
const snappLink = dialog?.querySelector("[data-map-directions-snapp]");
const copyButton = dialog?.querySelector("[data-map-copy-destination]");
const destination = dialog?.querySelector("[data-map-destination-text]");
const copyStatus = dialog?.querySelector("[data-map-copy-status]");

if (dialog && openButton) {
  openButton.addEventListener("click", () => {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
    }
    googleMapsLink?.focus();
  });

  const closeDialog = () => {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    openButton.focus();
  };

  closeButton?.addEventListener("click", closeDialog);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  dialog.addEventListener("close", () => openButton.focus());

  const copyDestination = async () => {
    if (!destination || !copyStatus) return;
    try {
      await navigator.clipboard.writeText(destination.textContent.trim());
      copyStatus.textContent = "نشانی مقصد کپی شد؛ آن را در جست‌وجوی اسنپ وارد کنید.";
    } catch {
      copyStatus.textContent = "کپی خودکار در این مرورگر ممکن نشد؛ نشانی بالا را انتخاب و کپی کنید.";
    }
    copyStatus.hidden = false;
  };

  copyButton?.addEventListener("click", copyDestination);
  snappLink?.addEventListener("click", copyDestination);
}
