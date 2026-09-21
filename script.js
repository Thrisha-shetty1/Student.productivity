 
// ============================================= 
// STUDYBLOOM - STUDENT PLANNER 
// Complete JavaScript functionality 
// ============================================= 
 
"use strict"; 
 
const $ = id => document.getElementById(id); 
const all = selector => [...document.querySelectorAll(selector)]; 
 
const today = () => { 
    const d = new Date(); 
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; 
}; 
 
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7); 
 
const safe = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ 
    "&": "&amp;", 
    "<": "&lt;", 
    ">": "&gt;", 
    '"': "&quot;", 
    "'": "&#39;" 
}[ch])); 
 
const read = (key, fallback) => { 
    try { 
        const value = JSON.parse(localStorage.getItem(key)); 
        return value ?? fallback; 
    } catch { 
        return fallback; 
    } 
}; 
 
const save = () => { 
    localStorage.setItem("studyBloomData", JSON.stringify(data)); 
}; 
 
const defaults = { 
    tasks: [], 
    subjects: [ 
        { id: uid(), name: "Java", color: "#e5a1bc" }, 
        { id: uid(), name: "C Programming", color: "#8db6e7" }, 
        { id: uid(), name: "Mathematics", color: "#a89ae9" }, 
        { id: uid(), name: "DBMS", color: "#8dcbb2" }, 
        { id: uid(), name: "DevOps", color: "#efbd75" } 
    ], 
    attendance: {}, 
    notes: [], 
    goals: [], 
    plans: [], 
    history: [], 
    checklist: {}, 
    mood: {}, 
    dailyGoal: 120, 
    userName: "Student", 
    studyLength: 25, 
    breakLength: 5, 
    xp: 0, 
    completedDates: [], 
    timerSessions: {}, 
    streak: 0 
}; 
 
let data = read("studyBloomData", null) || structuredClone(defaults); 
let editingTaskId = null; 
let calendarDate = new Date(); 
let selectedCalendarDate = today(); 
 
let timerInterval = null; 
let timerRemaining = 25 * 60; 
let timerMode = "Study"; 
let timerRunning = false; 
 
let hubInterval = null; 
let hubRemaining = 25 * 60; 
let hubRunning = false; 
 
let statusChart = null; 
let subjectChart = null; 
 
// ============================================= 
// GENERAL HELPERS 
// ============================================= 
 
function showMessage(message) { 
    alert(message); 
} 
 
function formatDate(dateString) { 
    if (!dateString) return "No deadline"; 
 
    const date = new Date(dateString); 
    if (Number.isNaN(date.getTime())) return dateString; 
 
    return date.toLocaleString([], { 
        dateStyle: "medium", 
        timeStyle: "short" 
    }); 
} 
 
function formatMinutes(minutes) { 
    const h = Math.floor(minutes / 60); 
    const m = minutes % 60; 
    return h ? `${h}h ${m}m` : `${m}m`; 
} 
 
function setProgress(id, percent) { 
    const el = $(id); 
    if (el) el.style.width = `${Math.max(0, Math.min(100, percent))}%`; 
} 
 
function setText(id, value) { 
    if ($(id)) $(id).textContent = value; 
} 
 
function subjectName(id) { 
    return data.subjects.find(s => s.id === id)?.name || "General"; 
} 
 
function taskDate(task) { 
    return task.due ? task.due.slice(0, 10) : ""; 
} 
 
function isCompleted(task) { 
    return task.status === "Completed"; 
} 
 
function isToday(task) { 
    return taskDate(task) === today(); 
} 
 
function completedTasks() { 
    return data.tasks.filter(isCompleted); 
} 
 
function todayMinutes() { 
    return data.history 
        .filter(h => h.date === today() && h.type === "Study") 
        .reduce((sum, h) => sum + Number(h.minutes || 0), 0); 
} 
 
function todaySessions() { 
    return data.history.filter(h => h.date === today() && h.type === "Study").length; 
} 
 
function updateXP() { 
    data.xp = completedTasks().length * 10 + 
        data.history.reduce((sum, h) => sum + (h.type === "Study" ? 5 : 0), 0); 
} 
 
// ============================================= 
// NAVIGATION 
// ============================================= 
 
function showPage(pageId) { 
    all(".page").forEach(page => { 
        page.classList.toggle("active", page.id === pageId); 
    }); 
 
    all(".nav").forEach(button => { 
        button.classList.toggle("active", button.dataset.page === pageId); 
    }); 
 
    if (pageId === "calendar") renderCalendar(); 
    if (pageId === "analytics") renderAnalytics(); 
    if (pageId === "attendance") renderAttendance(); 
    if (pageId === "subjects") renderSubjects(); 
    if (pageId === "goals") renderGoals(); 
    if (pageId === "notes") renderNotes(); 
} 
 
$("navigation")?.addEventListener("click", event => { 
    const button = event.target.closest("[data-page]"); 
    if (button) showPage(button.dataset.page); 
}); 
 
all("[data-go]").forEach(button => { 
    button.addEventListener("click", () => showPage(button.dataset.go)); 
}); 
 
// ============================================= 
// TASK MANAGER 
// ============================================= 
 
function refreshSubjectOptions() { 
    const options = data.subjects.map(subject => 
        `<option value="${safe(subject.id)}">${safe(subject.name)}</option>` 
    ).join(""); 
 
    ["taskSubject", "noteSubject", "attendanceSubject"].forEach(id => { 
        const select = $(id); 
        if (!select) return; 
 
        const previous = select.value; 
        const first = id === "taskSubject" 
            ? '<option value="">Choose subject</option>' 
            : ""; 
 
        select.innerHTML = first + options; 
 
        if ([...select.options].some(o => o.value === previous)) { 
            select.value = previous; 
        } 
    }); 
} 
 
function resetTaskForm() {
    $("taskForm")?.reset();
    editingTaskId = null;

    setText("taskFormTitle", "Create a task");

    if ($("cancelEdit")) {
        $("cancelEdit").hidden = true;
    }
}
 
function addTaskFromForm(event) { 
    event.preventDefault(); 
 
    const name = $("taskName").value.trim(); 
    if (!name) return; 
 
    const task = { 
        id: editingTaskId || uid(), 
        name, 
        subject: $("taskSubject").value, 
        priority: $("taskPriority").value, 
        status: $("taskStatus").value, 
        due: $("taskDue").value, 
        repeat: $("taskRepeat").value, 
        notes: $("taskNotes").value.trim(), 
        subtasks: $("taskSubtasks").value 
            .split(",") 
            .map(s => s.trim()) 
            .filter(Boolean), 
        created: editingTaskId 
            ? data.tasks.find(t => t.id === editingTaskId)?.created || today() 
            : today() 
    }; 
 
    if (editingTaskId) { 
        data.tasks = data.tasks.map(t => t.id === editingTaskId ? task : t); 
    } else { 
        data.tasks.push(task); 
    } 
 
    save(); 
    resetTaskForm(); 
    renderAll(); 
} 
 
$("taskForm")?.addEventListener("submit", addTaskFromForm); 
 
$("cancelEdit")?.addEventListener("click", resetTaskForm); 
 
function editTask(id) { 
    const task = data.tasks.find(t => t.id === id); 
    if (!task) return; 
 
    editingTaskId = id; 
 
    $("taskName").value = task.name; 
    $("taskSubject").value = task.subject || ""; 
    $("taskPriority").value = task.priority; 
    $("taskStatus").value = task.status; 
    $("taskDue").value = task.due || ""; 
    $("taskRepeat").value = task.repeat || "None"; 
    $("taskNotes").value = task.notes || ""; 
    $("taskSubtasks").value = (task.subtasks || []).join(", "); 
    setText("taskFromTitle", "Edit task");
    if ($("cancelEdit")) $("cancelEdit").hidden = false; 
 
    showPage("tasks"); 
    $("taskName").focus(); 
} 
 
function deleteTask(id) { 
    if (!confirm("Delete this task?")) return; 
 
    data.tasks = data.tasks.filter(t => t.id !== id); 
    save(); 
    renderAll(); 
} 
 
function toggleTask(id) { 
    const task = data.tasks.find(t => t.id === id); 
    if (!task) return; 
 
    if (task.status === "Completed") { 
        task.status = "To Do"; 
    } else { 
        task.status = "Completed"; 
        task.completedAt = today(); 
    } 
 
    updateXP(); 
    save(); 
    renderAll(); 
} 
 
function taskHTML(task) { 
    const subtasks = task.subtasks?.length 
        ? `<p>Subtasks: ${task.subtasks.map(safe).join(", ")}</p>` 
        : ""; 
 
    return ` 
    <div class="task-item ${isCompleted(task) ? "completed" : ""}"> 
      <input type="checkbox" 
        ${isCompleted(task) ? "checked" : ""} 
        aria-label="Complete task" 
        onchange="toggleTask('${task.id}')"> 
 
      <div style="flex:1;min-width:0"> 
        <h4>${safe(task.name)}</h4> 
        <p>📚 ${safe(subjectName(task.subject))}</p> 
        <p>📅 ${safe(formatDate(task.due))}</p> 
        <p>${safe(task.status)}</p> 
        <span class="priority ${safe(task.priority)}"> 
          ${safe(task.priority)} priority 
        </span> 
        ${subtasks} 
      </div> 
 
      <div class="task-actions"> 
        <button onclick="editTask('${task.id}')">✏️</button> 
        <button onclick="deleteTask('${task.id}')">🗑️</button> 
      </div> 
    </div>`; 
} 
 
function renderTasks() { 
    const list = $("taskList"); 
    if (!list) return; 
 
    const search = ($("taskSearch")?.value || "").toLowerCase(); 
    const status = $("filterStatus")?.value || "All"; 
    const priority = $("filterPriority")?.value || "All"; 
    const sort = $("sortTasks")?.value || "due"; 
 
    let tasks = data.tasks.filter(task => { 
        const matchesSearch = 
            task.name.toLowerCase().includes(search) || 
            subjectName(task.subject).toLowerCase().includes(search); 
 
        return matchesSearch && 
            (status === "All" || task.status === status) && 
            (priority === "All" || task.priority === priority); 
    }); 
 
    if (sort === "name") { 
        tasks.sort((a, b) => a.name.localeCompare(b.name)); 
    } else if (sort === "priority") { 
        const rank = { High: 0, Medium: 1, Low: 2 }; 
        tasks.sort((a, b) => rank[a.priority] - rank[b.priority]); 
    } else { 
        tasks.sort((a, b) => 
            (a.due || "9999").localeCompare(b.due || "9999") 
        ); 
    } 
 
    list.innerHTML = tasks.length 
        ? tasks.map(taskHTML).join("") 
        : '<div class="empty-state">🌷 No tasks found. Add a new task!</div>'; 
} 
 
["taskSearch", "filterStatus", "filterPriority", "sortTasks"] 
    .forEach(id => $(id)?.addEventListener("input", renderTasks)); 
 
$("quickAdd")?.addEventListener("click", () => { 
    showPage("tasks"); 
    $("taskName")?.focus(); 
}); 
 
$("addTaskBtn")?.addEventListener("click", () => { 
    resetTaskForm(); 
    $("taskName")?.focus(); 
}); 
 
$("floatingAdd")?.addEventListener("click", () => { 
    showPage("tasks"); 
    $("taskName")?.focus(); 
}); 
 
// ============================================= 
// QUICK ADD TASK 
// ============================================= 
 
$("quickTaskForm")?.addEventListener("submit", event => { 
    event.preventDefault(); 
 
    const name = $("quickTaskName").value.trim(); 
    if (!name) return; 
 
    data.tasks.push({ 
        id: uid(), 
        name, 
        subject: "", 
        priority: $("quickTaskPriority").value, 
        status: "To Do", 
        due: "", 
        repeat: "None", 
        notes: "", 
        subtasks: [], 
        created: today() 
    }); 
 
    $("quickTaskForm").reset(); 
    setText("quickTaskMessage", "✨ Task added successfully!"); 
 
    save(); 
    renderAll(); 
}); 
 
// ============================================= 
// DASHBOARD 
// ============================================= 
 
function renderDashboard() { 
    const total = data.tasks.length; 
    const done = completedTasks().length; 
    const pending = total - done; 
    const productivity = total ? Math.round(done / total * 100) : 0; 
 
    setText("totalTasks", total); 
    setText("completedTasks", done); 
    setText("pendingTasks", pending); 
    setText("productivity", productivity + "%"); 
 
    const todaysTasks = data.tasks.filter(isToday); 
 
    if ($("todayTasks")) { 
        $("todayTasks").innerHTML = todaysTasks.length 
            ? todaysTasks.map(taskHTML).join("") 
            : '<div class="empty-state">☀️ No tasks due today.</div>'; 
    } 
 
    const todayDone = todaysTasks.filter(isCompleted).length; 
    const dailyPercent = todaysTasks.length 
        ? Math.round(todayDone / todaysTasks.length * 100) 
        : 0; 
 
    setText("dailyPercent", dailyPercent + "%"); 
    setProgress("dailyBar", dailyPercent); 
 
    if ($("dailyCircle")) { 
        $("dailyCircle").style.background = 
            `conic-gradient(#9878dc ${dailyPercent * 3.6}deg, #eee9f7 0deg)`; 
    } 
 
    setText("dailySummary", `${todayDone} of ${todaysTasks.length} tasks completed`); 
 
    const upcoming = data.tasks 
        .filter(t => t.due && !isCompleted(t) && t.due >= new Date().toISOString().slice(0, 16)) 
        .sort((a, b) => a.due.localeCompare(b.due)) 
        .slice(0, 5); 
 
    if ($("upcomingTasks")) { 
        $("upcomingTasks").innerHTML = upcoming.length 
            ? upcoming.map(t => ` 
                <div class="event-item"> 
                  <strong>${safe(t.name)}</strong> 
                  <p class="muted">${safe(formatDate(t.due))}</p> 
                </div> 
            `).join("") 
            : '<div class="empty-state">No upcoming deadlines 🌸</div>'; 
    } 
 
    const minutes = todayMinutes(); 
    setText("weeklyTasksDone", data.tasks.filter(t => { 
        const d = new Date(t.completedAt || ""); 
        const now = new Date(); 
        return isCompleted(t) && 
            d instanceof Date && 
            !Number.isNaN(d.getTime()) && 
            (now - d) <= 7 * 86400000; 
    }).length); 
 
    setText("weeklyStudyTime", formatMinutes( 
        data.history.filter(h => h.type === "Study" && isThisWeek(h.date)) 
            .reduce((sum, h) => sum + h.minutes, 0) 
    )); 
 
    const attendanceValues = Object.values(data.attendance); 
    const attended = attendanceValues.reduce((sum, a) => sum + a.attended, 0); 
    const classes = attendanceValues.reduce((sum, a) => sum + a.total, 0); 
 
    setText("weeklyAttendance", classes 
        ? Math.round(attended / classes * 100) + "%" 
        : "0%"); 
 
    const weekMinutes = data.history 
        .filter(h => h.type === "Study" && isThisWeek(h.date)) 
        .reduce((sum, h) => sum + h.minutes, 0); 
 
    setText("weeklyHours", formatMinutes(weekMinutes)); 
    setProgress("weeklyProgressBar", Math.min(100, weekMinutes / 600 * 100)); 
    setText("weeklyProgressText", `${weekMinutes} of 600 weekly study minutes`); 
 
    setText("streak", calculateStreak()); 
    setText("xp", data.xp); 
 
    renderSubjectProgress(); 
} 
 
function isThisWeek(dateString) { 
    if (!dateString) return false; 
 
    const date = new Date(dateString + "T12:00:00"); 
    const now = new Date(); 
 
    const start = new Date(now); 
    start.setHours(0, 0, 0, 0); 
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); 
 
    const end = new Date(start); 
    end.setDate(start.getDate() + 7); 
 
    return date >= start && date < end; 
} 
 
function calculateStreak() { 
    const dates = new Set([ 
        ...data.completedDates, 
        ...data.history.filter(h => h.type === "Study").map(h => h.date) 
    ]); 
 
    let count = 0; 
    const date = new Date(); 
 
    if (!dates.has(today())) date.setDate(date.getDate() - 1); 
 
    while (dates.has( 
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` 
    )) { 
        count++; 
        date.setDate(date.getDate() - 1); 
    } 
 
    return count; 
} 
 
function renderSubjectProgress() { 
    const fixed = [ 
        ["Java", "javaProgressText", "javaProgressBar"], 
        ["C Programming", "cProgressText", "cProgressBar"], 
        ["Mathematics", "mathProgressText", "mathProgressBar"], 
        ["DBMS", "dbmsProgressText", "dbmsProgressBar"], 
        ["DevOps", "devopsProgressText", "devopsProgressBar"] 
    ]; 
 
    fixed.forEach(([name, textId, barId]) => { 
        const tasks = data.tasks.filter(t => 
            subjectName(t.subject).toLowerCase() === name.toLowerCase() 
        ); 
 
        const done = tasks.filter(isCompleted).length; 
        const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0; 
 
        setText(textId, percent + "%"); 
        setProgress(barId, percent); 
    }); 
} 
 
// ============================================= 
// SUBJECTS 
// ============================================= 
 
$("subjectForm")?.addEventListener("submit", event => { 
    event.preventDefault(); 
 
    const name = $("subjectName").value.trim(); 
    if (!name) return; 
 
    if (data.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) { 
        showMessage("This subject already exists."); 
        return; 
    } 
 
    data.subjects.push({ 
        id: uid(), 
        name, 
        color: $("subjectColor").value 
    }); 
 
    $("subjectForm").reset(); 
    save(); 
    renderAll(); 
}); 
 
function deleteSubject(id) { 
    if (!confirm("Delete this subject?")) return; 
 
    data.subjects = data.subjects.filter(s => s.id !== id); 
    save(); 
    renderAll(); 
} 
 
function renderSubjects() { 
    const list = $("subjectList"); 
    if (!list) return; 
 
    list.innerHTML = data.subjects.length 
        ? data.subjects.map(subject => { 
            const tasks = data.tasks.filter(t => t.subject === subject.id); 
            const done = tasks.filter(isCompleted).length; 
            const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0; 
 
            return ` 
            <div class="subject-card" style="border-top-color:${safe(subject.color)}"> 
              <h3>${safe(subject.name)}</h3> 
              <p>${tasks.length} tasks · ${done} completed</p> 
              <div class="progress-track"> 
                <div class="progress-fill" style="width:${percent}%;background:${safe(subject.color)}"></div> 
              </div> 
              <p>${percent}% complete</p> 
              <button class="mini-btn" onclick="deleteSubject('${subject.id}')">Delete</button> 
            </div>`; 
        }).join("") 
        : '<div class="empty-state">Add your first subject 📚</div>'; 
 
    refreshSubjectOptions(); 
} 
 
// ============================================= 
// CALENDAR 
// ============================================= 
 
function renderCalendar() { 
    const grid = $("calendarGrid"); 
    if (!grid) return; 
 
    const year = calendarDate.getFullYear(); 
    const month = calendarDate.getMonth(); 
 
    setText("monthLabel", calendarDate.toLocaleDateString([], { 
        month: "long", 
        year: "numeric" 
    })); 
 
    const headings = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; 
 
    let html = headings.map(day => 
        `<div style="text-align:center;padding:8px;font-weight:600">${day}</div>` 
    ).join(""); 
 
    const firstDay = new Date(year, month, 1); 
    const offset = (firstDay.getDay() + 6) % 7; 
    const daysInMonth = new Date(year, month + 1, 0).getDate(); 
 
    for (let i = 0; i < offset; i++) { 
        html += '<div></div>'; 
    } 
 
    for (let day = 1; day <= daysInMonth; day++) { 
        const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; 
        const tasks = data.tasks.filter(t => taskDate(t) === dateString); 
 
        html += ` 
        <button class="calendar-day 
          ${dateString === today() ? "today" : ""} 
          ${dateString === selectedCalendarDate ? "selected" : ""}" 
          data-date="${dateString}"> 
          <span class="day-number">${day}</span> 
          ${tasks.length ? `<div class="day-dots">● ${tasks.length}</div>` : ""} 
        </button>`; 
    } 
 
    grid.innerHTML = html; 
    renderCalendarEvents(); 
} 
 
$("calendarGrid")?.addEventListener("click", event => { 
    const button = event.target.closest("[data-date]"); 
    if (!button) return; 
 
    selectedCalendarDate = button.dataset.date; 
    renderCalendar(); 
}); 
 
$("prevMonth")?.addEventListener("click", () => { 
    calendarDate.setMonth(calendarDate.getMonth() - 1); 
    renderCalendar(); 
}); 
 
$("nextMonth")?.addEventListener("click", () => { 
    calendarDate.setMonth(calendarDate.getMonth() + 1); 
    renderCalendar(); 
}); 
 
function renderCalendarEvents() { 
    setText("selectedDateTitle", `Tasks on ${selectedCalendarDate}`); 
 
    const tasks = data.tasks.filter(t => taskDate(t) === selectedCalendarDate); 
 
    if ($("calendarEvents")) { 
        $("calendarEvents").innerHTML = tasks.length 
            ? tasks.map(taskHTML).join("") 
            : '<div class="empty-state">No tasks for this date 🌷</div>'; 
    } 
} 
 
// ============================================= 
// ATTENDANCE 
// ============================================= 
 
$("attendanceForm")?.addEventListener("submit", event => { 
    event.preventDefault(); 
 
    const subject = $("attendanceSubject").value; 
    const attended = Number($("attended").value); 
    const total = Number($("totalClasses").value); 
 
    if (!subject || total <= 0 || attended < 0 || attended > total) { 
        showMessage("Please enter valid attendance values."); 
        return; 
    } 
 
    data.attendance[subject] = { attended, total }; 
 
    save(); 
    renderAttendance(); 
    renderDashboard(); 
}); 
 
function renderAttendance() { 
    const list = $("attendanceList"); 
    if (!list) return; 
 
    const entries = Object.entries(data.attendance); 
 
    list.innerHTML = entries.length 
        ? entries.map(([id, a]) => { 
            const percent = Math.round(a.attended / a.total * 100); 
 
            return ` 
            <div class="subject-card"> 
              <h3>${safe(subjectName(id))}</h3> 
              <p>${a.attended} attended out of ${a.total} classes</p> 
              <h2>${percent}%</h2> 
              <div class="progress-track"> 
                <div class="progress-fill" style="width:${percent}%"></div> 
              </div> 
            </div>`; 
        }).join("") 
        : '<div class="empty-state">Add your class attendance 📈</div>'; 
} 
 
// ============================================= 
// NOTES 
// ============================================= 
 
$("noteForm")?.addEventListener("submit", event => { 
    event.preventDefault(); 
 
    const title = $("noteTitle").value.trim(); 
    const content = $("noteContent").value.trim(); 
 
    if (!title || !content) return; 
 
    data.notes.push({ 
        id: uid(), 
        title, 
        content, 
        subject: $("noteSubject").value, 
        pinned: $("notePinned").checked, 
        date: today() 
    }); 
 
    $("noteForm").reset(); 
    save(); 
    renderNotes(); 
}); 
 
function deleteNote(id) { 
    if (!confirm("Delete this note?")) return; 
 
    data.notes = data.notes.filter(n => n.id !== id); 
    save(); 
    renderNotes(); 
} 
 
function renderNotes() { 
    const list = $("notesList"); 
    if (!list) return; 
 
    const search = ($("noteSearch")?.value || "").toLowerCase(); 
 
    const notes = data.notes 
        .filter(n => 
            n.title.toLowerCase().includes(search) || 
            n.content.toLowerCase().includes(search) 
        ) 
        .sort((a, b) => Number(b.pinned) - Number(a.pinned)); 
 
    list.innerHTML = notes.length 
        ? notes.map(note => ` 
          <div class="note-card"> 
            <h3>${note.pinned ? "📌 " : ""}${safe(note.title)}</h3> 
            <p class="muted">${safe(subjectName(note.subject))} · ${safe(note.date)}</p> 
            <p>${safe(note.content)}</p> 
            <div class="note-actions"> 
              <button class="mini-btn" onclick="togglePin('${note.id}')"> 
                ${note.pinned ? "Unpin" : "Pin"} 
              </button> 
              <button class="mini-btn" onclick="deleteNote('${note.id}')">Delete</button> 
            </div> 
          </div> 
        `).join("") 
        : '<div class="empty-state">No notes found 📝</div>'; 
} 
 
function togglePin(id) { 
    const note = data.notes.find(n => n.id === id); 
    if (!note) return; 
 
    note.pinned = !note.pinned; 
    save(); 
    renderNotes(); 
} 
 
$("noteSearch")?.addEventListener("input", renderNotes); 
 
// ============================================= 
// GOALS 
// ============================================= 
 
$("goalForm")?.addEventListener("submit", event => { 
    event.preventDefault(); 
 
    const name = $("goalName").value.trim(); 
    const target = Number($("goalTarget").value); 
 
    if (!name || target <= 0) return; 
 
    data.goals.push({ 
        id: uid(), 
        name, 
        type: $("goalType").value, 
        target, 
        progress: 0 
    }); 
 
    $("goalForm").reset(); 
    save(); 
    renderGoals(); 
}); 
 
function updateGoal(id, amount) { 
    const goal = data.goals.find(g => g.id === id); 
    if (!goal) return; 
 
    goal.progress = Math.max(0, Math.min(goal.target, goal.progress + amount)); 
    save(); 
    renderGoals(); 
} 
 
function deleteGoal(id) { 
    data.goals = data.goals.filter(g => g.id !== id); 
    save(); 
    renderGoals(); 
} 
 
function renderGoals() { 
    const list = $("goalsList"); 
    if (!list) return; 
 
    list.innerHTML = data.goals.length 
        ? data.goals.map(goal => { 
            const percent = Math.round(goal.progress / goal.target * 100); 
 
            return ` 
            <div class="goal-card"> 
              <h3>🎯 ${safe(goal.name)}</h3> 
              <p>${safe(goal.type)} goal</p> 
              <p>${goal.progress} / ${goal.target}</p> 
              <div class="progress-track"> 
                <div class="progress-fill" style="width:${percent}%"></div> 
              </div> 
              <p>${percent}% complete</p> 
              <button class="mini-btn" onclick="updateGoal('${goal.id}',1)">+1</button> 
              <button class="mini-btn" onclick="deleteGoal('${goal.id}')">Delete</button> 
            </div>`; 
        }).join("") 
        : '<div class="empty-state">Create a goal and start growing 🌱</div>'; 
} 
 
// ============================================= 
// POMODORO TIMER 
// ============================================= 
 
function updateTimerDisplay() { 
    const minutes = Math.floor(timerRemaining / 60); 
    const seconds = timerRemaining % 60; 
 
    setText("timerDisplay", 
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` 
    ); 
 
    setText("timerMode", 
        timerMode === "Study" ? "Time to focus 🌷" : "Take a little break 🌸" 
    ); 
} 
 
function stopTimer() { 
    clearInterval(timerInterval); 
    timerInterval = null; 
    timerRunning = false; 
} 
 
function startTimer() { 
    if (timerRunning) { 
        stopTimer(); 
        return; 
    } 
 
    timerRunning = true; 
    setText("startTimer", "⏸ Pause"); 
 
    timerInterval = setInterval(() => { 
        timerRemaining--; 
        updateTimerDisplay(); 
 
        if (timerRemaining <= 0) { 
            stopTimer(); 
            setText("startTimer", "▶ Start"); 
 
            if (timerMode === "Study") { 
                data.history.push({ 
                    id: uid(), 
                    type: "Study", 
                    minutes: Number($("studyLength")?.value || data.studyLength), 
                    subject: "", 
                    date: today() 
                }); 
 
                data.completedDates.push(today()); 
                updateXP(); 
                save(); 
                renderAll(); 
            } 
 
            showMessage(`${timerMode} session completed! 🌷`); 
        } 
    }, 1000); 
} 
 
$("startTimer")?.addEventListener("click", startTimer); 
 
$("resetTimer")?.addEventListener("click", () => { 
    stopTimer(); 
    timerRemaining = timerMode === "Study" 
        ? Number($("studyLength")?.value || data.studyLength) * 60 
        : timerMode === "Short break" 
            ? Number($("breakLength")?.value || data.breakLength) * 60 
            : 15 * 60; 
 
    setText("startTimer", "▶ Start"); 
    updateTimerDisplay(); 
}); 
 
all(".mode").forEach(button => { 
    button.addEventListener("click", () => { 
        stopTimer(); 
 
        all(".mode").forEach(b => b.classList.remove("active")); 
        button.classList.add("active"); 
 
        timerMode = button.dataset.mode; 
        timerRemaining = Number(button.dataset.minutes) * 60; 
 
        setText("startTimer", "▶ Start"); 
        updateTimerDisplay(); 
    }); 
}); 
 
$("focusMode")?.addEventListener("change", event => { 
    document.body.classList.toggle("focus-mode", event.target.checked); 
}); 
 
$("focusModeBtn")?.addEventListener("click", () => { 
    document.body.classList.toggle("focus-mode"); 
}); 
 
// ============================================= 
// STUDY HUB TIMER 
// ============================================= 
 
function updateHubClock() { 
    const m = Math.floor(hubRemaining / 60); 
    const s = hubRemaining % 60; 
 
    setText("studyClock", 
        `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` 
    ); 
} 
 
$("startStudy")?.addEventListener("click", () => { 
    if (hubRunning) return; 
 
    hubRunning = true; 
 
    hubInterval = setInterval(() => { 
        hubRemaining--; 
        updateHubClock(); 
 
        if (hubRemaining <= 0) { 
            clearInterval(hubInterval); 
            hubRunning = false; 
 
            const subject = $("sessionSubject").value.trim(); 
 
            data.history.push({ 
                id: uid(), 
                type: "Study", 
                minutes: 25, 
                subject, 
                date: today() 
            }); 
 
            data.completedDates.push(today()); 
            updateXP(); 
            save(); 
            renderAll(); 
 
            setText("studyTimerMessage", "Session complete! Great work 🌷"); 
            showMessage("Your study session is complete!"); 
        } 
    }, 1000); 
}); 
 
$("pauseStudy")?.addEventListener("click", () => { 
    clearInterval(hubInterval); 
    hubRunning = false; 
}); 
 
$("resetStudy")?.addEventListener("click", () => { 
    clearInterval(hubInterval); 
    hubRunning = false; 
    hubRemaining = 25 * 60; 
    updateHubClock(); 
    setText("studyTimerMessage", "Ready for a focused session?"); 
}); 
 
// ============================================= 
// DAILY CHECKLIST 
// ============================================= 
 
function renderChecklist() { 
    const checks = all(".daily-check"); 
    const saved = data.checklist[today()] || []; 
 
    checks.forEach((check, index) => { 
        check.checked = Boolean(saved[index]); 
 
        check.onchange = () => { 
            data.checklist[today()] = checks.map(c => c.checked); 
            save(); 
            renderChecklist(); 
        }; 
    }); 
 
    const count = checks.filter(c => c.checked).length; 
 
    setText("checklistCount", `${count}/${checks.length}`); 
    setProgress("checklistProgress", 
        checks.length ? count / checks.length * 100 : 0 
    ); 
} 
 
// ============================================= 
// DAILY MOOD 
// ============================================= 
 
const moodMessages = { 
    Happy: "That's wonderful! Keep your positive energy 🌼", 
    Okay: "One step at a time. You've got this 💗", 
    Tired: "Take a little break and be kind to yourself 🌸", 
    Stressed: "Breathe slowly. Start with one small task 🌱" 
}; 
 
all(".mood-btn").forEach(button => { 
    button.addEventListener("click", () => { 
        all(".mood-btn").forEach(b => b.classList.remove("selected")); 
        button.classList.add("selected"); 
 
        const mood = button.dataset.mood; 
        data.mood[today()] = mood; 
 
        setText("moodMessage", moodMessages[mood]); 
        save(); 
    }); 
}); 
 
// ============================================= 
// DAILY STUDY GOAL 
// ============================================= 
 
$("saveDailyGoal")?.addEventListener("click", () => { 
    const value = Number($("dailyGoalInput").value); 
 
    if (value <= 0) { 
        showMessage("Enter a goal greater than zero."); 
        return; 
    } 
 
    data.dailyGoal = value; 
    save(); 
    renderDailyGoal(); 
}); 
 
function renderDailyGoal() { 
    if ($("dailyGoalInput")) { 
        $("dailyGoalInput").value = data.dailyGoal; 
    } 
 
    const minutes = todayMinutes(); 
    const goal = Number(data.dailyGoal) || 120; 
    const percent = Math.min(100, Math.round(minutes / goal * 100)); 
 
    setText("goalMinutesDone", minutes); 
    setProgress("dailyGoalBar", percent); 
 
    setText("dailyGoalMessage", 
        percent >= 100 
            ? "🌟 You reached your daily study goal!" 
            : `${percent}% completed. Keep going!` 
    ); 
} 
 
// ============================================= 
// MOTIVATIONAL QUOTES 
// ============================================= 
 
const quotes = [ 
    "Small progress is still progress. 🌱", 
    "Believe in yourself and keep learning. 🌷", 
    "Your future is created by what you do today.", 
    "One task at a time. You've got this!", 
    "Every expert was once a beginner.", 
    "Consistency makes a difference.", 
    "Keep growing at your own pace. 🌼" 
]; 
 
$("newQuote")?.addEventListener("click", () => { 
    const quote = quotes[Math.floor(Math.random() * quotes.length)]; 
    setText("dailyQuote", `"${quote}"`); 
}); 
 
// ============================================= 
// DAILY PLANNER 
// ============================================= 
 
$("studyPlanForm")?.addEventListener("submit", event => { 
    event.preventDefault(); 
 
    const subject = $("planSubject").value.trim(); 
    const time = $("planTime").value; 
 
    if (!subject || !time) return; 
 
    data.plans.push({ 
        id: uid(), 
        subject, 
        time, 
        date: today() 
    }); 
 
    $("studyPlanForm").reset(); 
    save(); 
    renderPlans(); 
}); 
 
function deletePlan(id) { 
    data.plans = data.plans.filter(p => p.id !== id); 
    save(); 
    renderPlans(); 
} 
 
function renderPlans() { 
    const list = $("studyPlanList"); 
    if (!list) return; 
 
    const plans = data.plans 
        .filter(p => p.date === today()) 
        .sort((a, b) => a.time.localeCompare(b.time)); 
 
    list.innerHTML = plans.length 
        ? plans.map(p => ` 
            <div class="plan-item"> 
              <span>🕒 ${safe(p.time)} — ${safe(p.subject)}</span> 
              <button class="mini-btn" onclick="deletePlan('${p.id}')">×</button> 
            </div> 
        `).join("") 
        : '<p class="muted small">No study plans yet.</p>'; 
} 
 
// ============================================= 
// STUDY HISTORY 
// ============================================= 
 
function renderStudyHistory() { 
    setText("todayStudyMinutes", todayMinutes()); 
    setText("todayStudySessions", todaySessions()); 
 
    const list = $("studyHistory"); 
    if (!list) return; 
 
    const history = data.history 
        .filter(h => h.date === today()) 
        .slice() 
        .reverse(); 
 
    list.innerHTML = history.length 
        ? history.map(h => ` 
            <div class="plan-item"> 
              <span>📚 ${safe(h.subject || h.type)}</span> 
              <strong>${h.minutes} min</strong> 
            </div> 
        `).join("") 
        : '<p class="muted small">Your study sessions will appear here.</p>'; 
} 
 
// ============================================= 
// ANALYTICS & CHARTS 
// ============================================= 
 
 
function renderAnalytics() { 
    const total = data.tasks.length; 
    const done = completedTasks().length; 
    const percent = total ? Math.round(done / total * 100) : 0; 
    const minutes = data.history 
        .filter(h => h.type === "Study") 
        .reduce((sum, h) => sum + h.minutes, 0); 
 
    setText("analyticsCompletion", percent + "%"); 
    setText("analyticsTime", minutes + " min"); 
    setText("analyticsXP", data.xp); 
 
    if (typeof Chart === "undefined") return; 
 
    if (statusChart) statusChart.destroy(); 
    if (subjectChart) subjectChart.destroy(); 
 
    const statusCanvas = $("statusChart"); 
    const subjectCanvas = $("subjectChart"); 
 
    if (statusCanvas) { 
        statusChart = new Chart(statusCanvas, { 
            type: "doughnut", 
            data: { 
                labels: ["To Do", "In Progress", "Completed"], 
                datasets: [{ 
                    data: [ 
                        data.tasks.filter(t => t.status === "To Do").length, 
                        data.tasks.filter(t => t.status === "In Progress").length, 
                        data.tasks.filter(isCompleted).length 
                    ], 
                    backgroundColor: ["#f3a6c8", "#a89ae9", "#8dcbb2"], 
                    borderWidth: 0 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: true 
            } 
        }); 
    } 
 
    if (subjectCanvas) { 
        const labels = data.subjects.map(s => s.name); 
        const values = data.subjects.map(s => 
            data.history 
                .filter(h => h.subject === s.name && h.type === "Study") 
                .reduce((sum, h) => sum + h.minutes, 0) 
        ); 
 
        subjectChart = new Chart(subjectCanvas, { 
            type: "bar", 
            data: { 
                labels, 
                datasets: [{ 
                    label: "Study minutes", 
                    data: values, 
                    backgroundColor: "#b9a3ed", 
                    borderRadius: 8 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: true, 
                scales: { 
                    y: { beginAtZero: true } 
                } 
            } 
        }); 
    } 
 
    const weekly = data.history.filter(h => 
        h.type === "Study" && isThisWeek(h.date) 
    ); 
 
    const weeklyMinutes = weekly.reduce((sum, h) => sum + h.minutes, 0); 
 
    setText("weeklySummary", 
        `You studied ${formatMinutes(weeklyMinutes)} this week.` 
    ); 
 
    const byDay = {}; 
 
    weekly.forEach(h => { 
        const day = new Date(h.date + "T12:00:00").toLocaleDateString([], { 
            weekday: "long" 
        }); 
 
        byDay[day] = (byDay[day] || 0) + h.minutes; 
    }); 
 
    const bestDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]; 
 
    setText("productiveDay", 
        bestDay 
            ? `${bestDay[0]} — ${bestDay[1]} minutes studied` 
            : "Start studying to discover your productive day!" 
    ); 
} 
 
// ============================================= 
// SETTINGS 
// ============================================= 
 
$("saveSettings")?.addEventListener("click", () => { 
    data.userName = $("userName").value.trim() || "Student"; 
    data.studyLength = Number($("studyLength").value) || 25; 
    data.breakLength = Number($("breakLength").value) || 5; 
 
    save(); 
    renderHeader(); 
 
    showMessage("Settings saved successfully! 🌷"); 
}); 
 
function renderHeader() { 
    const hour = new Date().getHours(); 
 
    const greeting = hour < 12 
        ? "Good morning" 
        : hour < 17 
            ? "Good afternoon" 
            : "Good evening"; 
 
    setText("greeting", `${greeting}, ${data.userName}! ✨`); 
 
    setText("todayDate", new Date().toLocaleDateString([], { 
        weekday: "long", 
        month: "long", 
        day: "numeric", 
        year: "numeric" 
    })); 
 
    if ($("userName")) $("userName").value = data.userName; 
    if ($("studyLength")) $("studyLength").value = data.studyLength; 
    if ($("breakLength")) $("breakLength").value = data.breakLength; 
} 
 
// ============================================= 
// EXPORT / IMPORT BACKUP 
// ============================================= 
 
$("exportData")?.addEventListener("click", () => { 
    const blob = new Blob( 
        [JSON.stringify(data, null, 2)], 
        { type: "application/json" } 
    ); 
 
    const url = URL.createObjectURL(blob); 
    const link = document.createElement("a"); 
 
    link.href = url; 
    link.download = "studybloom-backup.json"; 
    link.click(); 
 
    URL.revokeObjectURL(url); 
}); 
 
$("importData")?.addEventListener("change", async event => { 
    const file = event.target.files[0]; 
    if (!file) return; 
 
    try { 
        const imported = JSON.parse(await file.text()); 
 
        if (!imported || !Array.isArray(imported.tasks) || 
            !Array.isArray(imported.subjects)) { 
            throw new Error("Invalid backup"); 
        } 
 
        if (!confirm("Import this backup? Current data will be replaced.")) { 
            return; 
        } 
 
        data = { ...structuredClone(defaults), ...imported }; 
 
        save(); 
        renderAll(); 
 
        showMessage("Backup imported successfully!"); 
    } catch { 
        showMessage("Could not import this file. Please select a valid StudyBloom backup."); 
    } 
 
    event.target.value = ""; 
}); 
 
$("clearData")?.addEventListener("click", () => { 
    if (!confirm("Delete ALL StudyBloom data? This cannot be undone.")) return; 
 
    stopTimer(); 
    clearInterval(hubInterval); 
 
    data = structuredClone(defaults); 
 
    save(); 
    renderAll(); 
 
    showMessage("All StudyBloom data has been cleared."); 
}); 
 
// ============================================= 
// SGPA CALCULATOR 
// ============================================= 
 
$("addGradeRow")?.addEventListener("click", () => { 
    const row = document.createElement("div"); 
    row.className = "grade-row"; 
 
    row.innerHTML = ` 
      <input class="grade-subject" placeholder="Subject name" required> 
      <input class="grade-credit" type="number" min="1" max="30" 
        placeholder="Credits" required> 
      <input class="grade-point" type="number" min="0" max="10" 
        step="0.1" placeholder="Grade point" required> 
    `; 
 
    $("subjectRows").appendChild(row); 
}); 
 
$("sgpaForm")?.addEventListener("submit", event => { 
    event.preventDefault(); 
 
    const rows = all("#subjectRows .grade-row"); 
 
    let totalCredits = 0; 
    let totalPoints = 0; 
 
    for (const row of rows) { 
        const credit = Number(row.querySelector(".grade-credit").value); 
        const point = Number(row.querySelector(".grade-point").value); 
 
        if (credit <= 0 || point < 0 || point > 10) { 
            showMessage("Enter valid credits and grade points."); 
            return; 
        } 
 
        totalCredits += credit; 
        totalPoints += credit * point; 
    } 
 
    if (!totalCredits) return; 
 
    const sgpa = totalPoints / totalCredits; 
 
    setText("sgpaResult", 
        `🎓 Your SGPA is ${sgpa.toFixed(2)} / 10` 
    ); 
}); 
 
// ============================================= 
// CGPA CALCULATOR 
// ============================================= 
 
$("addSemesterRow")?.addEventListener("click", () => { 
    const row = document.createElement("div"); 
    row.className = "semester-row"; 
 
    row.innerHTML = ` 
      <input type="number" class="semester-gpa" 
        min="0" max="10" step="0.01" 
        placeholder="Semester GPA" required> 
      <input type="number" class="semester-credit" 
        min="1" max="100" 
        placeholder="Total credits" required> 
    `; 
 
    $("semesterRows").appendChild(row); 
}); 
 
$("cgpaForm")?.addEventListener("submit", event => { 
    event.preventDefault(); 
 
    const rows = all("#semesterRows .semester-row"); 
 
    let totalCredits = 0; 
    let totalPoints = 0; 
 
    for (const row of rows) { 
        const gpa = Number(row.querySelector(".semester-gpa").value); 
        const credit = Number(row.querySelector(".semester-credit").value); 
 
        if (gpa < 0 || gpa > 10 || credit <= 0) { 
            showMessage("Enter valid GPA and credits."); 
            return; 
        } 
 
        totalCredits += credit; 
        totalPoints += gpa * credit; 
    } 
 
    if (!totalCredits) return; 
 
    const cgpa = totalPoints / totalCredits; 
 
    setText("cgpaResult", 
        `🎓 Your CGPA is ${cgpa.toFixed(2)} / 10` 
    ); 
}); 
 
// ============================================= 
// RENDER EVERYTHING 
// ============================================= 
 
function renderAll() { 
    updateXP(); 
    refreshSubjectOptions(); 
    renderHeader(); 
    renderTasks(); 
    renderDashboard(); 
    renderSubjects(); 
    renderCalendar(); 
    renderAttendance(); 
    renderNotes(); 
    renderGoals(); 
    renderChecklist(); 
    renderDailyGoal(); 
    renderPlans(); 
    renderStudyHistory(); 
    updateTimerDisplay(); 
    updateHubClock(); 
} 
 
// ============================================= 
// START APPLICATION 
// ============================================= 
 
document.addEventListener("DOMContentLoaded", () => { 
    renderAll(); 
    showPage("dashboard"); 
}); 
/* ========================= 
   ANALYTICS 
========================= */ 
 
let studyChart; 
let taskChart; 
 
function updateAnalytics() { 
    // Read saved StudyBloom data 
    const tasks = JSON.parse( 
        localStorage.getItem("studybloom_tasks") || "[]" 
    ); 
 
    const studyHours = JSON.parse( 
        localStorage.getItem("studybloom_hours") || 
        "[1,2,1.5,3,2,4,2]" 
    ); 
 
    // Task statistics 
    const totalTasks = tasks.length; 
 
    const completedTasks = tasks.filter(task => 
        task.completed === true || 
        task.done === true 
    ).length; 
 
    const pendingTasks = totalTasks - completedTasks; 
 
    const completionRate = totalTasks > 0 
        ? Math.round((completedTasks / totalTasks) * 100) 
        : 0; 
 
    // Total study time 
    const totalHours = studyHours.reduce( 
        (sum, hours) => sum + Number(hours || 0), 
        0 
    ); 
 
    // Update analytics cards if these IDs exist 
    const totalTasksEl = document.getElementById("analyticsTotalTasks"); 
    const completedEl = document.getElementById("analyticsCompleted"); 
    const pendingEl = document.getElementById("analyticsPending"); 
    const rateEl = document.getElementById("analyticsRate"); 
    const hoursEl = document.getElementById("analyticsHours"); 
 
    if (totalTasksEl) totalTasksEl.textContent = totalTasks; 
    if (completedEl) completedEl.textContent = completedTasks; 
    if (pendingEl) pendingEl.textContent = pendingTasks; 
    if (rateEl) rateEl.textContent = completionRate + "%"; 
    if (hoursEl) hoursEl.textContent = totalHours.toFixed(1) + " hrs"; 
 
    // Weekly study hours chart 
    const studyCanvas = document.getElementById("studyHoursChart"); 
 
    if (studyCanvas && typeof Chart !== "undefined") { 
        if (studyChart) studyChart.destroy(); 
 
        studyChart = new Chart(studyCanvas, { 
            type: "bar", 
            data: { 
                labels: [ 
                    "Mon", "Tue", "Wed", "Thu", 
                    "Fri", "Sat", "Sun" 
                ], 
                datasets: [{ 
                    label: "Study Hours", 
                    data: studyHours, 
                    backgroundColor: "#b9a0ed", 
                    borderRadius: 8 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        title: { 
                            display: true, 
                            text: "Hours" 
                        } 
                    } 
                } 
            } 
        }); 
    } 
 
    // Task completion chart 
    const taskCanvas = document.getElementById("taskCompletionChart"); 
 
    if (taskCanvas && typeof Chart !== "undefined") { 
        if (taskChart) taskChart.destroy(); 
 
        taskChart = new Chart(taskCanvas, { 
            type: "doughnut", 
            data: { 
                labels: ["Completed", "Pending"], 
                datasets: [{ 
                    data: [completedTasks, pendingTasks], 
                    backgroundColor: ["#a8d5ba", "#f4c6d7"], 
                    borderWidth: 0 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false 
            } 
        }); 
    } 
} 
 
// Run when the page loads 
document.addEventListener("DOMContentLoaded", updateAnalytics);             