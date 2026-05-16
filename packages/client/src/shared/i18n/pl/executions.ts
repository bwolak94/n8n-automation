import type { ExecutionsMessages } from "../en/executions.js";

const executions: ExecutionsMessages = {
  title: "Wykonania",
  id: "ID wykonania",
  status: "Status",
  startedAt: "Rozpoczęto",
  completedAt: "Zakończono",
  duration: "Czas trwania",
  trigger: "Wyzwalacz",
  logs: "Logi",
  steps: "Kroki",
  cancel: "Anuluj wykonanie",
  retry: "Ponów",
  statuses: {
    pending: "Oczekuje",
    running: "Wykonywanie",
    completed: "Zakończono",
    failed: "Błąd",
    cancelled: "Anulowano",
  },
  empty: "Brak wykonań",
  streamingLogs: "Strumieniowanie logów...",
};

export { executions };
