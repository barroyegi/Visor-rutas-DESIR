# Manual de Despliegue - Visor de Rutas de Senderismo

Aplicación web **100% estática** (Frontend) construida con **Vite** y **ArcGIS API for JavaScript**.

> **Resumen para el administrador del servidor:** la aplicación son ficheros estáticos
> (HTML/JS/CSS). **No requiere backend**: ni Node.js, ni PHP, ni base de datos en tiempo
> de ejecución. Basta con un servidor web que sirva la carpeta `dist/` por HTTPS.
> Node.js solo hace falta para *construir* el proyecto, no para servirlo.

---

## 1. Requisitos

### Para construir (máquina de build)

- **Node.js 20.19+ o 22.12+** (lo exige Vite 7; el `package.json` de Vite declara
  `"engines": { "node": "^20.19.0 || >=22.12.0" }`). Con versiones antiguas el build falla.
  - Probado con Node v20.19.0 y npm 10.8.2.
- Acceso a internet para `npm ci` (descarga de dependencias).

### Para servir (servidor de producción)

- Un **servidor web estático**: Nginx, Apache, IIS, Amazon S3, Azure Blob Storage...
- **HTTPS obligatorio.** La aplicación consume APIs por HTTPS; si se sirve por HTTP el
  navegador bloquea las peticiones por *mixed content*.
- **No hace falta Node.js en el servidor** si el build se genera en otra máquina (opción A).
- **No hace falta regla de rewrite / SPA fallback**: es una única página, sin router de cliente.

---

## 2. Estrategias de despliegue

| Opción | Qué se sube | ¿Node en el servidor? | Recomendado |
|--------|-------------|------------------------|-------------|
| **A** | La carpeta `dist/` ya construida | **No** | ✅ Sí |
| **B** | El repositorio; se ejecuta `npm ci && npm run build` en el servidor | Sí (solo para el build) | Si se automatizan despliegues |
| **C** | Servir con `serve` / `http-server` de Node | Sí (permanente) | ❌ No en producción |

`npm run preview` es solo para pruebas locales. **Nunca usarlo como servidor de producción.**

---

## 3. Instalación y build

```bash
npm ci                # instalación reproducible (usa package-lock.json)
npm run build         # genera dist/
```

Antes del build, definir la variable de entorno `VITE_ARCGIS_API_KEY`
(fichero `.env` local, o variables de entorno del sistema de CI/hosting).

Resultado: carpeta **`dist/`**, aproximadamente **16 MB** y **716 ficheros**
(la mayoría son *chunks* de ArcGIS que se cargan bajo demanda).

---

## 4. Variable de entorno y seguridad de la API Key

```
VITE_ARCGIS_API_KEY=<tu_api_key_de_arcgis>
```

- Se lee en **tiempo de build**, no en tiempo de ejecución. Vite la **incrusta en el bundle**.
- **Implicación de seguridad:** la key queda visible en el JavaScript público. Por tanto
  **debe estar restringida por dominio/referrer** en el portal de ArcGIS. Si cambia el
  dominio de producción, hay que actualizar esa restricción.
- El fichero `.env` **no debe subirse a git** (ya está en `.gitignore`).
- La API Key actual **caduca en diciembre de 2026**.

---

## 5. Configuración del servidor web

### Compresión (importante)

Activar **gzip o brotli**. El bundle principal ocupa ~2,4 MB sin comprimir y ~733 KB en gzip.

Ejemplo Nginx:

```nginx
gzip on;
gzip_types text/css application/javascript image/svg+xml font/woff2;
gzip_min_length 1024;
```

### Cache

Los ficheros de `assets/` llevan hash en el nombre, se pueden cachear indefinidamente.
`index.html` no debe cachearse.

```nginx
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
location = /index.html {
    add_header Cache-Control "no-cache";
}
```

### Tipos MIME

Asegurar que el servidor sirve correctamente: `.js`, `.css`, `.svg`, `.woff2`, `.woff`, `.ttf`.
En **IIS**, `.woff2` no siempre viene configurado de serie y hay que añadirlo
(`font/woff2`). No se usan ficheros `.wasm`.

---

## 6. Conectividad de red (revisar en entornos corporativos)

El servidor **no realiza ninguna llamada saliente**. Es el **navegador del usuario final**
el que debe poder alcanzar estos dominios:

| Dominio | Uso | Crítico |
|---------|-----|---------|
| `services5.arcgis.com` | Datos de rutas (Feature Layer) | **Sí** |
| `*.arcgis.com` | Mapas base de Esri (hybrid, topo) | Sí |
| `*.tile.opentopomap.org` | Mapa base OpenTopoMap | No (opcional) |
| `fonts.googleapis.com`, `fonts.gstatic.com` | Fuente Poppins | No (degrada) |
| `www.navarra.es` | Logo IDENA de la cabecera | No |
| `senderos.nafarmendi.org` | Enlaces a la ficha del sendero | No |

> Si la red corporativa usa proxy o firewall restrictivo, **confirmar que estos dominios
> están permitidos**. Es el principal punto de fallo en despliegues en intranet.

Si se aplica una **Content-Security-Policy**, hay que incluir esos dominios en
`connect-src`, `img-src`, `style-src` y `font-src`.

---

## 7. Origen de los datos (ArcGIS Online)

Los datos **no se alojan en el servidor**: residen en ArcGIS Online y se consumen por su
API REST. La capa debe ser **pública** o accesible con la API Key configurada.

Configuración en `src/config.js`:

- **`routesLayerUrl`** y **`startPointsLayerUrl`**: URL de la Feature Layer de rutas
  (actualmente ambas apuntan a la misma capa; los puntos de inicio se derivan de ella).
- **`fields`**: mapeo de nombres de campo.

### Esquema de datos real

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `OBJECTID` | OID | Identificador |
| `name_1` | String | Nombre de la ruta |
| `cod_ruta` | String | Código de ruta (agrupa variantes/etapas) |
| `longitud_km` | Double | Distancia (km) |
| `pos_elev` / `neg_elev` | Integer | Desnivel positivo / negativo (m) |
| `mide_difficulty` | Integer | Dificultad MIDE (1-4) |
| `time_one_way` | Date | Duración estimada (solo la parte horaria) |
| `Matricula` | String | Categoría: `GR`, `PR`, `SL` |
| `Variante` | String | Nombre de la variante/etapa |
| `elevation_profile` | String (JSON) | Perfil de elevación |
| `images` | String | URLs de fotos separadas por `\|` |
| `URL_Descarga` | String | Enlace al GPX |
| `XStart` / `YStart` | Double | Coordenadas del punto de inicio |
| `description`, `Descripcion_fr`, `Descripcion_eus` | String | Descripciones por idioma |

Volumen actual: **247 rutas**.

---

## 8. Desarrollo local

```bash
npm install
npm run dev      # http://localhost:5173
```

Requiere un navegador con **WebGL** habilitado (lo exige el MapView de ArcGIS).
