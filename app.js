
// ==========================================
// ¿QUÉ HARÍAS VOS? - APP.JS
// Historia de Mateo
// ==========================================

const TOTAL_TIME = 10;

let timeLeft = TOTAL_TIME;
let timerInterval = null;
let locked = false;
let currentScene = 1;
let history = [];

// ==========================================
// DATOS DE LA HISTORIA
// ==========================================

const story = {
  1: {
    chapter: "SITUACIÓN 01",
    category: "EN LA ESCUELA",
    title: "La prueba",
    description: "Mateo tiene 15 años y es nuevo en la escuela. Está haciendo una prueba importante. De repente, Santi, uno de los chicos populares del curso, le pasa una hoja con las respuestas y le dice: «Copiá, nadie se va a dar cuenta». ¿Qué debería hacer Mateo?",
    options: [
      {
        text: "Aceptar la hoja y copiar las respuestas.",
        consequence: "Mateo aprueba la prueba, pero se siente mal porque sabe que no fue honesto. Santi descubre que Mateo está dispuesto a hacer lo que le dicen para encajar.",
        action: "Aceptó copiar",
        happened: "Aprobó, pero se sintió mal por no ser honesto.",
        noticed: "Santi descubrió que Mateo cede ante la presión.",
        data: { copied: true }
      },
      {
        text: "Devolver la hoja y hacer la prueba por su cuenta.",
        consequence: "Mateo se saca una nota baja, pero se queda tranquilo porque fue honesto. Lauti, un chico callado del fondo, ve lo que pasó y lo respeta.",
        action: "Decidió no copiar",
        happened: "Se sacó una nota baja, pero estuvo tranquilo.",
        noticed: "Lauti vio su decisión y lo respetó.",
        data: { copied: false }
      }
    ]
  },

  2: {
    chapter: "SITUACIÓN 02",
    category: "EN EL RECREO",
    title: "El recreo",
    description: "Llegó el recreo. Un grupo de chicos empieza a burlarse de Lauti. Le hacen comentarios sobre su forma de vestir y todos se ríen.",
    options: [
      {
        text: "Reírme con el grupo para no quedar afuera.",
        action: "Se rió de Lauti",
        happened: "Lauti se sintió humillado y decepcionado.",
        noticed: "Lauti se dio cuenta de que Mateo también lo lastimó.",
        consequence: "Lauti mira a Mateo con decepción. Si antes lo respetaba, ahora siente que Mateo eligió al grupo antes que hacer lo correcto.",
        data: { laughed: true }
      },
      {
        text: "Defender a Lauti y pedir que dejen de molestarlo.",
        action: "Defendió a Lauti",
        happened: "El grupo también empezó a burlarse de Mateo.",
        noticed: "Santi se dio cuenta y ahora lo ve como alguien que no sigue al grupo.",
        consequence: "Mateo defiende a Lauti. El grupo se ríe de él también. Lauti agradece que alguien lo haya defendido, pero Santi empieza a verlo como un problema.",
        data: { defended: true }
      }
    ]
  },

  3: {
    chapter: "SITUACIÓN 03",
    category: "A LA SALIDA",
    title: "La fiesta",
    description: "Es viernes. A la salida, Santi invita a Mateo a una fiesta. Van a estar todos los chicos del grupo. Mateo sabe que puede ser una oportunidad para encajar, pero también tiene muchas cosas dando vueltas en la cabeza. ¿Qué debería hacer?",
    options: [
      {
        text: "Ir a la fiesta para estar con todos.",
        action: "Decidió ir a la fiesta",
        happened: "Estuvo rodeado de gente, pero no necesariamente se sintió acompañado.",
        noticed: "Santi vio que Mateo seguía buscando la aceptación del grupo.",
        consequence: "Mateo va a la fiesta. Está rodeado de personas, pero se siente solo. Se pregunta si realmente está siendo él mismo o si solamente intenta agradar a los demás.",
        data: { wentParty: true }
      },
      {
        text: "No ir y quedarse tranquilo con su decisión.",
        action: "Decidió no ir a la fiesta",
        happened: "Se quedó solo en su casa, pero pudo estar en paz con su decisión.",
        noticed: "Mateo empezó a reconocer qué cosas realmente quería hacer.",
        consequence: "Mateo decide no ir. Quizás se queda solo esa noche, pero siente que no necesita fingir para ser aceptado. Empieza a pensar qué clase de persona quiere ser.",
        data: { wentParty: false }
      }
    ]
  }
};

// ==========================================
// FINALES
// ==========================================

const endings = {
  volver: {
    icon: "🔄",
    title: "El que se anima a volver",
    description: "Mateo se da cuenta de que, por querer encajar, empezó a perderse a sí mismo. Piensa en lo que hizo y decide escribirle a Lauti para pedirle perdón. No todo se soluciona de un día para el otro. Quizás Lauti todavía esté dolido y recuperar su confianza lleve tiempo. Pero Mateo decide empezar de nuevo, reconocer sus errores y hacer lo correcto.",
    reflection: "Equivocarse no significa que todo esté perdido. Dios nos invita a reconocer nuestros errores, arrepentirnos y cambiar de dirección. Siempre podemos dar un paso para volver a hacer lo correcto.",
    verse: "«El que encubre sus pecados no prosperará; mas el que los confiesa y se aparta alcanzará misericordia». — Proverbios 28:13"
  },

  firme: {
    icon: "🦁",
    title: "El que se mantiene firme",
    description: "Mateo entiende que hacer lo correcto no siempre significa ser aceptado por todos. Aunque el grupo lo dejó de lado, sabe que no necesita fingir para tener valor. Lauti se acerca y empieza a hablar con él. Mateo descubre que ser valiente no significa no tener miedo, sino actuar con miedo cuando sabemos que algo es correcto.",
    reflection: "Dios nos llama a mantenernos firmes, incluso cuando hacer lo correcto resulta difícil. Nuestra identidad no depende de la aprobación de los demás.",
    verse: "«Mirá que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo». — Josué 1:9"
  }
};

// ==========================================
// CAMBIAR PANTALLAS
// ==========================================

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.add("hidden");
  });

  const screen = document.getElementById(screenId);

  if (screen) {
    screen.classList.remove("hidden");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================
// INICIAR JUEGO
// ==========================================

function startGame() {
  clearInterval(timerInterval);

  history = [];
  currentScene = 1;
  locked = false;

  showScreen("game");
  loadScene(1);
}

// ==========================================
// CARGAR SITUACIÓN
// ==========================================

function loadScene(sceneNumber) {
  clearInterval(timerInterval);

  const scene = story[sceneNumber];

  if (!scene) return;

  currentScene = sceneNumber;
  locked = false;

  document.getElementById("chapter").textContent = scene.chapter;
  document.getElementById("category").textContent = scene.category;
  document.getElementById("title").textContent = scene.title;
  document.getElementById("description").textContent = scene.description;

  // Mostrar consecuencias de las decisiones anteriores
  const consequenceBox = document.getElementById("consequence");

  if (sceneNumber > 1) {
    const previous = history[sceneNumber - 2];

    consequenceBox.textContent = previous.consequence;
    consequenceBox.classList.remove("hidden");
  } else {
    consequenceBox.textContent = "";
    consequenceBox.classList.add("hidden");
  }

  // Progreso: tres situaciones
  document.getElementById("progress").style.width =
    ((sceneNumber - 1) / 3 * 100) + "%";

  // Crear opciones
  const optionsContainer = document.getElementById("options");
  optionsContainer.innerHTML = "";

  scene.options.forEach(option => {
    const button = document.createElement("button");

    button.className = "option-btn";
    button.textContent = option.text;

    button.addEventListener("click", () => {
      chooseOption(option);
    });

    optionsContainer.appendChild(button);
  });

  document.getElementById("timeout").classList.add("hidden");

  startTimer();
}

// ==========================================
// TEMPORIZADOR
// ==========================================

function startTimer() {
  clearInterval(timerInterval);

  timeLeft = TOTAL_TIME;
  updateTimer();

  timerInterval = setInterval(() => {
    if (locked) {
      clearInterval(timerInterval);
      return;
    }

    timeLeft--;
    updateTimer();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timeExpired();
    }
  }, 1000);
}

function updateTimer() {
  document.getElementById("timer").textContent = timeLeft;

  const timerBar = document.getElementById("timer-bar");

  if (timerBar) {
    timerBar.style.width = (timeLeft / TOTAL_TIME * 100) + "%";
  }
}

// ==========================================
// SE ACABÓ EL TIEMPO
// ==========================================

function timeExpired() {
  clearInterval(timerInterval);

  locked = true;

  document.getElementById("timeout").classList.remove("hidden");

  document.querySelectorAll(".option-btn").forEach(button => {
    button.disabled = true;
  });

  setTimeout(() => {
    restartGame();
  }, 1800);
}

// ==========================================
// ELEGIR UNA OPCIÓN
// ==========================================

function chooseOption(option) {
  if (locked) return;

  locked = true;
  clearInterval(timerInterval);

  // Registrar decisión y consecuencia
  history.push({
    scene: currentScene,
    action: option.action,
    happened: option.happened,
    noticed: option.noticed,
    consequence: option.consequence,
    data: option.data
  });

  // Mostrar la siguiente situación
  if (currentScene < 3) {
    loadScene(currentScene + 1);
  } else {
    showBoard();
  }
}

// ==========================================
// CONSTRUIR LA PIZARRA
// ==========================================

function showBoard() {
  clearInterval(timerInterval);

  const boardRows = document.getElementById("board-rows");
  boardRows.innerHTML = "";

  history.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "board-row";

    const actionCell = document.createElement("div");
    actionCell.className = "board-cell";

    const actionTitle = document.createElement("strong");
    actionTitle.textContent = "Situación " + (index + 1);

    const actionText = document.createElement("span");
    actionText.textContent = item.action;

    actionCell.appendChild(actionTitle);
    actionCell.appendChild(actionText);

    const happenedCell = document.createElement("div");
    happenedCell.className = "board-cell";
    happenedCell.textContent = item.happened;

    const noticedCell = document.createElement("div");
    noticedCell.className = "board-cell";
    noticedCell.textContent = item.noticed;

    row.appendChild(actionCell);
    row.appendChild(happenedCell);
    row.appendChild(noticedCell);

    boardRows.appendChild(row);
  });

  document.getElementById("progress").style.width = "100%";

  showScreen("board");
}

// ==========================================
// ELEGIR UNO DE LOS DOS FINALES
// ==========================================

function showFinalChoices() {
  showScreen("final-choice");
}

// ==========================================
// MOSTRAR FINAL ELEGIDO POR EL GRUPO
// ==========================================

function selectEnding(endingId) {
  const ending = endings[endingId];

  if (!ending) return;

  document.getElementById("result-icon").textContent = ending.icon;
  document.getElementById("result-title").textContent = ending.title;
  document.getElementById("result-description").textContent = ending.description;
  document.getElementById("reflection-text").textContent = ending.reflection;
  document.getElementById("verse-text").textContent = ending.verse;

  showScreen("result");
}

// ==========================================
// REINICIAR
// ==========================================

function restartGame() {
  clearInterval(timerInterval);

  history = [];
  currentScene = 1;
  timeLeft = TOTAL_TIME;
  locked = false;

  updateTimer();
  showScreen("home");
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  showScreen("home");
});
