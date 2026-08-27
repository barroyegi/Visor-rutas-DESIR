# Visor de Rutas de Senderismo — Hoja de entrega para alojamiento

**Contacto:** _(tu nombre y correo)_
**Fecha de entrega:** _(rellenar)_
**Versión entregada:** _(rellenar, ej. v1.0)_

---

## 1. Qué es

Aplicación web **estática**: ficheros HTML, CSS y JavaScript. Se publica copiándola en
una carpeta del servidor web, igual que cualquier página estática.

Los datos de las rutas **no se alojan aquí**: se consultan por internet contra
ArcGIS Online (Esri).

---

## 2. Qué NO hace falta instalar

- ❌ Node.js
- ❌ PHP
- ❌ Base de datos
- ❌ Servidor de aplicaciones
- ❌ Ningún proceso en ejecución

Solo un servidor web sirviendo ficheros: **Nginx, Apache o IIS**.

---

## 3. Contenido entregado

Fichero **`visor-rutas-web.zip`** (~16 MB). Al descomprimir:

```
index.html          ← página principal
assets/             ← JavaScript y CSS (~655 ficheros, carga bajo demanda)
icons/              ← iconos
vite.svg
```

---

## 4. Cómo publicarlo

1. Descomprimir el ZIP en el directorio de publicación
   (`public_html` / `www` / `htdocs` / `wwwroot`, según configuración).
2. **`index.html` debe quedar en la raíz de esa carpeta**, no dentro de un subdirectorio
   adicional creado por el descompresor.
3. Puede publicarse tanto en la **raíz del dominio** como en una **subcarpeta**
   (`/senderos/`, `/visor/`...). La aplicación usa rutas relativas y funciona en ambos casos.

---

## 5. Requisitos del servidor

### Obligatorio

- **HTTPS.** La aplicación consulta APIs externas por HTTPS. Si se sirve por HTTP,
  el navegador bloquea esas llamadas (*mixed content*) y no se mostrará ninguna ruta.

### Recomendado

- **Compresión gzip o brotli.** El fichero JavaScript principal ocupa ~2,4 MB sin
  comprimir y ~730 KB con gzip. Mejora notable en tiempo de carga.

  Ejemplo Nginx:
  ```nginx
  gzip on;
  gzip_types text/css application/javascript image/svg+xml font/woff2;
  gzip_min_length 1024;
  ```

- **Cabeceras de caché.** Los ficheros de `assets/` llevan un hash en el nombre y pueden
  cachearse indefinidamente. `index.html` no debe cachearse.

  ```nginx
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location = /index.html { add_header Cache-Control "no-cache"; }
  ```

- **Tipos MIME.** Comprobar que se sirven correctamente `.js`, `.css`, `.svg`, `.woff2`,
  `.woff`, `.ttf`. En **IIS**, `.woff2` (`font/woff2`) a veces no está configurado de serie.
  No se utilizan ficheros `.wasm`.

### No necesario

- No hacen falta reglas de *rewrite* ni configuración de SPA: es una única página
  sin enrutado de cliente.

---

## 6. Conectividad (importante en redes corporativas)

El **servidor no realiza ninguna llamada saliente**. Es el **navegador del usuario final**
el que debe poder alcanzar estos dominios:

| Dominio | Uso | ¿Crítico? |
|---------|-----|-----------|
| `services5.arcgis.com` | Datos de las rutas | **Sí** |
| `*.arcgis.com` | Mapas base de Esri | **Sí** |
| `*.tile.opentopomap.org` | Mapa base OpenTopoMap | No |
| `fonts.googleapis.com`, `fonts.gstatic.com` | Tipografía | No |
| `www.navarra.es` | Logo IDENA | No |
| `senderos.nafarmendi.org` | Enlaces a fichas de sendero | No |

> Si hay proxy o cortafuegos restrictivo, confirmar que **al menos los dos primeros**
> están permitidos. Es el principal punto de fallo en despliegues internos.

Si se aplica una **Content-Security-Policy**, incluir esos dominios en `connect-src`,
`img-src`, `style-src` y `font-src`.

---

## 7. Actualizaciones

Para publicar una versión nueva:

1. Se entrega un ZIP nuevo.
2. **Borrar el contenido anterior** de la carpeta (especialmente `assets/`, cuyos nombres
   de fichero cambian en cada versión).
3. Descomprimir el nuevo.

No requiere reiniciar nada ni parar el servicio.

---

## 8. Dato pendiente que necesito

**La URL definitiva** donde quede publicada.

Motivo: la clave de acceso a los servicios de ArcGIS debe restringirse a ese dominio
concreto por seguridad. Hasta no conocer la URL final no puede aplicarse esa restricción.

---

## 9. Comprobación tras publicar

1. Abrir la URL en un navegador.
2. Debe verse el mapa y, en el panel izquierdo, un listado de rutas (unas 247).
3. Si el listado aparece vacío o se queda cargando, abrir la consola del navegador
   (**F12**) y revisar los errores: casi siempre será HTTPS o un dominio bloqueado
   por el cortafuegos (apartados 5 y 6).
