import React from'react';

const Layout = ({ children }) => (
  <div className="app-layout">
    <header className="app-header">
      <div className="logo">Услуги рядом</div>
      <nav>
        <ul className="nav-links">
          <li><a href="/ai">ИИ</a></li>
          <li><a href="/dashboard">Дашборд</a></li>
        </ul>
      </nav>
    </header>
    <main>{children}</main>
    <footer className="app-footer">© 2023 Услуги рядом</footer>
  </div>
);

export default Layout;
