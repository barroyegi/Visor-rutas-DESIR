# Manual de Despliegue - Visor de Rutas de Senderismo

Este proyecto es una aplicación web independiente (Frontend) construida con **Vite** y **ArcGIS API for JavaScript**.

## Requisitos Previos

- **Node.js** (v14 o superior) instalado.
- Una cuenta de **ArcGIS Online** (o ArcGIS Enterprise) para alojar los datos.
- (Opcional) Una **API Key** de ArcGIS Platform si los datos son privados o si usas servicios de basemaps premium.

## Instalación

1. Clonar o descargar este repositorio.
2. Abrir una terminal en la carpeta del proyecto (`visor-rutas`).
3. Instalar las dependencias:
   ```bash
   npm install
   ```

## Configuración de Datos (ArcGIS Online)

La aplicación espera una **Feature Layer** (Capa de Entidades) con las rutas de senderismo (Líneas).

### Esquema de Datos
Asegúrate de que tu capa en ArcGIS Online tenga los siguientes campos (o ajusta `src/config.js`):

| Nombre del Campo | Tipo de Dato | Descripción |
|------------------|--------------|-------------|
| `Name`           | String       | Nombre de la ruta |
| `Distance`       | Double       | Distancia (km) |
| `ElevationGain`  | Integer      | Desnivel positivo (m) |
| `Difficulty`     | String       | Dificultad (Easy, Medium, Hard) |
| `Duration`       | String       | Duración estimada (ej. "2h 30m") |

### Configuración de la App

Edita el archivo `src/config.js`:

1. **`routesLayerUrl`**: Pega la URL de tu Feature Layer de rutas.
   - Ejemplo: `https://services.arcgis.com/.../FeatureServer/0`
2. **`startPointsLayerUrl`**:
   - Si tienes una capa separada de puntos de inicio, pega su URL.
   - Si no, usa la misma URL que `routesLayerUrl` (la app intentará extraer los puntos).
3. **`apiKey`**: Pega tu API Key de ArcGIS si es necesaria.
4. **`fields`**: Ajusta el mapeo de nombres de campos si tus campos se llaman diferente (ej. `NOMBRE_RUTA` en lugar de `Name`).

## Ejecución en Desarrollo

Para probar la aplicación localmente:

```bash
npm run dev
```
Abre la URL que aparece en la terminal (normalmente `http://localhost:5173`).

## Despliegue en Producción

1. Generar los archivos estáticos:
   ```bash
   npm run build
   ```
2. El resultado estará en la carpeta `dist/`.
3. Sube el contenido de la carpeta `dist/` a cualquier servidor web estático:
   - GitHub Pages
   - Netlify / Vercel
   - Apache / Nginx
   - Amazon S3 / Azure Blob Storage

No se requiere backend (Node.js, PHP, etc.) para servir la aplicación, ya que es 100% estática y consume datos directamente de la API REST de ESRI.
