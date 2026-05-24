const SECTORS = [
  "Здоровье",
  "Друзья",
  "Семья",
  "Образование",
  "Деньги",
  "Духовность",
  "Личностный рост",
  "Яркость жизни",
];

const STORAGE_KEY = "balancePlannerData";
const TEXT_LIMIT = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_LOAD_ERROR =
  "Не удалось загрузить сохраненные данные. Возможно, они повреждены. Вы можете сбросить данные и начать заново";
const FORM_VALIDATION_ERROR = "Введите текст задачи.";

const state = {
  currentWeekId: "",
  weekStartDate: null,
  data: initEmptyData(),
  chartInstance: null,
  draggedTaskId: null,
  editingTaskId: null,
};

const elements = {
  prevWeekBtn: document.getElementById("prevWeekBtn"),
  todayBtn: document.getElementById("todayBtn"),
  nextWeekBtn: document.getElementById("nextWeekBtn"),
  weekRange: document.getElementById("weekRange"),
  todayDate: document.getElementById("todayDate"),
  taskForm: document.getElementById("taskForm"),
  taskText: document.getElementById("taskText"),
  taskDate: document.getElementById("taskDate"),
  taskSector: document.getElementById("taskSector"),
  taskModal: document.getElementById("taskModal"),
  editTaskText: document.getElementById("editTaskText"),
  editTaskDate: document.getElementById("editTaskDate"),
  editTaskSector: document.getElementById("editTaskSector"),
  editTaskDone: document.getElementById("editTaskDone"),
  saveTaskBtn: document.getElementById("saveTaskBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  balanceChart: document.getElementById("balanceChart"),
  chartFallback: document.getElementById("chartFallback"),
  weekStats: document.getElementById("weekStats"),
  formError: document.getElementById("formError"),
  weekGrid: document.getElementById("weekGrid"),
};

const DAY_LABELS = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

const SECTOR_CLASS_BY_NAME = {
  Здоровье: "sector-health",
  Друзья: "sector-friends",
  Семья: "sector-relationships",
  Образование: "sector-career",
  Деньги: "sector-money",
  Духовность: "sector-soul",
  "Личностный рост": "sector-growth",
  "Яркость жизни": "sector-brightness",
};

const CHART_COLORS = [
  "#cdeecf",
  "#cceefa",
  "#f7cdda",
  "#cbdff8",
  "#f7edb7",
  "#dfd0f5",
  "#c7eee9",
  "#f8d4b6",
];

const rangeDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const todayDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const optionDayFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
});

const optionDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
});

function initEmptyData() {
  return {
    version: 1,
    weeks: {},
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidData(value) {
  return isPlainObject(value) && value.version === 1 && isPlainObject(value.weeks);
}

function showStorageLoadError() {
  if (elements.formError) {
    elements.formError.textContent = STORAGE_LOAD_ERROR;
  }
}

function writeDataToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    showStorageLoadError();
  }
}

function loadData() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);

    if (rawData === null) {
      const emptyData = initEmptyData();
      writeDataToStorage(emptyData);
      showStorageLoadError();
      return emptyData;
    }

    const parsedData = JSON.parse(rawData);

    if (!isValidData(parsedData)) {
      throw new Error("Invalid saved data structure");
    }

    return parsedData;
  } catch (error) {
    const emptyData = initEmptyData();

    writeDataToStorage(emptyData);
    showStorageLoadError();

    return emptyData;
  }
}

function saveData() {
  if (!isValidData(state.data)) {
    state.data = initEmptyData();
  }

  writeDataToStorage(state.data);
}

function getWeekData(weekId) {
  if (!state.data.weeks[weekId]) {
    state.data.weeks[weekId] = {
      tasks: [],
    };
  }

  if (!Array.isArray(state.data.weeks[weekId].tasks)) {
    state.data.weeks[weekId].tasks = [];
  }

  return state.data.weeks[weekId];
}

function getCurrentWeekTasks() {
  if (!state.currentWeekId) {
    return [];
  }

  return getWeekData(state.currentWeekId).tasks;
}

function findTaskById(taskId) {
  return getCurrentWeekTasks().find((task) => task.id === taskId) || null;
}

function removeTaskById(taskId) {
  const weekData = getWeekData(state.currentWeekId);
  const initialLength = weekData.tasks.length;

  weekData.tasks = weekData.tasks.filter((task) => task.id !== taskId);

  return weekData.tasks.length !== initialLength;
}

function createLocalDate(year, monthIndex, day) {
  return new Date(year, monthIndex, day);
}

function cloneDate(date) {
  return createLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const nextDate = cloneDate(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function getMonday(date) {
  const currentDate = cloneDate(date);
  const day = currentDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  currentDate.setDate(currentDate.getDate() + diff);
  return currentDate;
}

function getISOWeekId(date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const utcDay = utcDate.getUTCDay() || 7;

  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - utcDay);

  const isoYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNumber = Math.ceil(((utcDate - yearStart) / DAY_MS + 1) / 7);

  return `${isoYear}-W${String(weekNumber).padStart(2, "0")}`;
}

function getMondayFromISOWeekId(weekId) {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekId);

  if (!match) {
    throw new Error(`Invalid ISO week id: ${weekId}`);
  }

  const isoYear = Number(match[1]);
  const isoWeek = Number(match[2]);
  const januaryFourth = createLocalDate(isoYear, 0, 4);
  const firstWeekMonday = getMonday(januaryFourth);

  return addDays(firstWeekMonday, (isoWeek - 1) * 7);
}

function getWeekDates(weekStartDate) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index));
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return createLocalDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function isDateInCurrentWeek(dateValue) {
  if (!state.weekStartDate) {
    return false;
  }

  return getWeekDates(state.weekStartDate).some((date) => formatDateValue(date) === dateValue);
}

function isBeforeToday(dateValue) {
  const todayValue = formatDateValue(new Date());

  return dateValue < todayValue;
}

function capitalizeFirstLetter(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDisplayDate(date, formatter) {
  return formatter.format(date).replace(/\s?г\.$/, "");
}

function formatDateOptionLabel(date) {
  const dayName = capitalizeFirstLetter(optionDayFormatter.format(date));
  const dateLabel = optionDateFormatter.format(date);

  return `${dayName} (${dateLabel})`;
}

function generateTaskId() {
  const randomSuffix = Math.random().toString(36).slice(2, 9);

  return `task_${Date.now()}_${randomSuffix}`;
}

function getNextTaskOrder(weekId, dateValue) {
  const tasksForDate = getWeekData(weekId).tasks.filter((task) => task.date === dateValue);

  if (tasksForDate.length === 0) {
    return 0;
  }

  return Math.max(...tasksForDate.map((task) => Number(task.order) || 0)) + 1;
}

function setFormError(message) {
  if (elements.formError) {
    elements.formError.textContent = message;
  }
}

function formatWeekRange(weekStartDate) {
  const weekDates = getWeekDates(weekStartDate);
  const weekEndDate = weekDates[weekDates.length - 1];

  return `${formatDisplayDate(weekStartDate, rangeDateFormatter)} - ${formatDisplayDate(weekEndDate, rangeDateFormatter)}`;
}

function setCurrentWeek(date) {
  state.currentWeekId = getISOWeekId(date);
  state.weekStartDate = getMondayFromISOWeekId(state.currentWeekId);
}

function getSortedTasksForDate(dateValue) {
  return getCurrentWeekTasks()
    .filter((task) => task.date === dateValue)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

function createTaskCard(task) {
  const item = document.createElement("li");
  const card = document.createElement("article");
  const header = document.createElement("div");
  const statusLabel = document.createElement("label");
  const statusCheckbox = document.createElement("input");
  const text = document.createElement("p");
  const meta = document.createElement("p");
  const actions = document.createElement("div");
  const editButton = document.createElement("button");
  const deleteButton = document.createElement("button");
  const sectorClass = SECTOR_CLASS_BY_NAME[task.sector];
  const isDone = task.status === "done";
  const isOverdue = task.status === "planned" && isBeforeToday(task.date);

  card.className = "task-card";

  if (sectorClass) {
    card.classList.add(sectorClass);
  }

  if (isDone) {
    card.classList.add("is-done");
  }

  if (isOverdue) {
    card.classList.add("is-overdue");
  }

  card.dataset.taskId = task.id;
  card.draggable = true;
  header.className = "task-card-header";
  statusLabel.className = "task-status";
  statusCheckbox.type = "checkbox";
  statusCheckbox.checked = isDone;
  statusCheckbox.dataset.action = "toggle-status";
  statusCheckbox.setAttribute("aria-label", "Отметить задачу выполненной");
  statusLabel.append(statusCheckbox);

  if (isOverdue) {
    const overdueBadge = document.createElement("span");

    overdueBadge.className = "overdue-badge";
    overdueBadge.textContent = "Просрочено";
    statusLabel.append(overdueBadge);
  }

  text.className = "task-text";
  text.textContent = task.text;
  meta.className = "task-meta";
  meta.textContent = task.sector;

  actions.className = "task-actions";
  editButton.type = "button";
  editButton.dataset.action = "edit";
  editButton.textContent = "Редактировать";
  deleteButton.type = "button";
  deleteButton.dataset.action = "delete";
  deleteButton.textContent = "Удалить";
  actions.append(editButton, deleteButton);
  header.append(statusLabel, actions);

  card.append(header, text, meta);
  item.append(card);

  return item;
}

function createEmptyDayMessage() {
  const item = document.createElement("li");

  item.className = "empty-day";
  item.textContent = "Задач нет";

  return item;
}

function renderWeekGrid() {
  if (!elements.weekGrid) {
    return;
  }

  const weekDates = getWeekDates(state.weekStartDate);
  const todayValue = formatDateValue(new Date());

  elements.weekGrid.replaceChildren();

  weekDates.forEach((date, index) => {
    const dateValue = formatDateValue(date);
    const dayColumn = document.createElement("article");
    const title = document.createElement("h3");
    const dateBadge = document.createElement("span");
    const list = document.createElement("ul");
    const tasks = getSortedTasksForDate(dateValue);

    dayColumn.className = "day-column";
    dayColumn.dataset.date = dateValue;

    if (dateValue === todayValue) {
      dayColumn.classList.add("is-today");
    }

    title.textContent = DAY_LABELS[index];
    dateBadge.className = "day-date";
    dateBadge.textContent = optionDateFormatter.format(date);
    title.append(dateBadge);

    if (tasks.length === 0) {
      list.append(createEmptyDayMessage());
    } else {
      tasks.forEach((task) => {
        list.append(createTaskCard(task));
      });
    }

    dayColumn.append(title, list);
    elements.weekGrid.append(dayColumn);
  });
}

function updateDateSelect(selectElement) {
  if (!selectElement || !state.weekStartDate) {
    return;
  }

  const previousValue = selectElement.value;
  const weekDates = getWeekDates(state.weekStartDate);
  const weekValues = weekDates.map(formatDateValue);

  selectElement.replaceChildren();

  weekDates.forEach((date) => {
    const option = document.createElement("option");

    option.value = formatDateValue(date);
    option.textContent = formatDateOptionLabel(date);

    selectElement.append(option);
  });

  selectElement.value = weekValues.includes(previousValue) ? previousValue : weekValues[0];
}

function updateDateSelects() {
  updateDateSelect(elements.taskDate);
  updateDateSelect(elements.editTaskDate);
}

function resetTaskForm() {
  if (elements.taskText) {
    elements.taskText.value = "";
  }

  if (elements.taskSector) {
    elements.taskSector.value = "";
  }

  updateDateSelect(elements.taskDate);

  if (elements.taskDate) {
    elements.taskDate.selectedIndex = 0;
  }
}

function openTaskModal(task) {
  state.editingTaskId = task.id;
  updateDateSelect(elements.editTaskDate);

  if (elements.editTaskText) {
    elements.editTaskText.value = task.text;
  }

  if (elements.editTaskDate) {
    elements.editTaskDate.value = task.date;
  }

  if (elements.editTaskSector) {
    elements.editTaskSector.value = task.sector;
  }

  if (elements.editTaskDone) {
    elements.editTaskDone.checked = task.status === "done";
  }

  elements.taskModal?.removeAttribute("hidden");
  elements.editTaskText?.focus();
}

function closeTaskModal() {
  state.editingTaskId = null;
  elements.taskModal?.setAttribute("hidden", "");
}

function isValidTaskInput(text, dateValue, sector) {
  const parsedDate = parseDateValue(dateValue);

  return (
    text.trim().length > 0 &&
    text.trim().length <= TEXT_LIMIT &&
    parsedDate &&
    formatDateValue(parsedDate) === dateValue &&
    isDateInCurrentWeek(dateValue) &&
    SECTORS.includes(sector)
  );
}

function handleTaskFormSubmit(event) {
  event.preventDefault();

  const text = elements.taskText?.value.trim() || "";
  const dateValue = elements.taskDate?.value || "";
  const sector = elements.taskSector?.value || "";

  if (!isValidTaskInput(text, dateValue, sector)) {
    setFormError(FORM_VALIDATION_ERROR);
    return;
  }

  const now = new Date().toISOString();
  const task = {
    id: generateTaskId(),
    text,
    sector,
    date: dateValue,
    weekId: state.currentWeekId,
    status: "planned",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    order: getNextTaskOrder(state.currentWeekId, dateValue),
  };

  getWeekData(state.currentWeekId).tasks.push(task);
  saveData();
  setFormError("");
  resetTaskForm();
  renderApp();
}

function toggleTaskStatus(taskId) {
  const task = findTaskById(taskId);

  if (!task) {
    return;
  }

  const nextStatus = task.status === "done" ? "planned" : "done";

  task.status = nextStatus;
  task.completedAt = nextStatus === "done" ? new Date().toISOString() : null;
  task.updatedAt = new Date().toISOString();

  saveData();
  renderApp();
}

function deleteTask(taskId) {
  if (!confirm("Удалить задачу?")) {
    return;
  }

  if (removeTaskById(taskId)) {
    saveData();
    renderApp();
  }
}

function editTask(taskId) {
  const task = findTaskById(taskId);

  if (!task) {
    return;
  }

  openTaskModal(task);
}

function handleWeekGridClick(event) {
  const actionElement = event.target.closest("[data-action]");
  const card = event.target.closest(".task-card");

  if (!actionElement || !card) {
    return;
  }

  const taskId = card.dataset.taskId;
  const action = actionElement.dataset.action;

  if (action === "toggle-status") {
    toggleTaskStatus(taskId);
  }

  if (action === "edit") {
    editTask(taskId);
  }

  if (action === "delete") {
    deleteTask(taskId);
  }
}

function handleSaveTask() {
  const task = findTaskById(state.editingTaskId);

  if (!task) {
    closeTaskModal();
    return;
  }

  const text = elements.editTaskText?.value.trim() || "";
  const dateValue = elements.editTaskDate?.value || "";
  const sector = elements.editTaskSector?.value || "";

  if (!isValidTaskInput(text, dateValue, sector)) {
    setFormError(FORM_VALIDATION_ERROR);
    return;
  }

  const isDone = Boolean(elements.editTaskDone?.checked);
  const statusChanged = task.status !== (isDone ? "done" : "planned");
  const dateChanged = task.date !== dateValue;

  task.text = text;
  task.date = dateValue;
  task.sector = sector;
  task.status = isDone ? "done" : "planned";
  task.completedAt = isDone ? task.completedAt || new Date().toISOString() : null;
  task.updatedAt = new Date().toISOString();

  if (statusChanged && isDone) {
    task.completedAt = new Date().toISOString();
  }

  if (dateChanged) {
    task.order = getNextTaskOrder(state.currentWeekId, dateValue);
  }

  saveData();
  setFormError("");
  closeTaskModal();
  renderApp();
}

function handleCancelEdit() {
  closeTaskModal();
}

function handleEscapeKey(event) {
  if (event.key === "Escape" && elements.taskModal && !elements.taskModal.hidden) {
    closeTaskModal();
  }
}

function isTaskModalOpen() {
  return Boolean(elements.taskModal && !elements.taskModal.hidden);
}

function getDropZone(target) {
  return target.closest(".day-column");
}

function clearDropHighlights() {
  elements.weekGrid?.querySelectorAll(".day-column.is-drop-target").forEach((dayColumn) => {
    dayColumn.classList.remove("is-drop-target");
  });
}

function handleTaskDragStart(event) {
  const card = event.target.closest(".task-card");

  if (!card || isTaskModalOpen()) {
    event.preventDefault();
    return;
  }

  state.draggedTaskId = card.dataset.taskId;
  card.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", state.draggedTaskId);
}

function handleTaskDragEnd(event) {
  const card = event.target.closest(".task-card");

  state.draggedTaskId = null;
  card?.classList.remove("is-dragging");
  clearDropHighlights();
}

function handleTaskDragOver(event) {
  const dropZone = getDropZone(event.target);

  if (!state.draggedTaskId || !dropZone || isTaskModalOpen()) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  clearDropHighlights();
  dropZone.classList.add("is-drop-target");
}

function handleTaskDragLeave(event) {
  const dropZone = getDropZone(event.target);

  if (!dropZone || dropZone.contains(event.relatedTarget)) {
    return;
  }

  dropZone.classList.remove("is-drop-target");
}

function handleTaskDrop(event) {
  const dropZone = getDropZone(event.target);

  if (!state.draggedTaskId || !dropZone || isTaskModalOpen()) {
    clearDropHighlights();
    return;
  }

  event.preventDefault();

  const targetDate = dropZone.dataset.date;
  const task = findTaskById(state.draggedTaskId);

  if (task && isDateInCurrentWeek(targetDate)) {
    task.date = targetDate;
    task.updatedAt = new Date().toISOString();
    task.order = getNextTaskOrder(state.currentWeekId, targetDate);

    saveData();
    renderApp();
  }

  state.draggedTaskId = null;
  clearDropHighlights();
}

function normalizeSectorCount(count) {
  return Math.min(count, 5) * 2;
}

function getSectorTaskCounts(tasks) {
  return SECTORS.map((sector) => tasks.filter((task) => task.sector === sector).length);
}

function destroyChart() {
  if (state.chartInstance) {
    state.chartInstance.destroy();
    state.chartInstance = null;
  }
}

function renderChart() {
  if (!elements.balanceChart || !elements.chartFallback) {
    return;
  }

  const tasks = getCurrentWeekTasks();
  const sectorCounts = getSectorTaskCounts(tasks);
  const normalizedValues = sectorCounts.map(normalizeSectorCount);

  if (tasks.length === 0) {
    elements.chartFallback.hidden = false;
    elements.chartFallback.textContent =
      "На этой неделе пока нет задач. Добавьте первую задачу, чтобы увидеть баланс";
  } else {
    elements.chartFallback.hidden = true;
    elements.chartFallback.textContent = "";
  }

  destroyChart();

  if (typeof Chart === "undefined") {
    elements.chartFallback.hidden = false;
    elements.chartFallback.textContent =
      "Не удалось загрузить Chart.js. Проверьте подключение к интернету, чтобы увидеть график.";
    return;
  }

  state.chartInstance = new Chart(elements.balanceChart, {
    type: "radar",
    data: {
      labels: SECTORS,
      datasets: [
        {
          label: "Баланс недели",
          data: normalizedValues,
          backgroundColor: "rgba(158, 199, 177, 0.28)",
          borderColor: "#5f8d72",
          borderWidth: 2,
          pointBackgroundColor: CHART_COLORS,
          pointBorderColor: "#5f8d72",
          pointHoverBackgroundColor: "#ffffff",
          pointHoverBorderColor: "#5f8d72",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true,
          min: 0,
          max: 10,
          ticks: {
            stepSize: 2,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
      },
    },
  });
}

function createStatItem(label, value) {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = String(value);
  wrapper.append(term, description);

  return wrapper;
}

function renderStats() {
  if (!elements.weekStats) {
    return;
  }

  const tasks = getCurrentWeekTasks();
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const overdueCount = tasks.filter((task) => task.status === "planned" && isBeforeToday(task.date)).length;
  const plannedCount = tasks.length - doneCount;

  elements.weekStats.replaceChildren(
    createStatItem("Всего задач", tasks.length),
    createStatItem("Выполнено", doneCount),
    createStatItem("Осталось", plannedCount),
    createStatItem("Просрочено", overdueCount),
  );
}

function renderWeekRange() {
  if (elements.weekRange && state.weekStartDate) {
    elements.weekRange.textContent = formatWeekRange(state.weekStartDate);
  }

  if (elements.todayDate) {
    elements.todayDate.textContent = `Сегодня: ${formatDisplayDate(new Date(), todayDateFormatter)}`;
  }
}

function renderApp() {
  renderWeekRange();
  updateDateSelects();
  renderWeekGrid();
  renderChart();
  renderStats();
}

function shiftWeek(amount) {
  const baseDate = state.weekStartDate || getMonday(new Date());
  setCurrentWeek(addDays(baseDate, amount * 7));
  renderApp();
}

function bindWeekNavigation() {
  elements.prevWeekBtn?.addEventListener("click", () => {
    shiftWeek(-1);
  });

  elements.nextWeekBtn?.addEventListener("click", () => {
    shiftWeek(1);
  });

  elements.todayBtn?.addEventListener("click", () => {
    setCurrentWeek(new Date());
    renderApp();
  });
}

function bindTaskForm() {
  elements.taskForm?.addEventListener("submit", handleTaskFormSubmit);
}

function bindTaskActions() {
  elements.weekGrid?.addEventListener("click", handleWeekGridClick);
  elements.weekGrid?.addEventListener("dragstart", handleTaskDragStart);
  elements.weekGrid?.addEventListener("dragend", handleTaskDragEnd);
  elements.weekGrid?.addEventListener("dragover", handleTaskDragOver);
  elements.weekGrid?.addEventListener("dragleave", handleTaskDragLeave);
  elements.weekGrid?.addEventListener("drop", handleTaskDrop);
  elements.saveTaskBtn?.addEventListener("click", handleSaveTask);
  elements.cancelEditBtn?.addEventListener("click", handleCancelEdit);
  document.addEventListener("keydown", handleEscapeKey);
}

function initApp() {
  state.data = loadData();
  setCurrentWeek(new Date());
  bindWeekNavigation();
  bindTaskForm();
  bindTaskActions();
  renderApp();
}

initApp();
