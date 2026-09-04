import { redirect } from 'next/navigation';

/**
 * La raiz no tiene contenido propio. Sin sesion (y al entrar a `/`) el destino
 * es el login; si ya hay sesion, `/login` manda a la primera pantalla permitida.
 */
export default function HomePage() {
  redirect('/login');
}
