export function GET({ json }) {
  json(200, [
    {
      id: 1,
      titulo: "Rutas por archivos",
      descripcion: "Crea páginas nuevas agregando archivos en /routes.",
      categoria: "enrutamiento",
    },
    {
      id: 2,
      titulo: "Componentes reutilizables",
      descripcion: "Organiza UI compartida dentro de /Components.",
      categoria: "interfaz",
    },
    {
      id: 3,
      titulo: "API integrada",
      descripcion: "Define handlers HTTP directamente en /api.",
      categoria: "backend",
    },
  ]);
}
