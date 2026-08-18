// Nunito — легасі-шрифт сторінок, ще не відрестайлених під бренд-бук
// (/profile, /shopping-list). Живе поза root layout, щоб woff2 не
// прелоадились на квізі, оплаті й лендінгу. При рестайлі цих сторінок
// файл видалити разом з імпортами.
import { Nunito } from 'next/font/google';

export const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});
