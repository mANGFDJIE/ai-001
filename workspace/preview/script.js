document.addEventListener('DOMContentLoaded', () => {
    const servicesContainer = document.getElementById('services');
    const services = [
        { title: 'Ремонт электроники', description: 'Профессионально ремонтируем устройства...' },
        { title: 'Ремонт электротехники', description: 'Качественный ремонт с вариантами доставки...' },
    ];
    services.forEach(service => {
        const serviceDiv = document.createElement('div');
        serviceDiv.className ='service';
        serviceDiv.innerHTML = `<h2>${service.title}</h2><p>${service.description}</p>`;
        servicesContainer.appendChild(serviceDiv);
    });
});
