import "./globals.css";

export const metadata = {
  title: "Cobrancas",
  description: "Sistema de gestao de cobrancas"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

