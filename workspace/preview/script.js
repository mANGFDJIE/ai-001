document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  app.innerHTML = `
    <h1>Услуги рядом</h1>
    <p>Мини-апс для Telegram, где вы можете найти любые услуги рядом.</p>
    <button onclick="findServices()">Найти услуги</button>
  `;
});

function findServices() {
  alert('Здесь будут найдены услуги!');
}
