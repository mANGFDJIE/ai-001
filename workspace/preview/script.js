// Fills the "Services" section with dynamic cards (using a mock data)
const servicesData = [
  {id: 1, name: ' Ремонт', icon: '🔧'},
  {id: 2, name: 'Уборка', icon: '🧹'},
  {id: 3, name: 'Доставка', icon: ' 🚚 '},
  {id: 4, name: 'Грузоперевозки', icon: '🚛'},
  {id: 5, name: ' Репетитор ', icon: '📚'},
  {id: 6, name: 'Фото-съемка', icon: '📷'},
  {id: 7, name: ' negociaçãoник', icon: '💅'},
];

const servicesSection = document.querySelector('.services');

servicesData.forEach(service => {
  const card = document.createElement('div');
  card.classList.add('service-card');

  card.innerHTML = `
    <div class="service-icon">${service.icon}</div>
    <div class="service-name">${service.name}</div>
  `;

  servicesSection.appendChild(card);
});
