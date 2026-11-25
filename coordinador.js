
  const SUPABASE_URL = 'https://gukcxxqjmtfwtgmomsmw.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_XMTtJvCl_yp95piX9uXQww_a8EwEJ7f';
  const ROOM_CODE = 'VALIENTE2026';
  const VOTING_SECONDS = 45;

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let serverTimeOffset = 0;
let serverClockSynced = false;

async function syncServerClock() {
  const requestStart = Date.now();

  const { data, error } = await db.rpc('get_server_time');

  const requestEnd = Date.now();

  if (error) throw error;

  const serverTime = new Date(data).getTime();
  const browserMidpoint = (requestStart + requestEnd) / 2;

  serverTimeOffset = serverTime - browserMidpoint;
  serverClockSynced = true;

  console.log('RELOJ SINCRONIZADO:', {
    diferenciaSegundos: (serverTimeOffset / 1000).toFixed(2)
  });
}

function getServerNow() {
  return Date.now() + serverTimeOffset;
}

  const $ = (id) => document.getElementById(id);

  let currentRoom = null;
  let currentChapter = null;
  let roomSubscription = null;
  let countdownInterval = null;
  let closingVoting = false;
  let loadingAction = false;
  let renderVersion = 0;

  function message(text, isError = false) {
    $('dashboardMessage').textContent = text;
    $('dashboardMessage').classList.toggle('error', isError);
  }

  function loginMessage(text, isError = false) {
    $('loginMessage').textContent = text;
    $('loginMessage').classList.toggle('error', isError);
  }

  function statusLabel(status) {
    const labels = {
      lobby: 'Esperando el inicio',
      voting: 'Votación en curso',
      results: 'Resultados',
      consequence: 'Consecuencia',
      final: 'Final de la historia',
      survey: 'Encuesta',
      finished: 'Partida finalizada'
    };
    return labels[status] || status || 'Sin estado';
  }

  function showDashboard() {
    $('loginPanel').classList.add('hidden');
    $('dashboard').classList.remove('hidden');
  }

  function showLogin() {
    $('dashboard').classList.add('hidden');
    $('loginPanel').classList.remove('hidden');
  }

  function setActionsDisabled(disabled) {
    document.querySelectorAll('#gameActions button').forEach(button => {
      button.disabled = disabled;
    });
  }

  function addButton(label, callback, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (className) button.className = className;
    button.addEventListener('click', callback);
    $('gameActions').appendChild(button);
  }

  function addText(parent, text, className = '') {
    const element = document.createElement('p');
    element.textContent = text;
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  }

  function addOption(letter, text) {
    const option = document.createElement('div');
    option.className = 'option';

    const strong = document.createElement('strong');
    strong.textContent = `OPCIÓN ${letter}`;

    const content = document.createElement('div');
    content.textContent = text;

    option.append(strong, content);
    $('gameContent').appendChild(option);
  }

  async function loadRoom() {
    const { data, error } = await db
      .from('rooms')
      .select('*')
      .eq('room_code', ROOM_CODE)
      .single();

    if (error) throw new Error('No se pudo acceder a la sala: ' + error.message);

    currentRoom = data;
    $('roomStatus').textContent = statusLabel(data.status);
  }

  async function loadParticipants() {
    if (!currentRoom) return;

    $('participantList').textContent = 'Cargando participantes...';

    const { data, error } = await db
      .from('participants')
      .select('id, display_name, created_at')
      .eq('room_id', currentRoom.id)
      .order('created_at', { ascending: true });

    if (error) {
      $('participantList').textContent = 'No se pudo cargar la lista.';
      message(error.message, true);
      return;
    }

    $('participantCount').textContent = data.length;
    $('participantList').innerHTML = '';

    if (!data.length) {
      $('participantList').textContent = 'Todavía no ingresó ningún participante.';
      return;
    }

    data.forEach((participant, index) => {
      const row = document.createElement('div');
      row.className = 'participant';

      const name = document.createElement('span');
      name.textContent = participant.display_name;

      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = `#${index + 1}`;

      row.append(name, number);
      $('participantList').appendChild(row);
    });
  }

  async function loadChapter(number) {
    const { data, error } = await db
      .from('chapters')
      .select('*')
      .eq('chapter_number', number)
      .single();

    if (error) throw new Error('No se pudo cargar el capítulo: ' + error.message);

    currentChapter = data;
    return data;
  }

  async function refreshRoom() {
    await loadRoom();
    await renderGame();
  }

 

async function startVoting() {
  if (loadingAction) return;
  loadingAction = true;
  message('Iniciando votación...');

  try {

    await syncServerClock();
    const nextChapter = currentRoom.current_chapter + 1;

    const horaAntesRPC = new Date().toISOString();

    const { data, error } = await db.rpc('start_voting', {
      p_chapter_number: nextChapter,
      p_duration_seconds: VOTING_SECONDS
    });

    const horaDespuesRPC = new Date().toISOString();

    if (error) throw error;

    console.log('DIAGNÓSTICO INMEDIATO RPC:', {
      horaAntesRPC,
      horaDespuesRPC,
      fechaInicioServidor: data?.ends_at
        ? new Date(new Date(data.ends_at).getTime() - 15000).toISOString()
        : null,
      fechaFinRPC: data?.ends_at,
      segundosRestantes: data?.ends_at
        ? (new Date(data.ends_at).getTime() - Date.now()) / 1000
        : null
    });

    await loadRoom();

    console.log('DIAGNÓSTICO DESPUÉS DE LOADROOM:', {
      hora: new Date().toISOString(),
      estado: currentRoom.status,
      fechaFinSala: currentRoom.voting_ends_at,
      segundosRestantes: (
        new Date(currentRoom.voting_ends_at).getTime() - Date.now()
      ) / 1000
    });

    await renderGame();
    message(`¡Capítulo ${nextChapter} iniciado!`);

  } catch (error) {
    message(error.message, true);
  } finally {
    loadingAction = false;
  }
}

  async function closeVotingAutomatically() {
    if (closingVoting || !currentRoom || currentRoom.status !== 'voting') return;

    closingVoting = true;
    message('Tiempo terminado. Cerrando votación...');

    const { error } = await db.rpc('close_voting');

    if (error) {
      message(error.message, true);
      closingVoting = false;
      return;
    }

    await refreshRoom();
    closingVoting = false;
  }

  async function loadResults() {
    const { data, error } = await db.rpc('coordinator_vote_results', {
      p_chapter_number: currentRoom.current_chapter
    });

    if (error) throw new Error('No se pudieron cargar los resultados: ' + error.message);

    const counts = { A: 0, B: 0 };

    (data || []).forEach(row => {
      counts[row.choice] = Number(row.vote_count);
    });

    return counts;
  }

  async function resolveTie(choice) {
    if (loadingAction) return;
    loadingAction = true;

    try {
      const { error } = await db.rpc('resolve_vote_tie', {
        p_choice: choice
      });

      if (error) throw error;

      await refreshRoom();
      message(`Desempate resuelto: continúa la opción ${choice}.`);
    } catch (error) {
      message(error.message, true);
    } finally {
      loadingAction = false;
    }
  }

  async function advanceAfterResults() {
    if (loadingAction) return;
    loadingAction = true;

    try {
      const { error } = await db.rpc('advance_after_results');
      if (error) throw error;

      await refreshRoom();
      message('La historia avanzó correctamente.');
    } catch (error) {
      message(error.message, true);
    } finally {
      loadingAction = false;
    }
  }

  async function openSurvey() {
    if (loadingAction) return;
    loadingAction = true;

    try {
      const { error } = await db.rpc('open_survey');
      if (error) throw error;

      await refreshRoom();
      message('La encuesta ya está habilitada.');
    } catch (error) {
      message(error.message, true);
    } finally {
      loadingAction = false;
    }
  }

  async function finishRoom() {
    if (loadingAction) return;
    loadingAction = true;

    try {
      const { error } = await db.rpc('finish_room');
      if (error) throw error;

      await refreshRoom();
      message('La partida fue finalizada.');
    } catch (error) {
      message(error.message, true);
    } finally {
      loadingAction = false;
    }
  }


async function resetRoom() {
  if (loadingAction) return;

  const confirmed = confirm(
    '¿Estás seguro de reiniciar la partida?\n\n' +
    'Se eliminarán todos los votos y respuestas de encuestas anteriores. ' +
    'La sala volverá al capítulo 1.'
  );

  if (!confirmed) return;

  loadingAction = true;
  message('Reiniciando partida...');

  try {
    const { error } = await db.rpc('reset_room');

    if (error) throw error;

    await refreshRoom();

    message('Partida reiniciada correctamente. ¡Ya podés comenzar de nuevo!');
  } catch (error) {
    message(error.message, true);
  } finally {
    loadingAction = false;
  }
}

    async function renderGame() {
    if (!currentRoom) return;

    const thisRender = ++renderVersion;

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    $('roomStatus').textContent = statusLabel(currentRoom.status);
    $('gameActions').innerHTML = '';
    $('gameContent').innerHTML = '';

    const status = currentRoom.status;
    const chapterNumber = currentRoom.current_chapter || 0;

    if (status === 'lobby') {
      $('gameTitle').textContent = 'La historia está lista';
      addText($('gameContent'), 'Los participantes pueden ingresar desde sus celulares. Cuando estén todos listos, iniciá el primer capítulo.');
      addButton('INICIAR CAPÍTULO 1', startVoting);
      return;
    }

    if (status === 'voting') {
      await loadChapter(chapterNumber);
      if (thisRender !== renderVersion) return;

      $('gameTitle').textContent = `Capítulo ${chapterNumber}: ${currentChapter.title}`;

      addText($('gameContent'), currentChapter.situation, 'story-text');
      addOption('A', currentChapter.option_a);
      addOption('B', currentChapter.option_b);

      const countdown = document.createElement('div');
      countdown.className = 'countdown';
      countdown.id = 'countdown';
      $('gameContent').appendChild(countdown);

      addText($('gameContent'), 'Los participantes están votando desde sus celulares.');

      function updateCountdown() {
  const end = new Date(currentRoom.voting_ends_at).getTime();

  const remaining = Math.max(
    0,
    Math.ceil((end - getServerNow()) / 1000)
  );

  const timer = $('countdown');
  if (timer) timer.textContent = remaining;

  if (remaining <= 0) {
    closeVotingAutomatically();
  }
}

      updateCountdown();
      countdownInterval = setInterval(updateCountdown, 250);
      return;
    }


if (status === 'results') {
  await loadChapter(chapterNumber);

  if (thisRender !== renderVersion) return;

  const counts = await loadResults();

  if (thisRender !== renderVersion) return;

      $('gameTitle').textContent = `Resultados del capítulo ${chapterNumber}`;

      addText($('gameContent'), currentChapter.title, 'section-label');

      const grid = document.createElement('div');
      grid.className = 'vote-grid';

      [['A', counts.A], ['B', counts.B]].forEach(([letter, count]) => {
        const card = document.createElement('div');
        card.className = 'vote-card';

        const label = document.createElement('div');
        label.textContent = `OPCIÓN ${letter}`;

        const number = document.createElement('div');
        number.className = 'vote-number';
        number.textContent = count;

        card.append(label, number);
        grid.appendChild(card);
      });

      $('gameContent').appendChild(grid);

      const winner = currentRoom.winning_choice;

      if (winner) {
        addText($('gameContent'), `La opción ganadora es ${winner}.`);
        addButton('MOSTRAR CONSECUENCIA', advanceAfterResults);
      } else {
        addText($('gameContent'), 'Hay un empate. Elegí qué opción continuará en la historia.');
        addButton('ELEGIR OPCIÓN A', () => resolveTie('A'), 'choice');
        addButton('ELEGIR OPCIÓN B', () => resolveTie('B'), 'choice');
      }
      return;
    }

    if (status === 'consequence') {
      await loadChapter(chapterNumber);
      if (thisRender !== renderVersion) return;

      $('gameTitle').textContent = `Consecuencia del capítulo ${chapterNumber}`;

      const winner = currentRoom.winning_choice;

      if (!winner) {
        addText($('gameContent'), 'No se encontró una opción ganadora. Revisá los resultados antes de continuar.');
        return;
      }

      addText($('gameContent'), `Ganó la opción ${winner}.`, 'section-label');
      addText(
        $('gameContent'),
        winner === 'A' ? currentChapter.consequence_a : currentChapter.consequence_b,
        'story-text'
      );

      addText($('gameContent'), 'Cuando termines de presentar esta consecuencia, podés continuar.');

      if (chapterNumber < 7) {
        addButton(`INICIAR CAPÍTULO ${chapterNumber + 1}`, startVoting);
      }
      return;
    }

    if (status === 'final') {
      await loadChapter(7);
      if (thisRender !== renderVersion) return;

      $('gameTitle').textContent = 'Final de la historia';

      const winner = currentRoom.winning_choice;

      addText(
        $('gameContent'),
        winner === 'A' ? currentChapter.consequence_a : currentChapter.consequence_b,
        'story-text'
      );

      addText($('gameContent'), 'Cuando todos hayan terminado de leer y compartir este final, habilitá la encuesta.');
      addButton('HABILITAR ENCUESTA', openSurvey);
      return;
    }

    if (status === 'survey') {
      $('gameTitle').textContent = 'Encuesta de satisfacción';
      addText($('gameContent'), 'La encuesta ya está habilitada para los participantes.');
      addButton('FINALIZAR PARTIDA', finishRoom);
      return;
    }

    
if (status === 'finished') {
  $('gameTitle').textContent = 'Partida finalizada';

  addText(
    $('gameContent'),
    'La experiencia terminó. Las respuestas de la encuesta quedaron guardadas en Supabase.'
  );

  addButton(
    'REINICIAR PARTIDA',
    resetRoom,
    'choice'
  );

  return;
}


    $('gameTitle').textContent = 'Estado desconocido';
    addText($('gameContent'), 'No se reconoce el estado actual de la sala.');
  }

  function subscribeToRoom() {
    if (roomSubscription || !currentRoom) return;

    roomSubscription = db
      .channel('coordinator-room-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${currentRoom.id}`
        },
        async (payload) => {
          currentRoom = { ...currentRoom, ...payload.new };
          try {
            await renderGame();
          } catch (error) {
            message(error.message, true);
          }
        }
      )
      .subscribe();
  }

  async function enterDashboard() {
    try {
      await loadRoom();
      showDashboard();
      await loadParticipants();
      await renderGame();
      subscribeToRoom();
    } catch (error) {
      showLogin();
      loginMessage(error.message, true);
      await db.auth.signOut();
    }
  }

  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    $('loginButton').disabled = true;
    $('loginButton').textContent = 'Ingresando...';
    loginMessage('');

    const email = $('email').value.trim();
    const password = $('password').value;

    try {
      await db.auth.signOut();

      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;

      await enterDashboard();
    } catch (error) {
      loginMessage('No se pudo iniciar sesión: ' + error.message, true);
    } finally {
      $('loginButton').disabled = false;
      $('loginButton').textContent = 'Ingresar al panel';
    }
  });

  $('refreshButton').addEventListener('click', loadParticipants);

  $('logoutButton').addEventListener('click', async () => {
    if (countdownInterval) clearInterval(countdownInterval);

    if (roomSubscription) {
      await db.removeChannel(roomSubscription);
      roomSubscription = null;
    }

    await db.auth.signOut();
    currentRoom = null;
    currentChapter = null;
    showLogin();
    loginMessage('Sesión cerrada.');
  });

  async function restoreSession() {
    const { data } = await db.auth.getSession();

    if (data.session) {
      await enterDashboard();
    }
  }

  restoreSession();
