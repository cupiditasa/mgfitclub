(() => {
  document.querySelectorAll(".coach-orbit, #adminOrbit").forEach((orbit) => {
    const nodes = [
      ...orbit.querySelectorAll(".coach-orbit-node, .admin-orbit-node"),
    ];
    let sequence = [];
    nodes.forEach((node, index) => {
      node.addEventListener("pointerdown", (event) => {
        node.setPointerCapture?.(event.pointerId);
        const targets = [node, nodes[(index + 1) % nodes.length]];
        if (orbit.classList.contains("coach-orbit")) {
          sequence = [...sequence, index].slice(-5);
          if (sequence.join(",") === "0,2,4,1,3")
            orbit.classList.add("game-solved");
        }
        targets.forEach((el, i) =>
          setTimeout(() => {
            el.classList.toggle("orbit-flipped");
            el.style.animationDirection = el.classList.contains("orbit-flipped")
              ? "reverse"
              : "normal";
          }, i * 130),
        );
      });
    });
  });
})();
