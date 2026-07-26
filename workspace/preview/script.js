(() => {
  const buttons = [...document.querySelectorAll('.nav-btn')];
  if (!buttons.length) return;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      buttons.forEach((item) => item.classList.toggle('active', item === button));
    });
  });
})();