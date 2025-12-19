// --- FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAeY6vL0LfSglgXAu7NBsxih2VquuqVqBg",
  authDomain: "rarincocalendario.firebaseapp.com",
  projectId: "rarincocalendario",
  storageBucket: "rarincocalendario.firebasestorage.app",
  messagingSenderId: "166310143500",
  appId: "1:166310143500:web:649a48727d5ced6028f029",
  measurementId: "G-NB014GEB1J",
};

// Inicializar Firebase (solo si hay config, para evitar errores antes de pegar los datos)
let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase no configurado aún o error en config:", e);
}

document.addEventListener("DOMContentLoaded", function () {
  // --- 1. ESTRUCTURA DE DATOS ---

  let appData = {
    jobs: {},
    schedule: {},
  };

  const jobForm = document.getElementById("job-form");
  const ganttHead = document.getElementById("gantt-head");
  const ganttBody = document.getElementById("gantt-body");
  let sevenDayKeys = [];

  // --- 2. FUNCIONES DE DATOS (FIREBASE) ---

  // Pequeña función para mostrar estado en la UI (arriba a la derecha)
  function showStatus(message, color = "black") {
    let statusEl = document.getElementById("app-status");
    if (!statusEl) {
      statusEl = document.createElement("div");
      statusEl.id = "app-status";
      statusEl.style.position = "fixed";
      statusEl.style.top = "10px";
      statusEl.style.right = "10px";
      statusEl.style.padding = "5px 10px";
      statusEl.style.background = "rgba(255,255,255,0.9)";
      statusEl.style.border = "1px solid #ccc";
      statusEl.style.zIndex = "9999";
      document.body.appendChild(statusEl);
    }
    statusEl.textContent = message;
    statusEl.style.color = color;

    // Borrar mensaje después de 3 seg
    setTimeout(() => {
      if (statusEl.textContent === message) statusEl.textContent = "";
    }, 3000);
  }

  async function saveData() {
    if (!db) {
      showStatus("Error: No conectado a Firebase", "red");
      return;
    }
    showStatus("Guardando...", "blue");
    try {
      await setDoc(doc(db, "organizador", "data"), appData);
      console.log("Datos guardados en Firebase");
      showStatus("¡Guardado en la nube!", "green");
    } catch (e) {
      console.error("Error al guardar:", e);
      showStatus("Error al guardar: " + e.message, "red");
    }
  }

  function loadData() {
    if (!db) {
      showStatus("Modo Offline (Local o Error Config)", "orange");
      console.warn(
        "Base de datos no inicializada. Usando datos de ejemplo locales."
      );
      initExampleData();
      renderApp();
      return;
    }

    // Escuchar cambios en tiempo real
    onSnapshot(
      doc(db, "organizador", "data"),
      (docSnap) => {
        if (docSnap.exists()) {
          appData = docSnap.data();
          // Asegurar estructura
          if (!appData.jobs) appData.jobs = {};
          if (!appData.schedule) appData.schedule = {};
          renderApp();
          showStatus("Sincronizado", "green");
        } else {
          console.log("No hay datos en Firebase. Creando ejemplo...");
          initExampleData();
          saveData(); // Guardar el ejemplo inicial en la nube
          renderApp();
        }
      },
      (error) => {
        console.error("Error al escuchar cambios:", error);
        showStatus("Error Conexión: " + error.message, "red");
      }
    );
  }

  function initExampleData() {
    const exampleJobId = "job-inicio";
    appData.jobs = {};
    appData.jobs[exampleJobId] = {
      id: exampleJobId,
      titulo: "Trabajo de Ejemplo",
      procesos: [
        { nombre: "Arrastrarme", dias: 1 },
        { nombre: "Completar", dias: 2 },
      ],
    };
    appData.schedule = {};
  }

  // --- 3. FUNCIONES DE RENDERIZADO ---

  function renderApp() {
    generateDayKeys();
    renderGanttHead();
    renderGanttBody();
  }

  function generateDayKeys() {
    sevenDayKeys = [];
    const hoy = new Date();
    hoy.setHours(12, 0, 0, 0); // Normalizar a mediodía para evitar problemas de UTC/Local en toISOString
    let diasAgregados = 0;
    let offset = 0;

    while (diasAgregados < 7) {
      const diaActual = new Date(hoy);
      diaActual.setDate(hoy.getDate() + offset);
      const diaSemana = diaActual.getDay(); // 0 = Domingo, 6 = Sábado

      // Solo agregar si NO es sábado (6) ni domingo (0)
      if (diaSemana !== 0 && diaSemana !== 6) {
        sevenDayKeys.push(getISODate(diaActual));
        diasAgregados++;
      }
      offset++;
    }
  }

  function renderGanttHead() {
    ganttHead.innerHTML = "";
    let headerHTML = "<tr>";

    headerHTML += '<th class="col-pending">Trabajos (Plantillas)</th>';
    headerHTML += '<th class="col-duration">Duración Total</th>';
    headerHTML += '<th class="col-action">Acción</th>';

    sevenDayKeys.forEach((dayKey, i) => {
      const diaActual = new Date(dayKey + "T12:00:00");
      const nombreDia = diaActual.toLocaleDateString("es-ES", {
        weekday: "short",
      });
      const fecha = diaActual.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "numeric",
      });
      const esHoy = i === 0 ? "today" : "";

      headerHTML += `<th class="day-header ${esHoy}">
                <div>${
                  nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)
                }</div>
                <div>${fecha}</div>
            </th>`;
    });
    headerHTML += "</tr>";
    ganttHead.innerHTML = headerHTML;
  }

  function renderGanttBody() {
    ganttBody.innerHTML = "";
    const allJobIds = Object.keys(appData.jobs);

    allJobIds.forEach((jobId) => {
      const job = appData.jobs[jobId];
      if (!job) return;

      const tr = document.createElement("tr");

      // Columna 1: Plantilla
      const tdPending = document.createElement("td");
      tdPending.classList.add("day-cell");
      tdPending.dataset.date = "pending";
      addDropEvents(tdPending);
      tdPending.appendChild(createJobElement(job));
      tr.appendChild(tdPending);

      // Columna 2: Duración
      const tdDuration = document.createElement("td");
      tdDuration.className = "col-duration";
      const totalDuration = job.procesos.reduce((sum, p) => sum + p.dias, 0);
      tdDuration.textContent = `${totalDuration} día(s)`;
      tr.appendChild(tdDuration);

      // Columna 3: Acción (con el botón "Ok")
      const tdAction = document.createElement("td");
      tdAction.className = "action-cell";
      tdAction.innerHTML = `<button class="delete-btn" data-job-id="${job.id}">Ok</button>`;
      tr.appendChild(tdAction);

      // Columnas 4-10: Días
      const startDateStr = appData.schedule[jobId];

      sevenDayKeys.forEach((dayKey) => {
        const tdDay = document.createElement("td");
        tdDay.classList.add("day-cell");
        tdDay.dataset.date = dayKey;
        addDropEvents(tdDay);

        if (startDateStr) {
          const dayOffset = getBusinessDaysDifference(startDateStr, dayKey);
          if (dayOffset >= 0) {
            let dayCounter = 0;
            for (const proceso of job.procesos) {
              if (
                dayOffset >= dayCounter &&
                dayOffset < dayCounter + proceso.dias
              ) {
                tdDay.appendChild(createProcessElement(job, proceso.nombre));
                break;
              }
              dayCounter += proceso.dias;
            }
          }
        }
        tr.appendChild(tdDay);
      });

      ganttBody.appendChild(tr);
    });
  }

  // "Fábrica" para el item arrastrable
  function createJobElement(job) {
    const jobElement = document.createElement("div");
    jobElement.classList.add("job-item");
    jobElement.draggable = true;
    jobElement.dataset.jobId = job.id;
    jobElement.textContent = job.titulo;
    jobElement.addEventListener("dragstart", handleDragStart);
    jobElement.addEventListener("dragend", handleDragEnd);
    return jobElement;
  }

  // "Fábrica" para el item visual del proceso (solo con el nombre)
  function createProcessElement(job, processName) {
    const processElement = document.createElement("div");
    processElement.classList.add("process-item");
    processElement.title = `${job.titulo}: ${processName}`;
    processElement.innerHTML = `${processName}`;
    return processElement;
  }

  // --- 4. LÓGICA DEL FORMULARIO ---

  jobForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const titulo = document.getElementById("job-title").value;
    const processesText = document.getElementById("job-processes").value;
    const procesos = processesText
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const parts = line.split(":");
        const nombre = parts[0].trim();
        let dias = 1;
        if (parts.length > 1) {
          const diasNum = parseInt(parts[1].trim());
          if (!isNaN(diasNum) && diasNum > 0) {
            dias = diasNum;
          }
        }
        return { nombre: nombre, dias: dias };
      });

    if (titulo.trim() === "" || procesos.length === 0) {
      alert(
        "Por favor, completa el título y al menos un proceso (Ej: Imprimir: 2)."
      );
      return;
    }

    const newJob = {
      id: "job-" + Date.now(),
      titulo: titulo,
      procesos: procesos,
    };

    appData.jobs[newJob.id] = newJob;

    saveData();
    renderApp();
    jobForm.reset();
  });

  // --- 5. LÓGICA DE DRAG AND DROP ---

  let draggedJobId = null;

  function handleDragStart(e) {
    draggedJobId = e.target.dataset.jobId;
    setTimeout(() => {
      e.target.classList.add("dragging");
    }, 0);
  }

  function handleDragEnd(e) {
    e.target.classList.remove("dragging");
    draggedJobId = null;
  }

  function addDropEvents(cell) {
    cell.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.currentTarget.classList.add("drag-over");
    });
    cell.addEventListener("dragleave", (e) => {
      e.currentTarget.classList.remove("drag-over");
    });
    cell.addEventListener("drop", handleDrop);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    if (!draggedJobId) return;

    const targetDateKey = e.currentTarget.dataset.date;

    delete appData.schedule[draggedJobId];

    if (targetDateKey !== "pending") {
      appData.schedule[draggedJobId] = targetDateKey;
    }

    saveData();
    renderApp();
  }

  // --- 6. LÓGICA DE CLIC (ELIMINAR) ---

  ganttBody.addEventListener("click", function (e) {
    if (e.target.classList.contains("delete-btn")) {
      const jobId = e.target.dataset.jobId;
      handleDeleteJob(jobId);
    }
  });

  function handleDeleteJob(jobId) {
    const job = appData.jobs[jobId];
    const confirmDelete = confirm(
      `¿Estás seguro de que quieres eliminar la plantilla "${job.titulo}"? Esta acción no se puede deshacer.`
    );

    if (confirmDelete) {
      delete appData.jobs[jobId];
      delete appData.schedule[jobId];
      saveData();
      renderApp();
    }
  }

  // --- 7. FUNCIONES UTILITARIAS ---

  function getISODate(date) {
    return date.toISOString().split("T")[0];
  }

  // Retorna la diferencia en días hábiles (Lun-Vie)
  // Positive si dateStr2 > dateStr1
  function getBusinessDaysDifference(startStr, targetStr) {
    const dStart = new Date(startStr + "T12:00:00");
    const dTarget = new Date(targetStr + "T12:00:00");

    if (dTarget < dStart) return -1; // Target is before start
    if (startStr === targetStr) return 0;

    let businessDays = 0;
    let current = new Date(dStart);
    current.setDate(current.getDate() + 1); // Empezamos a contar desde el siguiente día

    // Iterar hasta llegar al target inclusive
    while (current <= dTarget) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        // Si NO es finde
        businessDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    return businessDays;
  }

  function differenceInDays(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1 + "T12:00:00");
    const d2 = new Date(dateStr2 + "T12:00:00");
    const diffTime = d1.getTime() - d2.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  // --- 8. INICIAR LA APLICACIÓN ---
  // (Este es el orden correcto: iniciar la app primero)
  loadData();
  // renderApp(); // Se maneja dentro de loadData (snapshot callback)

  // --- 9. REGISTRAR EL SERVICE WORKER (PARA PWA) ---
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log(
            "Service Worker registrado con éxito:",
            registration.scope
          );
        })
        .catch((err) => {
          console.log("Error al registrar el Service Worker:", err);
        });
    });
  }
});
