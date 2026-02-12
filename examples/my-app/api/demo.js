export function GET({ json }) {
  json(200, [{ id: 1, mensaje: "Hola desde MicroVibe API" }]);
}