document.addEventListener("DOMContentLoaded", function () {
  // Retro-Cursor-Effekt
  const cursor = document.createElement("div");
  cursor.classList.add("retro-cursor");
  document.body.appendChild(cursor);

  document.addEventListener("mousemove", function (e) {
    cursor.style.left = e.pageX + "px";
    cursor.style.top = e.pageY + "px";
  });

  // Pixelated Hover-Effekt für Buttons
  const buttons = document.querySelectorAll(".btn");
  buttons.forEach((button) => {
    button.addEventListener("mouseenter", function () {
      this.classList.add("pixelated");
    });

    button.addEventListener("mouseleave", function () {
      this.classList.remove("pixelated");
    });
  });

  // Voting-Animation
  const voteButtons = document.querySelectorAll(".vote-btn");
  voteButtons.forEach((button) => {
    button.addEventListener("click", function () {
      this.classList.add("vote-animation");
      setTimeout(() => {
        this.classList.remove("vote-animation");
      }, 500);
    });
  });

  // Form-Validierung
  const gameForm = document.querySelector(".game-form");
  if (gameForm) {
    gameForm.addEventListener("submit", function (e) {
      const title = document.getElementById("title").value.trim();
      const description = document.getElementById("description").value.trim();
      const gameUrl = document.getElementById("gameUrl").value.trim();
      const imageUrl = document.getElementById("imageUrl").value.trim();

      if (!title || !description || !gameUrl || !imageUrl) {
        e.preventDefault();
        alert("Bitte fülle alle Pflichtfelder aus!");
        return;
      }

      if (description.length > 200) {
        e.preventDefault();
        alert("Die Beschreibung darf maximal 200 Zeichen lang sein!");
        return;
      }
    });
  }

  // Retro-Sound-Effekte
  function playRetroSound(type) {
    const sound = new Audio();
    sound.volume = 0.3;

    switch (type) {
      case "click":
        sound.src = "/sounds/click.mp3";
        break;
      case "success":
        sound.src = "/sounds/success.mp3";
        break;
      case "error":
        sound.src = "/sounds/error.mp3";
        break;
    }

    sound
      .play()
      .catch((err) =>
        console.log("Audio konnte nicht abgespielt werden:", err)
      );
  }

  // Sound-Effekte zu Buttons hinzufügen
  document.querySelectorAll("button, .btn").forEach((el) => {
    el.addEventListener("click", () => playRetroSound("click"));
  });
});
