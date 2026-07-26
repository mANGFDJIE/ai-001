document.querySelectorAll('.card').forEach(card=>{
  card.addEventListener('click',()=>{
    alert(`Вы выбрали: ${card.dataset.service}`);
  });
});
