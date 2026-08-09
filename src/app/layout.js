import '../styles/globals.css';
import { ToastProvider } from '../hooks/useToast';

export const metadata = {
  title: 'Fantasy KNUST — Admin',
  description: 'Admin console for Fantasy KNUST',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
