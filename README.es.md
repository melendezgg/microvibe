# MicroVibe

MicroVibe es un starter kit de Vibe Coding para crear apps web rápido, con un runtime mínimo, enrutamiento basado en archivos y JSX.

Incluye:

- `packages/microvibe`: el runtime/CLI para servir apps de MicroVibe.
- `packages/create-microvibe`: el generador scaffold para crear apps nuevas.

Idea central:

- Empezar desde una app funcional en segundos
- Iterar directamente en rutas y componentes
- Mantener defaults simples, responsive y fáciles de personalizar

## Estructura del Workspace

```text
microvibe/
  package.json
  packages/
    microvibe/
      bin/microvibe.js
      src/server.tsx
    create-microvibe/
      bin/create-microvibe.js
      template/
```

## Requisitos

- Node.js 18+ (recomendado: última versión LTS)
- npm 9+

## Inicio Rápido (Crear y Ejecutar una App de Ejemplo)

Desde la raíz de este repositorio:

```bash
node ./packages/create-microvibe/bin/create-microvibe.js my-app
cd my-app
npm install
npm run dev
```

Abrí:

- `http://127.0.0.1:3020`
- `http://127.0.0.1:3020/api/health`
- `http://127.0.0.1:3020/api/highlights`

## Demo End-to-End en 2 Minutos

Creá una ruta + un componente + un endpoint API + un flujo con fetch.

1. Creá un componente en `Components/GreetingCard.jsx`:

```jsx
/** @jsx h */
import { h } from "preact";

export default function GreetingCard({ text }) {
  return <p>{text}</p>;
}
```

2. Creá una ruta API en `api/demo.js`:

```js
export function GET({ json }) {
  json(200, [{ id: 1, mensaje: "Hola desde MicroVibe API" }]);
}
```

3. Creá una ruta de página en `routes/demo.jsx`:

```jsx
/** @jsx h */
import { h } from "preact";
import GreetingCard from "../Components/GreetingCard";

export const mode = "client";

export default function DemoPage() {
  async function load() {
    const res = await fetch("/api/demo");
    const data = await res.json();
    console.log(data);
  }

  return (
    <section>
      <h2>Demo Route</h2>
      <GreetingCard text="Route + Component + API connected." />
      <button type="button" onClick={load}>
        Fetch /api/demo
      </button>
    </section>
  );
}
```

4. Abrí `http://127.0.0.1:3020/demo` y hacé click en el botón.  
5. Verificá la API en `http://127.0.0.1:3020/api/demo`.

## Ejecutar con el CLI local de `microvibe`

Dentro del directorio de la app generada:

```bash
cd my-app
npm install
node ../packages/microvibe/bin/microvibe.js dev
```

## Template de la App Generada

Actualmente el scaffold genera:

- `routes/_app.jsx`: shell global de la app y salida de metadatos de ruta.
- `routes/index.jsx`: ruta inicial con guía técnica.
- `Components/AlertBox.jsx`: ejemplo de componente cliente interactivo.
- `api/health.js`: endpoint API de ejemplo.
- `api/highlights.js`: endpoint de ejemplo con arreglo JSON (contenido en español).
- `public/app.css`: estilos base neutrales y responsive.
- `public/client.entry.js`: entrada de hidratación en cliente.
- `server.tsx`: entrada del runtime del servidor local (generado desde `packages/microvibe/src/server.tsx`).

## Guía de Edición

- Agregá archivos de ruta en `/routes`.
- Agregá componentes de UI reutilizables en `/Components`.
- Agregá handlers de API en `/api`.
- Empezá editando `/routes/index.jsx`.

## Modo Cliente (`mode = "client"`)

Usá `export const mode = "client";` en una ruta cuando necesite comportamiento del lado del cliente (por ejemplo, componentes interactivos con estado).
Si una ruta no declara `mode = "client"`, se renderiza por defecto en SSR.
`mode` se define por archivo de ruta (`routes/*.jsx`) y los componentes usados por esa ruta siguen el mismo contexto de renderizado.

Ejemplo:

```jsx
export const mode = "client";
```

La ruta inicial `routes/index.jsx` ya incluye este modo para que componentes como `AlertBox` ejecuten su lógica interactiva en el navegador.

## Enrutamiento por Carpetas (File-Based Routing)

MicroVibe resuelve rutas desde archivos y carpetas dentro de `/routes`.

Ejemplos:

- `/` -> `routes/index.jsx`
- `/about` -> `routes/about.jsx`
- `/blog` -> `routes/blog/index.jsx`
- `/blog/post` -> `routes/blog/post.jsx`

Segmentos dinámicos:

- `/users/:id` -> `routes/users/[id].jsx`
- `/blog/:slug` -> `routes/blog/[slug].jsx`

Usá `routes/_app.jsx` como shell compartido para todas las rutas.

## Scripts del Monorepo

Desde la raíz del repo:

```bash
npm run dev:runtime
```

Esto ejecuta el script del workspace runtime:

- `packages/microvibe` -> `npm run dev`

## Troubleshooting

### `Cannot find package 'preact'`

Instalá dependencias en la app generada:

```bash
cd my-app
npm install
```

### Error de permisos de cache npm (`EPERM` en `~/.npm`)

Usá cache local del proyecto:

```bash
npm install --cache .npm-cache
```

### Error de resolución de red (`ENOTFOUND registry.npmjs.org`)

Verificá red/proxy y forzá el registry oficial:

```bash
npm config set registry https://registry.npmjs.org/
npm install --cache .npm-cache
```
