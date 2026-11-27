/** Vite's deployment base keeps public links inside the app on subpath hosts. */
export function appPath(page = ''): string {
  return `${import.meta.env.BASE_URL}${page.replace(/^\/+|\/+$/g, '')}${page ? '/' : ''}`;
}

export function currentAppPage(): string {
  const base = import.meta.env.BASE_URL;
  const pathname = window.location.pathname;
  return `/${(pathname.startsWith(base) ? pathname.slice(base.length) : pathname).replace(/^\/+|\/+$/g, '')}`;
}
