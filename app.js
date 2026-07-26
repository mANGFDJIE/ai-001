const form = document.getElementById('task-form');
const input = document.getElementById('task-input');
const list = document.getElementById('task-list');

let tasks = JSON.parse(localStorage.getItem('mini-task-board') || '[]');

function saveTasks() {
  localStorage.setItem('mini-task-board', JSON.stringify(tasks));
}

function renderTasks() {
  list.innerHTML = '';

  if (!tasks.length) {
    const empty = document.createElement('li');
    empty.textContent = 'Список задач пуст.';
    empty.style.justifyContent = 'center';
    list.appendChild(empty);
    return;
  }

  tasks.forEach((task, index) => {
    const item = document.createElement('li');
    item.className = task.done ? 'completed' : '';

    const text = document.createElement('span');
    text.textContent = task.text;

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '8px';

    const doneButton = document.createElement('button');
    doneButton.type = 'button';
    doneButton.textContent = task.done ? '↺' : '✓';
    doneButton.onclick = () => {
      tasks[index].done = !tasks[index].done;
      saveTasks();
      renderTasks();
    };

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Удалить';
    deleteButton.onclick = () => {
      tasks.splice(index, 1);
      saveTasks();
      renderTasks();
    };

    controls.append(doneButton, deleteButton);
    item.append(text, controls);
    list.appendChild(item);
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  tasks.unshift({ text, done: false });
  saveTasks();
  input.value = '';
  renderTasks();
});

renderTasks();
