(() => {
  "use strict";

  const template = document.querySelector("#mg-assistant-template");
  if (!template || document.querySelector("mg-fitclub-assistant")) return;

  const host = document.createElement("mg-fitclub-assistant");
  host.setAttribute("aria-label", "دستیار هوشمند MG");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.appendChild(template.content.cloneNode(true));
  document.body.appendChild(host);
})();
