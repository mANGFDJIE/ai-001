import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <title>Услуги рядом</title>
      </head>
      <body>
        <header className="header">
          <h1>Услуги рядом</h1>
        </header>
        <main>{children}</main>
        <nav className="bottom-nav">
          <button>Главная</button>
          <button>Категории</button>
          <button>Профиль</button>
        </nav>
      </body>
    </html>
  );
}
