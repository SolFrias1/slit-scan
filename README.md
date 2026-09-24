# Tiempo e imagen: Slit Scan

Herramienta web para explorar el tiempo de un video como espacio. Carga un video, sepáralo en frames y apílalos en 3D. Luego ajusta cómo se distribuyen, procésalos y anímalos con keyframes.

Todo corre en el navegador: el video nunca sale de tu equipo.

## Qué puedes hacer

- **Extraer frames** de cualquier tramo del video, eligiendo cuántos por segundo y a qué ancho.
- **Apilarlos en Z** controlando la distancia, el rango de frames y el orden.
- **Transformar la pila** desde un frame de referencia hacia los extremos: escala constante, lineal u onda, giro acumulado en grados enteros, opacidad y edge fade con borde irregular.
- **Procesar la imagen:** recorte por brillo o por color (con cuentagotas), mostrar solo lo que cambia entre frames y teñido por tiempo con dos colores.
- **Animar con keyframes:** cámara, frame seleccionado, escala, giro, opacidad y procesamiento, con atajos de órbita de cámara y recorrido de frames.
- **Ver** en perspectiva libre, frontal o isométrica, con fondo negro, blanco o tomado de un frame.
- **Exportar:** frame en PNG, captura de la vista 3D, video frontal, video de la vista 3D y video de la animación. Las exportaciones salen siempre a resolución completa.

## Uso

Abre `index.html` en un navegador actual (Chrome, Edge, Firefox o Safari). Para cargar videos basta con arrastrarlos a la vista o usar «Elegir video». MP4 (H.264) y WebM funcionan en casi todos los navegadores.

Los videos se exportan en MP4 si el navegador lo permite y, si no, en WebM.

Atajos con la vista enfocada: `Espacio` reproduce o pausa, las flechas cambian de frame y `Esc` cancela el cuentagotas.

## Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a un repositorio (`index.html`, `css/`, `js/` y este `README.md` en la raíz).
2. En el repositorio, ve a **Settings → Pages**.
3. En **Build and deployment**, elige **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`. Guarda.
4. Tras un minuto, el sitio queda en `https://<tu-usuario>.github.io/<nombre-del-repo>/`.

Para probarlo en tu equipo sin publicar, puedes abrir `index.html` directamente o servir la carpeta con cualquier servidor local, por ejemplo `python3 -m http.server`.

## Estructura

```
index.html       Estructura de la interfaz
css/styles.css   Estilos (tema claro y oscuro según el sistema)
js/app.js        Lógica: extracción, escena 3D, procesamiento, animación y exportación
```

## Dependencias

Se cargan desde CDN, sin instalación:

- [three.js r128](https://threejs.org/) para la escena 3D.
- [Roboto Mono](https://fonts.google.com/specimen/Roboto+Mono) desde Google Fonts.

## Créditos

Desarrollado por **Felipe Roa R.** ([@fefeliperoa](https://www.instagram.com/fefeliperoa/))
DPPI / Escuela de Diseño UDP
2026

Inspirado en el trabajo de [@p_h_r_o_](https://www.instagram.com/p_h_r_o_/).
