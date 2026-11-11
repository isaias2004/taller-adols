
const TOTAL_TIME = 10;

let timeLeft = TOTAL_TIME;
let timerInterval = null;
let locked = false;
let decisions = [];
let currentScene = "inicio";

const scenes = {
  inicio: {
    chapter: "SITUACIÓN 01",
    category: "EN LA ESCUELA",
    title: "Una situación incómoda",
    description: "Estás en la escuela y ves que un grupo de chicos se está burlando de un compañero. Lo insultan, se ríen de él y lo dejan de lado. ¿Qué harías?",
    options: [
      { text: "Me acerco al compañero y lo acompaño.", next: "acompanar" },
      { text: "Hablo con un adulto para pedir ayuda.", next: "adulto" },
      { text: "No me meto y sigo con lo mío.", next: "silencio" }
    ]
  },

  acompanar: {
    chapter: "SITUACIÓN 02",
    category: "TU DECISIÓN",
    title: "No está solo",
    description: "Te acercás a tu compañero y te cuenta que esto viene pasando hace varios días y que ya no quiere ir a la escuela. ¿Qué hacés ahora?",
    options: [
      { text: "Lo escucho y le digo que puede contar conmigo.", next: "acompanarAyuda" },
      { text: "Le digo que tiene que defenderse solo.", next: "acompanarEscucha" }
    ]
  },

  acompanarAyuda: {
    chapter: "SITUACIÓN 03",
    category: "UNA NUEVA DECISIÓN",
    title: "Dar un paso más",
    description: "Tu compañero se siente acompañado, pero la situación continúa. Sabés que necesita que alguien intervenga. ¿Qué harías?",
    options: [
      { text: "Lo acompaño a hablar con un docente.", next: "finalValiente" },
      { text: "Le prometo guardar el secreto.", next: "finalAprendizaje" }
    ]
  },

  acompanarEscucha: {
    chapter: "SITUACIÓN 03",
    category: "UNA NUEVA DECISIÓN",
    title: "¿Qué necesita escuchar?",
    description: "Tu compañero se queda en silencio y parece sentirse peor. ¿Cómo reaccionás?",
    options: [
      { text: "Le pido disculpas y lo escucho.", next: "finalFuerte" },
      { text: "Me voy porque no sé qué decir.", next: "finalAprendizaje" }
    ]
  },

  adulto: {
    chapter: "SITUACIÓN 02",
    category: "TU DECISIÓN",
    title: "Buscar ayuda",
    description: "Decidís hablar con una persona adulta de confianza. Te escucha, pero te pregunta si estás seguro de lo que viste. ¿Qué hacés?",
    options: [
      { text: "Le cuento con sinceridad lo que pasó.", next: "adultoHablar" },
      { text: "Me arrepiento y prefiero no decir nada.", next: "adultoReserva" }
    ]
  },

  adultoHablar: {
    chapter: "SITUACIÓN 03",
    category: "UNA NUEVA DECISIÓN",
    title: "Hacer lo correcto",
    description: "El adulto decide intervenir. Algunos compañeros podrían molestarse con vos por haber hablado. ¿Qué hacés?",
    options: [
      { text: "Mantengo mi decisión porque hice lo correcto.", next: "finalValiente" },
      { text: "Me alejo para evitar problemas.", next: "finalFuerte" }
    ]
  },

  adultoReserva: {
    chapter: "SITUACIÓN 03",
    category: "UNA NUEVA DECISIÓN",
    title: "El silencio también decide",
    description: "Al no contar lo que pasó, la situación continúa. Te preguntás si podrías haber hecho algo diferente. ¿Qué harías?",
    options: [
      { text: "Busco a otro adulto de confianza.", next: "finalAprendizaje" },
      { text: "Decido no involucrarme.", next: "finalTriste" }
    ]
  },

  silencio: {
    chapter: "SITUACIÓN 02",
    category: "TU DECISIÓN",
    title: "Mirar hacia otro lado",
    description: "Seguís con tu día, pero al otro día volvés a ver la misma situación. Tu compañero está cada vez más aislado. ¿Qué hacés?",
    options: [
      { text: "Me acerco y trato de ayudarlo.", next: "silencioAcercar" },
      { text: "Pienso que no es mi problema.", next: "silencioAlejar" }
    ]
  },

  silencioAcercar: {
    chapter: "SITUACIÓN 03",
    category: "UNA NUEVA DECISIÓN",
    title: "Todavía estás a tiempo",
    description: "Decidís acercarte. Tu compañero se sorprende, pero agradece que alguien se preocupe por él. ¿Cómo seguís?",
    options: [
      { text: "Lo acompaño y busco ayuda si hace falta.", next: "finalValiente" },
      { text: "Le digo que todo va a estar bien y me voy.", next: "finalAprendizaje" }
    ]
  },

  silencioAlejar: {
    chapter: "SITUACIÓN 03",
    category: "UNA NUEVA DECISIÓN",
    title: "Una oportunidad para pensar",
    description: "La situación continúa y te das cuenta de que tu silencio también tuvo consecuencias. ¿Qué decidís hacer?",
    options: [
      { text: "Reconozco que puedo cambiar mi actitud.", next: "finalAprendizaje" },
      { text: "Sigo sin involucrarme.", next: "finalTriste" }
    ]
  }
};

const endings = {
  finalValiente: {
    icon: "🔥",
    title: "¡Sos un adolescente valiente!",
    description: "Elegiste actuar con amor y hacer lo correcto, incluso cuando podía ser difícil. Ser valiente no significa no tener miedo, sino decidir hacer lo correcto a pesar de él.",
    reflection: "Dios nos llama a ser valientes y a no quedarnos indiferentes frente a la injusticia.",
    verse: "«Mirá que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo».",
    reference: "Josué 1:9"
  },

  finalFuerte: {
    icon: "💪",
    title: "¡Sos un adolescente fuerte!",
    description: "Elegiste enfrentar una situación complicada. La verdadera fortaleza también está en reconocer cuándo necesitamos ayuda y seguir adelante.",
    reflection: "Dios nos da fuerzas para enfrentar los desafíos y aprender de cada experiencia.",
    verse: "«Todo lo puedo en Cristo que me fortalece».",
    reference: "Filipenses 4:13"
  },

  finalTriste: {
    icon: "💙",
    title: "Siempre podés volver a intentarlo",
    description: "Esta vez elegiste alejarte de la situación. Eso no significa que seas una mala persona. Todos podemos equivocarnos, aprender y elegir algo diferente la próxima vez.",
    reflection: "Dios se preocupa por quienes sufren y nos invita a ser instrumentos de amor y compañía.",
    verse: "«Cercano está Jehová a los quebrantados de corazón».",
    reference: "Salmos 34:18"
  },

  finalAprendizaje: {
    icon: "🌱",
    title: "Sos un adolescente en crecimiento",
    description: "Tus decisiones muestran que todavía hay cosas por aprender. Lo importante es reflexionar, reconocer nuestros errores y estar dispuestos a cambiar.",
    reflection: "Escuchar, pensar antes de actuar y aprender de nuestros errores también forman parte de crecer en Cristo.",
    verse: "«Todo hombre sea pronto para oír, tardo para hablar, tardo para airarse».",
    reference: "Santiago 1:19"
  }
};

// ==========================================
// FUNCIONES GENERALES
// ==========================================

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.add("hidden");
  });

  const screen = document.getElementById(screenId);

  if (screen) {
    screen.classList.remove("hidden");
  }
}

function startGame() {
  clearInterval(timerInterval);

  decisions = [];
  locked = false;
  currentScene = "inicio";

  showScreen("game");
  loadScene(currentScene);
}

// ==========================================
// CARGAR ESCENARIO
// ==========================================

function loadScene(sceneId) {
  clearInterval(timerInterval);

  const scene = scenes[sceneId];

  if (!scene) return;

  currentScene = sceneId;
  locked = false;

  document.getElementById("chapter").textContent = scene.chapter;
  document.getElementById("category").textContent = scene.category;
  document.getElementById("title").textContent = scene.title;
  document.getElementById("description").textContent = scene.description;

  const progress = document.getElementById("progress");
  progress.style.width = Math.min(decisions.length * 30, 90) + "%";

  const optionsContainer = document.getElementById("options");
  optionsContainer.innerHTML = "";

  scene.options.forEach(option => {
    const button = document.createElement("button");

    button.className = "option-btn";
    button.textContent = option.text;

    button.addEventListener("click", () => chooseOption(option));

    optionsContainer.appendChild(button);
  });

  const timeout = document.getElementById("timeout");
  timeout.classList.add("hidden");

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
// ELEGIR OPCIÓN
// ==========================================

function chooseOption(option) {
  if (locked) return;

  locked = true;
  clearInterval(timerInterval);

  decisions.push({
    scene: currentScene,
    answer: option.text
  });

  if (endings[option.next]) {
    showResult(option.next);
  } else {
    loadScene(option.next);
  }
}

// ==========================================
// RESULTADOS
// ==========================================

function showResult(endingId) {
  clearInterval(timerInterval);

  const ending = endings[endingId];

  if (!ending) return;

  document.getElementById("progress").style.width = "100%";

  document.getElementById("result-icon").textContent = ending.icon;
  document.getElementById("result-title").textContent = ending.title;
  document.getElementById("result-description").textContent = ending.description;
  document.getElementById("reflection-text").textContent = ending.reflection;
  document.getElementById("verse-text").textContent =
    ending.verse + " — " + ending.reference;

  const historyList = document.getElementById("history-list");
  historyList.innerHTML = "";

  decisions.forEach((decision, index) => {
    const item = document.createElement("li");
    item.textContent = "Decisión " + (index + 1) + ": " + decision.answer;
    historyList.appendChild(item);
  });

  document.getElementById("history").classList.add("hidden");

  showScreen("result");
}

// ==========================================
// HISTORIAL
// ==========================================

function toggleHistory() {
  document.getElementById("history").classList.toggle("hidden");
}

// ==========================================
// REINICIAR
// ==========================================

function restartGame() {
  clearInterval(timerInterval);

  timeLeft = TOTAL_TIME;
  decisions = [];
  locked = false;
  currentScene = "inicio";

  updateTimer();
  showScreen("home");
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  showScreen("home");

  const startButton = document.querySelector("#home .main-button");

  if (startButton) {
    startButton.addEventListener("click", startGame);
  }
});
